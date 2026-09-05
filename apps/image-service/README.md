# Luxtime Image Service

Microservicio FastAPI para procesamiento de imágenes de relojes.

## Endpoint

```
POST /api/v1/process-watch
```

**Entrada:** `multipart/form-data` con campo `file` (JPG, PNG, WEBP)

**Salida:** Imagen WEBP 1200×1800 px, reloj recortado con **fondo transparente** (el blanco solo se usa en el paso intermedio). En la tienda se ve sobre el fondo oscuro con sombra.

1. **Paso 1 — rembg:** recorte inicial del reloj (fondo complejo).
2. Fondo blanco temporal con margen (solo para el paso 2).
3. **Paso 2 — rembg + alpha matting:** recorte fino del reloj sobre blanco.
4. Canvas final **transparente** 1200×1800, reloj centrado al 84%.
5. Exportación WEBP con transparencia (calidad 88).

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
