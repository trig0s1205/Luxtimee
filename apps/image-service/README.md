# Luxtime Image Service

Microservicio FastAPI para procesamiento de imágenes de relojes.

## Endpoint

```
POST /api/v1/process-watch
```

**Entrada:** `multipart/form-data` con campo `file` (JPG, PNG, WEBP)

**Salida:** Imagen WEBP de 800×1200 px con fondo transparente, reloj centrado y optimizado (calidad 90)

## Algoritmo

1. Remoción de fondo con `rembg`
2. Recorte automático del bounding box
3. Redimensionado proporcional al 80% del canvas (máx. 640×960 px)
4. Centrado matemático en canvas transparente 800×1200 px
5. Exportación como WEBP con transparencia

## Ejecución

### Docker (recomendado)

```bash
docker compose up -d image-service
```

### Local

```bash
cd apps/image-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Health Check

```bash
curl http://localhost:8001/health
```
