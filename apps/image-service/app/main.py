from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response
from rembg import remove
from PIL import Image
import io

app = FastAPI(title="Luxtime Image Service", version="1.0.0")

MAX_SIZE = (1200, 1200)


def process_image(data: bytes) -> bytes:
    output = remove(data)
    image = Image.open(io.BytesIO(output)).convert("RGBA")
    image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@app.get("/health")
def health():
    return {"status": "ok", "service": "luxtime-image-service"}


@app.post("/process")
async def process(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Imagen vacía")

    try:
        processed = process_image(raw)
        return Response(content=processed, media_type="image/png")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error procesando imagen: {exc}") from exc
