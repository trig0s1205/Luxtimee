from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from rembg import remove
from PIL import Image
import io

app = FastAPI(title="Luxtime Image Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CANVAS_WIDTH = 800
CANVAS_HEIGHT = 1200
MAX_WATCH_WIDTH = int(CANVAS_WIDTH * 0.8)
MAX_WATCH_HEIGHT = int(CANVAS_HEIGHT * 0.8)
ALLOWED_FORMATS = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


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
        
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar la imagen: {str(exc)}"
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
            detail=f"Formato no válido. Formatos aceptados: JPG, PNG, WEBP"
        )

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Imagen vacía")

    processed = process_watch_image(raw)
    return Response(content=processed, media_type="image/webp")
