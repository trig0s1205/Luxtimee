import logging
import os
import subprocess
import tempfile

from fastapi import HTTPException

logger = logging.getLogger("luxtime-image-service")

MAX_VIDEO_INPUT_BYTES = 120 * 1024 * 1024
MAX_VIDEO_DURATION_SEC = 10.0
MAX_VIDEO_DURATION_TOLERANCE_SEC = 0.35
MAX_VIDEO_OUTPUT_BYTES = 10 * 1024 * 1024
MAX_VIDEO_HEIGHT_PX = 1080
ALLOWED_VIDEO_MIMES = {
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-m4v",
}


def _run(cmd: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "Error de ffmpeg").strip()
        logger.error("Comando fallido %s: %s", " ".join(cmd), detail)
        raise HTTPException(status_code=400, detail=detail[:500])
    return result


def _probe_duration(path: str) -> float:
    result = _run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            path,
        ]
    )
    try:
        return float(result.stdout.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="No se pudo leer la duración del video") from exc


def _encode(input_path: str, output_path: str, crf: int) -> None:
    scale = "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease"
    _run(
        [
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-vf",
            scale,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            str(crf),
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-an",
            "-t",
            str(MAX_VIDEO_DURATION_SEC + MAX_VIDEO_DURATION_TOLERANCE_SEC),
            output_path,
        ]
    )


def process_watch_video(data: bytes, declared_mime: str | None = None) -> bytes:
    if not data:
        raise HTTPException(status_code=400, detail="Video vacío")

    if len(data) > MAX_VIDEO_INPUT_BYTES:
        raise HTTPException(
            status_code=400,
            detail="El video supera el tamaño máximo de entrada (120MB)",
        )

    generic = declared_mime in {None, "", "application/octet-stream", "binary/octet-stream"}
    if declared_mime and not generic and declared_mime not in ALLOWED_VIDEO_MIMES:
        raise HTTPException(
            status_code=400,
            detail="Formato no válido. Use MP4, MOV o WEBM",
        )

    logger.info(
        "process_watch_video size=%s declared_mime=%s",
        len(data),
        declared_mime or "(vacío)",
    )

    with tempfile.TemporaryDirectory(prefix="lux-video-") as tmp:
        input_path = os.path.join(tmp, "input")
        output_path = os.path.join(tmp, "output.mp4")

        with open(input_path, "wb") as handle:
            handle.write(data)

        duration = _probe_duration(input_path)
        logger.info("Video duración=%.2fs", duration)
        if duration > MAX_VIDEO_DURATION_SEC + MAX_VIDEO_DURATION_TOLERANCE_SEC:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El video dura {duration:.1f}s. "
                    f"Máximo permitido: {MAX_VIDEO_DURATION_SEC:g}s."
                ),
            )

        last_size = 0
        for crf in (23, 26, 28, 30, 32):
            _encode(input_path, output_path, crf)
            last_size = os.path.getsize(output_path)
            logger.info("Video comprimido CRF=%s size=%s bytes", crf, last_size)
            if last_size <= MAX_VIDEO_OUTPUT_BYTES:
                with open(output_path, "rb") as handle:
                    return handle.read()

        raise HTTPException(
            status_code=400,
            detail=(
                "No se pudo comprimir el video bajo 10MB. "
                "Graba un clip más corto o con menos movimiento."
            ),
        )
