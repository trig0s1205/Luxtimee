import io
import logging
import os
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image
from rembg import new_session, remove

from app.video_processor import ALLOWED_VIDEO_MIMES, process_watch_video

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("luxtime-image-service")

_default_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
_cors_env = os.getenv("IMAGE_SERVICE_CORS_ORIGINS", "").strip()
allow_origins = (
    [origin.strip() for origin in _cors_env.split(",") if origin.strip()]
    if _cors_env
    else _default_origins
)

CANVAS_WIDTH = 1200
CANVAS_HEIGHT = 1800
MAX_WATCH_WIDTH = int(CANVAS_WIDTH * 0.84)
MAX_WATCH_HEIGHT = int(CANVAS_HEIGHT * 0.84)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_FORMATS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
REMBG_MODEL = os.getenv("REMBG_MODEL", "u2netp")
API_KEY = os.getenv("IMAGE_SERVICE_API_KEY", "").strip()

_rembg_session = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _rembg_session
    logger.info("Preloading rembg model: %s", REMBG_MODEL)
    _rembg_session = new_session(REMBG_MODEL)
    logger.info("Model ready")
    yield


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


def process_watch_image(data: bytes) -> bytes:
    try:
        no_bg = remove(data, session=_rembg_session)
        watch = Image.open(io.BytesIO(no_bg)).convert("RGBA")

        bbox = watch.getbbox()
        if bbox:
            watch = watch.crop(bbox)

        watch = _scale_to_fill(watch, MAX_WATCH_WIDTH, MAX_WATCH_HEIGHT)

        canvas = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), (0, 0, 0, 0))

        watch_width, watch_height = watch.size
        x = (CANVAS_WIDTH - watch_width) // 2
        y = (CANVAS_HEIGHT - watch_height) // 2

        canvas.paste(watch, (x, y), watch)

        buffer = io.BytesIO()
        canvas.save(buffer, format="WEBP", quality=88, method=4)
        return buffer.getvalue()

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Fallo al procesar imagen: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Error al procesar la imagen",
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
    if not file.content_type or file.content_type not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail="Formato no válido. Formatos aceptados: JPG, PNG, WEBP",
        )

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Imagen vacía")

    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail="La imagen supera el tamaño máximo de 10MB",
        )

    detected = _detect_image_mime(raw)
    if detected is None:
        raise HTTPException(
            status_code=400,
            detail="El contenido del archivo no es una imagen válida",
        )

    declared = "image/jpeg" if file.content_type == "image/jpg" else file.content_type
    if detected != declared and not (
        detected == "image/jpeg" and declared in {"image/jpeg", "image/jpg"}
    ):
        raise HTTPException(
            status_code=400,
            detail="El tipo MIME declarado no coincide con el contenido del archivo",
        )

    processed = process_watch_image(raw)
    return Response(content=processed, media_type="image/webp")


@app.post("/api/v1/process-video")
@app.post("/process-video")
async def process_video(
    file: UploadFile = File(...),
    _: None = Depends(verify_api_key),
) -> Response:
    declared = file.content_type
    if declared and declared not in ALLOWED_VIDEO_MIMES:
        raise HTTPException(
            status_code=400,
            detail="Formato no válido. Formatos aceptados: MP4, MOV, WEBM",
        )

    raw = await file.read()
    processed = process_watch_video(raw, declared_mime=declared)
    return Response(content=processed, media_type="video/mp4")
