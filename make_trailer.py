"""
Script para generar un montaje de video a partir de una carpeta de videos.

Que hace:
- Analiza cada archivo con ffprobe (duracion, codecs, resolucion, audio, etc.).
- Extrae un clip aleatorio de 15-20s (configurable) por video con ffmpeg.
- Re-codifica los clips a un formato uniforme (H.264 + AAC en MP4).
- Concatena los clips en un unico video final y reporta la codificacion resultante.

Como usar (desde la carpeta del proyecto):
- Basico:
  python make_trailer.py
- Cambiar carpeta de entrada:
  python make_trailer.py --input media
- Cambiar salida:
  python make_trailer.py --output trailer.mp4
- Cambiar duracion de clips y semilla:
  python make_trailer.py --min-sec 10 --max-sec 25 --seed 123
"""

import argparse
import json
import random
import shutil
import subprocess
import sys
from pathlib import Path

VIDEO_EXTS = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v", ".mpg", ".mpeg", ".flv"}


def run_cmd(cmd, verbose=False):
    """
    Ejecuta un comando del sistema y devuelve stdout.
    Si falla, imprime stdout/stderr para facilitar el diagnostico.
    """
    if verbose:
        print(" ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)
        raise RuntimeError(f"Command failed: {' '.join(cmd)}")
    return result.stdout


def probe_media(path):
    """
    Usa ffprobe para leer metadatos tecnicos del archivo (codecs, duracion, etc.)
    y devuelve un diccionario con campos normalizados para el reporte.
    """
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_entries",
        "format=duration",
        "-show_streams",
        str(path),
    ]
    data = json.loads(run_cmd(cmd))
    duration = 0.0
    if "format" in data and "duration" in data["format"]:
        try:
            duration = float(data["format"]["duration"])
        except ValueError:
            duration = 0.0

    streams = data.get("streams", [])
    v_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    a_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    video_codec = v_stream.get("codec_name") if v_stream else None
    audio_codec = a_stream.get("codec_name") if a_stream else None

    return {
        "path": path,
        "duration": duration,
        "video_codec": video_codec,
        "audio_codec": audio_codec,
        "has_audio": a_stream is not None,
        "width": v_stream.get("width") if v_stream else None,
        "height": v_stream.get("height") if v_stream else None,
        "pix_fmt": v_stream.get("pix_fmt") if v_stream else None,
        "profile": v_stream.get("profile") if v_stream else None,
        "r_frame_rate": v_stream.get("r_frame_rate") if v_stream else None,
        "avg_frame_rate": v_stream.get("avg_frame_rate") if v_stream else None,
        "v_bitrate": v_stream.get("bit_rate") if v_stream else None,
        "a_bitrate": a_stream.get("bit_rate") if a_stream else None,
        "sample_rate": a_stream.get("sample_rate") if a_stream else None,
        "channels": a_stream.get("channels") if a_stream else None,
    }


def print_codec_report(items):
    """
    Informe global para detectar si hay mezcla de codecs entre archivos.
    Si hay diferencias, lista que archivos usan cada codec.
    """
    video_codecs = {}
    audio_codecs = {}
    for info in items:
        video_codecs.setdefault(info["video_codec"] or "none", []).append(info["path"].name)
        audio_codecs.setdefault(info["audio_codec"] or "none", []).append(info["path"].name)

    print("Codec report:")
    print(f"- Video codecs found: {', '.join(video_codecs.keys())}")
    print(f"- Audio codecs found: {', '.join(audio_codecs.keys())}")

    if len(video_codecs) == 1 and len(audio_codecs) <= 1:
        print("- All videos share the same codec set.")
    else:
        if len(video_codecs) > 1:
            print("- Video codec differences:")
            for codec, names in video_codecs.items():
                print(f"  {codec}: {', '.join(names)}")
        if len(audio_codecs) > 1:
            print("- Audio codec differences:")
            for codec, names in audio_codecs.items():
                print(f"  {codec}: {', '.join(names)}")


def pick_segment(duration, min_len, max_len):
    """
    Elige un inicio aleatorio y una duracion aleatoria dentro del rango.
    Ajusta la longitud si el video es mas corto que el clip deseado.
    """
    if duration <= 0:
        return None, None
    seg_len = random.uniform(min_len, max_len)
    if duration < seg_len:
        seg_len = max(1.0, duration)
    start_max = max(0.0, duration - seg_len)
    start = random.uniform(0.0, start_max) if start_max > 0 else 0.0
    return start, seg_len


def escape_concat_path(path):
    """
    El concat demuxer de ffmpeg recomienda rutas entre comillas simples.
    Esta funcion escapa comillas simples dentro de la ruta.
    """
    return str(path).replace("'", "'\\''")


def main():
    """
    Orquesta el flujo principal:
    1) Parsear argumentos.
    2) Descubrir videos.
    3) Analizar codecs y mostrar informe por archivo.
    4) Crear clips aleatorios re-codificados.
    5) Concatenar todo en un video final.
    """
    parser = argparse.ArgumentParser(
        description="Create a montage from random 15-20s clips with uniform encoding."
    )
    parser.add_argument("--input", default=None, help="Input folder with videos")
    parser.add_argument("--output", default="montage.mp4", help="Output video file")
    parser.add_argument("--min-sec", type=float, default=15.0, help="Minimum clip length")
    parser.add_argument("--max-sec", type=float, default=20.0, help="Maximum clip length")
    parser.add_argument("--seed", type=int, default=None, help="Random seed")
    parser.add_argument(
        "--reencode-final",
        action="store_true",
        help="Re-encode the final concatenated video",
    )
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="Keep temporary segment files",
    )
    parser.add_argument("--verbose", action="store_true", help="Verbose ffmpeg output")
    args = parser.parse_args()

    # Verifica que ffmpeg y ffprobe estan disponibles en PATH.
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        print("ffmpeg/ffprobe not found in PATH. Please install ffmpeg.")
        sys.exit(1)

    # Determina carpeta de entrada (prioriza --input, luego media/, luego .).
    base_dir = Path(args.input) if args.input else None
    if base_dir is None:
        media_dir = Path("media")
        base_dir = media_dir if media_dir.is_dir() else Path(".")

    if not base_dir.is_dir():
        print(f"Input folder not found: {base_dir}")
        sys.exit(1)

    if args.min_sec <= 0 or args.max_sec <= 0 or args.max_sec < args.min_sec:
        print("Invalid min/max clip lengths.")
        sys.exit(1)

    if args.seed is not None:
        random.seed(args.seed)

    # Lista de archivos de video soportados por extension.
    video_files = [
        p for p in sorted(base_dir.iterdir()) if p.is_file() and p.suffix.lower() in VIDEO_EXTS
    ]

    if not video_files:
        print(f"No video files found in {base_dir}")
        sys.exit(1)

    info_list = [probe_media(p) for p in video_files]
    # Reporte detallado por archivo (util para ver mezclas de codecs y parametros).
    print("\nPer-file media info:")
    for info in info_list:
        v_res = f"{info['width']}x{info['height']}" if info["width"] and info["height"] else "unknown"
        print(
            f"- {info['path'].name}: "
            f"dur {info['duration']:.2f}s, "
            f"vcodec {info['video_codec']}, "
            f"res {v_res}, "
            f"pix_fmt {info['pix_fmt']}, "
            f"profile {info['profile']}, "
            f"r_fps {info['r_frame_rate']}, "
            f"avg_fps {info['avg_frame_rate']}, "
            f"v_bitrate {info['v_bitrate']}, "
            f"acodec {info['audio_codec']}, "
            f"sample_rate {info['sample_rate']}, "
            f"channels {info['channels']}, "
            f"a_bitrate {info['a_bitrate']}"
        )
    print_codec_report(info_list)

    # Carpeta temporal para guardar los clips re-codificados.
    temp_dir = Path("_segments")
    temp_dir.mkdir(exist_ok=True)

    segment_paths = []
    for idx, info in enumerate(info_list, start=1):
        start, seg_len = pick_segment(info["duration"], args.min_sec, args.max_sec)
        if start is None:
            print(f"Skipping {info['path'].name}: could not read duration.")
            continue

        segment_path = temp_dir / f"segment_{idx:03d}.mp4"

        # Re-codifica cada clip a H.264 + AAC para garantizar uniformidad.
        if info["has_audio"]:
            cmd = [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(info["path"]),
                "-ss",
                f"{start:.3f}",
                "-t",
                f"{seg_len:.3f}",
                "-vf",
                "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "22",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-ar",
                "48000",
                "-ac",
                "2",
                "-movflags",
                "+faststart",
                str(segment_path),
            ]
        else:
            cmd = [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(info["path"]),
                "-ss",
                f"{start:.3f}",
                "-t",
                f"{seg_len:.3f}",
                "-f",
                "lavfi",
                "-t",
                f"{seg_len:.3f}",
                "-i",
                "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-shortest",
                "-vf",
                "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "22",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-ar",
                "48000",
                "-ac",
                "2",
                "-movflags",
                "+faststart",
                str(segment_path),
            ]

        # Si el usuario pidio verbose, sube el nivel de log.
        if args.verbose:
            cmd[cmd.index("-loglevel") + 1] = "info"

        print(
            f"Creating segment {idx}/{len(info_list)} from {info['path'].name} "
            f"(start {start:.2f}s, len {seg_len:.2f}s)"
        )
        run_cmd(cmd, verbose=args.verbose)
        segment_paths.append(segment_path)

    if not segment_paths:
        print("No segments created.")
        sys.exit(1)

    # Archivo de lista para el concat demuxer.
    concat_list = temp_dir / "segments.txt"
    with concat_list.open("w", encoding="utf-8") as f:
        for p in segment_paths:
            escaped = escape_concat_path(p.resolve().as_posix())
            f.write(f"file '{escaped}'\n")

    # Comando de concatenacion final.
    output_path = Path(args.output)
    concat_cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_list),
    ]

    if args.reencode_final:
        concat_cmd += [
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "22",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    else:
        concat_cmd += ["-c", "copy", str(output_path)]

    if args.verbose:
        concat_cmd[concat_cmd.index("-loglevel") + 1] = "info"

    print(f"Concatenating {len(segment_paths)} segments into {output_path}")
    run_cmd(concat_cmd, verbose=args.verbose)

    # Reporta la codificacion final (verifica que el formato es uniforme).
    try:
        final_info = probe_media(output_path)
        print("\nFinal output encoding info:")
        v_res = (
            f"{final_info['width']}x{final_info['height']}"
            if final_info["width"] and final_info["height"]
            else "unknown"
        )
        print(
            f"- {output_path.name}: "
            f"dur {final_info['duration']:.2f}s, "
            f"vcodec {final_info['video_codec']}, "
            f"res {v_res}, "
            f"pix_fmt {final_info['pix_fmt']}, "
            f"profile {final_info['profile']}, "
            f"r_fps {final_info['r_frame_rate']}, "
            f"avg_fps {final_info['avg_frame_rate']}, "
            f"v_bitrate {final_info['v_bitrate']}, "
            f"acodec {final_info['audio_codec']}, "
            f"sample_rate {final_info['sample_rate']}, "
            f"channels {final_info['channels']}, "
            f"a_bitrate {final_info['a_bitrate']}"
        )
    except RuntimeError:
        print("Warning: could not probe final output.")

    # Limpieza de temporales si no se pidio --keep-temp.
    if not args.keep_temp:
        for p in temp_dir.iterdir():
            try:
                p.unlink()
            except OSError:
                pass
        try:
            temp_dir.rmdir()
        except OSError:
            pass

    print("Done.")


if __name__ == "__main__":
    main()
