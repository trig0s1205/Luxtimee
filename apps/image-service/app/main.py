from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from rembg import remove
from PIL import Image
import io
import logging
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("luxtime-image-service")

app = FastAPI(title="Luxtime Image Service", version="1.0.0")

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

CANVAS_WIDTH = 1200
CANVAS_HEIGHT = 1800
MAX_WATCH_WIDTH = int(CANVAS_WIDTH * 0.84)
MAX_WATCH_HEIGHT = int(CANVAS_HEIGHT * 0.84)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_FORMATS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


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
    """Escala proporcionalmente (up o down) hasta ocupar el máximo del lienzo."""
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
        no_bg = remove(data)
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
        canvas.save(buffer, format="WEBP", quality=90, method=6)
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
async def process_watch(file: UploadFile = File(...)) -> Response:
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
