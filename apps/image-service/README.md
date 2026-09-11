# Luxtime Image Service

Microservicio FastAPI para procesamiento de imágenes de relojes.

## Endpoint

```
POST /api/v1/process-watch
```

**Entrada:** `multipart/form-data` con campo `file` (JPG, PNG, WEBP)

**Salida:** Imagen WEBP 1200×1800 px, reloj recortado con **fondo transparente** (el blanco solo se usa en el paso intermedio). En la tienda se ve sobre el fondo oscuro con sombra.

1. Si la foto ya tiene **fondo claro/blanco** (caja de luz, base acrílica): recorte **directo** con rembg (sin paso 1 que arrastra la base).
2. Si el fondo es sucio/complejo: **paso 1** rembg → blanco → **paso 2** rembg fino.
3. Canvas final transparente 1200×1800, reloj al 84%, WEBP.

**Foto con base transparente:** encuadra solo reloj + base mínima; evita mucho blanco vacío abajo. Corazón abierto: no uses doble paso sobre la base completa.

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
