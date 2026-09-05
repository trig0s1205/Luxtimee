# Luxtime Image Service

Microservicio FastAPI para procesamiento de imágenes de relojes.

## Endpoint

```
POST /api/v1/process-watch
```

**Entrada:** `multipart/form-data` con campo `file` (JPG, PNG, WEBP)

**Salida:** Imagen WEBP de 1200×1800 px con **fondo blanco**, reloj centrado y optimizado (calidad 88)

## Algoritmo

1. **Paso 1 — rembg:** recorte inicial del reloj (fondo complejo).
2. Aplanado sobre **fondo blanco** con margen.
3. **Paso 2 — rembg:** recorte preciso sobre blanco (donde rembg rinde mejor).
4. Redimensionado proporcional al 84% del canvas (máx. 1008×1512 px).
5. Centrado en canvas blanco 1200×1800 px.
6. Exportación como WEBP (calidad 88).

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
