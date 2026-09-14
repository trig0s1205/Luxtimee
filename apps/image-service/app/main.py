import io
import logging
import os
import secrets
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage
import numpy as np

from app.video_processor import ALLOWED_VIDEO_MIMES, process_watch_video

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("luxtime-image-service")

_GENERIC_CONTENT_TYPES = {
    "",
    "application/octet-stream",
    "binary/octet-stream",
    "application/binary",
}

_default_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
_production_origins = [
    "https://luxtimee.com",
    "https://www.luxtimee.com",
]


def _split_origins(raw: str) -> list[str]:
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _build_allow_origins() -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for origin in (
        *_default_origins,
        *_production_origins,
        *_split_origins(os.getenv("IMAGE_SERVICE_CORS_ORIGINS", "")),
        *_split_origins(os.getenv("FRONTEND_URL", "")),
    ):
        if origin not in seen:
            seen.add(origin)
            merged.append(origin)
    return merged


allow_origins = _build_allow_origins()

CANVAS_WIDTH = 1200
CANVAS_HEIGHT = 1800
MAX_WATCH_WIDTH = int(CANVAS_WIDTH * 0.84)
MAX_WATCH_HEIGHT = int(CANVAS_HEIGHT * 0.84)
BACKGROUND_RGB = (255, 255, 255)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_FORMATS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
REMBG_MODEL = os.getenv("REMBG_MODEL", "birefnet-general")
API_KEY = os.getenv("IMAGE_SERVICE_API_KEY", "").strip()

_rembg_session = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _rembg_session
    logger.info("CORS allow_origins=%s", allow_origins)
    logger.info("Preloading rembg model: %s", REMBG_MODEL)
    started = time.perf_counter()
    _rembg_session = new_session(REMBG_MODEL)
    logger.info("Model ready in %.2fs", time.perf_counter() - started)
    yield
    logger.info("Shutting down image-service")


app = FastAPI(title="Luxtime Image Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def verify_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    if not API_KEY:
        if os.getenv("NODE_ENV") == "production" or os.getenv("K_SERVICE"):
            raise HTTPException(status_code=503, detail="IMAGE_SERVICE_API_KEY no configurada")
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, API_KEY):
        raise HTTPException(status_code=401, detail="API key inválida")


def _detect_image_mime(data: bytes) -> str | None:
    if len(data) < 12:
        return None
    if data[0:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[0:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[0:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _scale_to_fill(img: Image.Image, max_w: int, max_h: int) -> Image.Image:
    w, h = img.size
    if w <= 0 or h <= 0:
        return img
    scale = min(max_w / w, max_h / h)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    if new_w == w and new_h == h:
        return img
    return img.resize((new_w, new_h), Image.Resampling.LANCZOS)


def _crop_rgba(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def _flatten_on_white(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    white_layer = Image.new("RGBA", rgba.size, (*BACKGROUND_RGB, 255))
    return Image.alpha_composite(white_layer, rgba)


def _pad_on_white(img: Image.Image, ratio: float = 0.12) -> Image.Image:
    rgb = _flatten_on_white(img).convert("RGB")
    width, height = rgb.size
    pad = max(24, int(max(width, height) * ratio))
    canvas = Image.new("RGB", (width + pad * 2, height + pad * 2), BACKGROUND_RGB)
    canvas.paste(rgb, (pad, pad))
    return canvas


def _pad_rgb_on_white(rgb: Image.Image, ratio: float = 0.08) -> Image.Image:
    width, height = rgb.size
    pad = max(32, int(max(width, height) * ratio))
    canvas = Image.new("RGB", (width + pad * 2, height + pad * 2), BACKGROUND_RGB)
    canvas.paste(rgb, (pad, pad))
    return canvas


def _is_studio_white_backdrop(rgb: Image.Image) -> bool:
    width, height = rgb.size
    preview = rgb.resize((72, 72))
    pixels = list(preview.getdata())
    avg_lum = sum((r + g + b) / 3 for r, g, b in pixels) / len(pixels)
    if avg_lum >= 188:
        return True

    step = max(1, min(width, height) // 48)
    samples: list[tuple[int, int, int]] = []
    for x in range(0, width, step):
        samples.append(rgb.getpixel((x, 0)))
        samples.append(rgb.getpixel((x, height - 1)))
    for y in range(0, height, step):
        samples.append(rgb.getpixel((0, y)))
        samples.append(rgb.getpixel((width - 1, y)))
    if not samples:
        return False
    bright = sum(1 for r, g, b in samples if min(r, g, b) >= 200)
    return bright / len(samples) >= 0.55


def _trim_white_margins(rgb: Image.Image, threshold: int = 235, max_ratio: float = 0.38) -> Image.Image:
    width, height = rgb.size
    pixels = rgb.load()

    def row_mostly_white(y: int) -> bool:
        white = sum(
            1 for x in range(width)
            if min(pixels[x, y]) >= threshold
        )
        return white / width >= 0.9

    def col_mostly_white(x: int) -> bool:
        white = sum(
            1 for y in range(height)
            if min(pixels[x, y]) >= threshold
        )
        return white / height >= 0.9

    top = 0
    bottom = height
    left = 0
    right = width

    max_trim_y = int(height * max_ratio)
    trimmed_y = 0
    while bottom - top > 48 and trimmed_y < max_trim_y and row_mostly_white(bottom - 1):
        bottom -= 1
        trimmed_y += 1
    trimmed_y = 0
    while bottom - top > 48 and trimmed_y < max_trim_y and row_mostly_white(top):
        top += 1
        trimmed_y += 1

    max_trim_x = int(width * 0.2)
    trimmed_x = 0
    while right - left > 48 and trimmed_x < max_trim_x and col_mostly_white(left):
        left += 1
        trimmed_x += 1
    trimmed_x = 0
    while right - left > 48 and trimmed_x < max_trim_x and col_mostly_white(right - 1):
        right -= 1
        trimmed_x += 1

    if right - left < 32 or bottom - top < 32:
        return rgb
    return rgb.crop((left, top, right, bottom))


def _tight_crop_subject(rgb: Image.Image, white_threshold: int = 232) -> Image.Image:
    arr = np.asarray(rgb)
    non_white = np.any(arr < white_threshold, axis=2)
    if not np.any(non_white):
        return rgb
    ys, xs = np.where(non_white)
    height, width = arr.shape[:2]
    margin_y = max(8, int(height * 0.03))
    margin_x = max(8, int(width * 0.03))
    top = max(0, int(ys.min()) - margin_y)
    bottom = min(height, int(ys.max()) + margin_y + 1)
    left = max(0, int(xs.min()) - margin_x)
    right = min(width, int(xs.max()) + margin_x + 1)
    return rgb.crop((left, top, right, bottom))


def _keep_largest_alpha_blob(rgba: Image.Image) -> Image.Image:
    arr = np.asarray(rgba).copy()
    mask = arr[:, :, 3] > 72
    if not np.any(mask):
        return rgba
    labeled, count = ndimage.label(mask)
    if count <= 1:
        return rgba
    sizes = ndimage.sum(mask, labeled, range(1, count + 1))
    keep = int(np.argmax(sizes)) + 1
    arr[:, :, 3] = np.where(labeled == keep, arr[:, :, 3], 0)
    return Image.fromarray(arr)


def _remove_bottom_pedestal(rgba: Image.Image) -> Image.Image:
    arr = np.asarray(rgba).copy()
    alpha = arr[:, :, 3] > 72
    height, width = alpha.shape
    if height < 80:
        return rgba

    fill = np.sum(alpha, axis=1) / max(width, 1)
    peak_y = int(np.argmax(fill))
    peak_fill = float(fill[peak_y])
    if peak_fill < 0.04:
        return rgba

    cut_y = height
    low_run = 0
    min_run = max(10, height // 28)
    for y in range(height - 1, peak_y + max(8, height // 12), -1):
        if fill[y] < peak_fill * 0.28:
            low_run += 1
            if low_run >= min_run:
                cut_y = y + low_run
                break
        else:
            low_run = 0

    if cut_y < height - 12:
        arr[cut_y:, :, 3] = 0
        logger.info("pedestal recortado filas=%s de %s", cut_y, height)
    return Image.fromarray(arr)


def _refine_watch_cut(rgba: Image.Image) -> Image.Image:
    refined = _keep_largest_alpha_blob(rgba)
    refined = _remove_bottom_pedestal(refined)
    return _crop_rgba(refined)


def _rembg_refined(data: bytes) -> Image.Image:
    refined_cut = remove(
        data,
        session=_rembg_session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=10,
        post_process_mask=True,
    )
    return _refine_watch_cut(_crop_rgba(Image.open(io.BytesIO(refined_cut)).convert("RGBA")))


def _normalize_watch_for_canvas(watch: Image.Image) -> Image.Image:
    """Escala el reloj para que el sujeto visible ocupe la misma proporción en frente y reverso."""
    bbox = watch.getbbox()
    if bbox:
        left, top, right, bottom = bbox
        subject_w = right - left
        subject_h = bottom - top
    else:
        subject_w, subject_h = watch.size

    if subject_w <= 0 or subject_h <= 0:
        return _scale_to_fill(watch, MAX_WATCH_WIDTH, MAX_WATCH_HEIGHT)

    target_max = min(MAX_WATCH_WIDTH, MAX_WATCH_HEIGHT)
    scale = target_max / max(subject_w, subject_h)
    new_w = max(1, round(watch.width * scale))
    new_h = max(1, round(watch.height * scale))
    scaled = watch.resize((new_w, new_h), Image.Resampling.LANCZOS)

    panel = Image.new("RGBA", (MAX_WATCH_WIDTH, MAX_WATCH_HEIGHT), (0, 0, 0, 0))
    x = (MAX_WATCH_WIDTH - scaled.width) // 2
    y = (MAX_WATCH_HEIGHT - scaled.height) // 2
    panel.paste(scaled, (x, y), scaled)
    return panel


def _compose_canvas(watch: Image.Image) -> bytes:
    watch = _normalize_watch_for_canvas(watch)
    canvas = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), (0, 0, 0, 0))
    x = (CANVAS_WIDTH - watch.width) // 2
    y = (CANVAS_HEIGHT - watch.height) // 2
    canvas.paste(watch, (x, y), watch)
    buffer = io.BytesIO()
    canvas.save(buffer, format="WEBP", quality=88, method=4)
    return buffer.getvalue()


def process_watch_image(data: bytes) -> bytes:
    started = time.perf_counter()
    try:
        source_rgb = Image.open(io.BytesIO(data)).convert("RGB")
        studio = _is_studio_white_backdrop(source_rgb)

        if studio:
            logger.info("modo estudio: fondo claro detectado, recorte directo")
            trimmed = _trim_white_margins(source_rgb)
            focused = _tight_crop_subject(trimmed)
            studio_png = io.BytesIO()
            _pad_rgb_on_white(focused).save(studio_png, format="PNG")
            watch = _rembg_refined(studio_png.getvalue())
            logger.info(
                "rembg estudio ok in %.2fs size=%sx%s",
                time.perf_counter() - started,
                watch.width,
                watch.height,
            )
            result = _compose_canvas(watch)
        else:
            logger.info("rembg pass-1 inicio bytes=%s model=%s", len(data), REMBG_MODEL)
            rough_cut = remove(data, session=_rembg_session)
            watch_rough = _crop_rgba(Image.open(io.BytesIO(rough_cut)).convert("RGBA"))
            logger.info(
                "rembg pass-1 ok in %.2fs size=%sx%s",
                time.perf_counter() - started,
                watch_rough.width,
                watch_rough.height,
            )

            on_white = _pad_on_white(watch_rough)
            white_png = io.BytesIO()
            on_white.save(white_png, format="PNG")

            logger.info("rembg pass-2 inicio bytes=%s", len(white_png.getvalue()))
            watch = _rembg_refined(white_png.getvalue())
            logger.info("rembg pass-2 ok size=%sx%s", watch.width, watch.height)
            result = _compose_canvas(watch)
        logger.info(
            "Imagen lista in %.2fs canvas=%sx%s out_bytes=%s",
            time.perf_counter() - started,
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            len(result),
        )
        return result

    except HTTPException:
        raise
    except MemoryError as exc:
        logger.exception("rembg OOM al procesar imagen")
        raise HTTPException(
            status_code=500,
            detail="Error de rembg: memoria insuficiente",
        ) from exc
    except Exception as exc:
        logger.exception("Fallo rembg al procesar imagen: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Error de rembg al procesar la imagen ({type(exc).__name__})",
        ) from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "luxtime-image-service"}


@app.post("/api/v1/process-watch")
@app.post("/process")
async def process_watch(
    file: UploadFile = File(...),
    _: None = Depends(verify_api_key),
) -> Response:
    raw = await file.read()
    declared_raw = (file.content_type or "").strip().lower()
    logger.info(
        "process-watch filename=%s content_type=%s size=%s",
        file.filename,
        declared_raw or "(vacío)",
        len(raw),
    )

    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Imagen vacía")

    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail="La imagen supera el tamaño máximo de 10MB",
        )

    detected = _detect_image_mime(raw)
    if detected is None:
        logger.warning(
            "Rechazado: magic bytes inválidos filename=%s content_type=%s size=%s",
            file.filename,
            declared_raw or "(vacío)",
            len(raw),
        )
        raise HTTPException(
            status_code=400,
            detail="El contenido del archivo no es una imagen válida (JPG, PNG o WEBP)",
        )

    declared = "image/jpeg" if declared_raw == "image/jpg" else declared_raw
    if declared and declared not in _GENERIC_CONTENT_TYPES and declared not in ALLOWED_FORMATS:
        logger.warning(
            "content_type no permitido %s; se acepta por magic bytes %s",
            declared,
            detected,
        )
    elif declared and declared not in _GENERIC_CONTENT_TYPES and detected != declared:
        if not (detected == "image/jpeg" and declared in {"image/jpeg", "image/jpg"}):
            logger.warning(
                "MIME declarado %s no coincide con %s; se usa magic bytes",
                declared,
                detected,
            )

    logger.info("Procesando imagen mime=%s size=%s", detected, len(raw))
    processed = process_watch_image(raw)
    return Response(content=processed, media_type="image/webp")


@app.post("/api/v1/process-video")
@app.post("/process-video")
async def process_video(
    file: UploadFile = File(...),
    _: None = Depends(verify_api_key),
) -> Response:
    declared = (file.content_type or "").strip().lower() or None
    logger.info(
        "process-video filename=%s content_type=%s",
        file.filename,
        declared or "(vacío)",
    )
    if declared and declared not in _GENERIC_CONTENT_TYPES and declared not in ALLOWED_VIDEO_MIMES:
        raise HTTPException(
            status_code=400,
            detail="Formato no válido. Formatos aceptados: MP4, MOV, WEBM",
        )

    raw = await file.read()
    logger.info("Video recibido size=%s mime=%s", len(raw), declared or "(vacío)")
    processed = process_watch_video(raw, declared_mime=declared if declared not in _GENERIC_CONTENT_TYPES else None)
    logger.info("Video procesado out_bytes=%s", len(processed))
    return Response(content=processed, media_type="video/mp4")
