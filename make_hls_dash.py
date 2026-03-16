"""
Script para generar 5 resoluciones a partir de un video y publicar HLS y MPEG-DASH.

Que hace:
- Crea 5 versiones del video (ladder ABR) usando H.264/AAC.
- Genera HLS (master + playlists + segmentos .ts).
- Genera MPEG-DASH (MPD + segmentos .m4s).

Salida esperada:
- <output>/hls/master.m3u8
- <output>/hls/v0..v4/*.ts + prog_index.m3u8
- <output>/dash/stream.mpd + init/chunk .m4s

Como usar (desde la carpeta del proyecto):
- Basico (HLS + DASH):
  python make_hls_dash.py --input video.mp4
- Solo HLS:
  python make_hls_dash.py --input video.mp4 --hls-only
- Solo DASH:
  python make_hls_dash.py --input video.mp4 --dash-only
- Cambiar carpeta de salida:
  python make_hls_dash.py --input video.mp4 --output out_stream
- Carpetas separadas:
  python make_hls_dash.py --input video.mp4 --hls-dir out_hls --dash-dir out_dash
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


# Ladder de 5 resoluciones.
LADDER = [
    {"name": "360p", "w": 640, "h": 360, "v_bitrate": "800k"},
    # 848x480 es cercano a 16:9; fijamos DAR por filtro para evitar conflictos en DASH.
    {"name": "480p", "w": 848, "h": 480, "v_bitrate": "1400k"},
    {"name": "720p", "w": 1280, "h": 720, "v_bitrate": "2800k"},
    {"name": "1080p", "w": 1920, "h": 1080, "v_bitrate": "5000k"},
    {"name": "1440p", "w": 2560, "h": 1440, "v_bitrate": "8000k"},
]


def run_cmd(cmd, verbose=False, cwd=None):
    # Ejecuta un comando y levanta error si falla, mostrando salida util.
    # cwd permite ejecutar desde una carpeta concreta (util para DASH).
    if verbose:
        print(" ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
    if result.returncode != 0:
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)
        raise RuntimeError(f"Command failed: {' '.join(cmd)}")
    return result.stdout


def has_audio(path):
    # Comprueba si el archivo tiene al menos un stream de audio.
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_name",
        "-of",
        "csv=p=0",
        str(path),
    ]
    out = run_cmd(cmd).strip()
    return bool(out)


def build_filter_complex():
    # Construye el filter_complex que:
    # 1) Divide el video en N ramas con split.
    # 2) Escala y rellena (pad) a cada resolucion destino.
    # 3) Fija DAR a 16:9 para que todas las variantes tengan el mismo aspect ratio.
    split = "[0:v]split={n}{outs};".format(
        n=len(LADDER), outs="".join([f"[v{i}]" for i in range(len(LADDER))])
    )
    scales = []
    for i, rung in enumerate(LADDER):
        scales.append(
            "[v{idx}]scale={w}:{h}:force_original_aspect_ratio=decrease,"
            "pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,setdar=16/9[v{idx}out]".format(
                idx=i, w=rung["w"], h=rung["h"]
            )
        )
    return split + ";".join(scales)


def build_hls_cmd(input_path, hls_dir, include_audio, verbose=False):
    # Construye el comando ffmpeg para HLS (master + playlists por variante).
    # Nota: duplicamos el audio para evitar el error de "Same elementary stream"
    # al reutilizar el mismo stream en varias variantes.
    filter_complex = build_filter_complex()
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(input_path),
        "-filter_complex",
        filter_complex,
    ]

    # Mapea cada salida de video (v0out..v4out).
    for i in range(len(LADDER)):
        cmd += ["-map", f"[v{i}out]"]
    if include_audio:
        # Duplicamos el audio tantas veces como variantes para HLS.
        for _ in range(len(LADDER)):
            cmd += ["-map", "0:a:0"]

    # Parametros comunes de video para todas las variantes.
    cmd += ["-c:v", "libx264", "-preset", "medium", "-pix_fmt", "yuv420p"]
    for i, rung in enumerate(LADDER):
        cmd += [f"-b:v:{i}", rung["v_bitrate"]]

    if include_audio:
        # Parametros comunes para todas las pistas de audio.
        cmd += ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]

    # Mapa de variantes HLS: cada video usa su propio indice de audio.
    var_map = []
    if include_audio:
        for i in range(len(LADDER)):
            var_map.append(f"v:{i},a:{i}")
    else:
        for i in range(len(LADDER)):
            var_map.append(f"v:{i}")

    cmd += [
        "-f",
        "hls",
        "-hls_time",
        "4",
        "-hls_playlist_type",
        "vod",
        "-master_pl_name",
        "master.m3u8",
        "-var_stream_map",
        " ".join(var_map),
        "-hls_segment_filename",
        str(hls_dir / "v%v" / "segment_%03d.ts"),
        str(hls_dir / "v%v" / "prog_index.m3u8"),
    ]

    if verbose:
        cmd[cmd.index("-loglevel") + 1] = "info"
    return cmd


def build_dash_cmd(input_path, dash_dir, include_audio, verbose=False):
    # Construye el comando ffmpeg para MPEG-DASH.
    # En DASH es valido tener un solo audio compartido entre variantes de video.
    filter_complex = build_filter_complex()
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(input_path.resolve()),
        "-filter_complex",
        filter_complex,
    ]

    # Mapea cada salida de video (v0out..v4out).
    for i in range(len(LADDER)):
        cmd += ["-map", f"[v{i}out]"]
    if include_audio:
        cmd += ["-map", "0:a:0"]

    # Parametros de video para todas las variantes.
    cmd += ["-c:v", "libx264", "-preset", "medium", "-pix_fmt", "yuv420p"]
    for i, rung in enumerate(LADDER):
        cmd += [f"-b:v:{i}", rung["v_bitrate"]]

    if include_audio:
        # Audio para DASH (una pista compartida).
        cmd += ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"]
        adapt_sets = "id=0,streams=v id=1,streams=a"
    else:
        adapt_sets = "id=0,streams=v"

    cmd += [
        "-f",
        "dash",
        "-seg_duration",
        "4",
        "-use_timeline",
        "1",
        "-use_template",
        "1",
        "-init_seg_name",
        "segments/init_$RepresentationID$.mp4",
        "-media_seg_name",
        "segments/chunk_$RepresentationID$_$Number%05d$.m4s",
        "-adaptation_sets",
        adapt_sets,
        "stream.mpd",
    ]

    if verbose:
        cmd[cmd.index("-loglevel") + 1] = "info"
    return cmd


def main():
    # Orquesta el flujo:
    # 1) Validar ffmpeg/ffprobe y argumentos.
    # 2) Crear carpetas de salida.
    # 3) Generar HLS y luego DASH.
    parser = argparse.ArgumentParser(
        description="Create HLS and MPEG-DASH with 5 resolutions from one video."
    )
    parser.add_argument("--input", required=True, help="Input video file")
    parser.add_argument("--output", default="stream_out", help="Output base folder")
    parser.add_argument("--hls-dir", default=None, help="Override HLS output folder")
    parser.add_argument("--dash-dir", default=None, help="Override DASH output folder")
    parser.add_argument("--hls-only", action="store_true", help="Generate only HLS")
    parser.add_argument("--dash-only", action="store_true", help="Generate only DASH")
    parser.add_argument("--verbose", action="store_true", help="Verbose ffmpeg output")
    args = parser.parse_args()

    # Verifica dependencias.
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        print("ffmpeg/ffprobe not found in PATH. Please install ffmpeg.")
        sys.exit(1)

    # Comprueba que el input existe.
    input_path = Path(args.input)
    if not input_path.is_file():
        print(f"Input video not found: {input_path}")
        sys.exit(1)

    # Prepara carpetas de salida.
    if args.hls_only and args.dash_only:
        print("Please choose only one: --hls-only or --dash-only.")
        sys.exit(1)

    do_hls = not args.dash_only
    do_dash = not args.hls_only

    output_dir = Path(args.output)
    hls_dir = Path(args.hls_dir) if args.hls_dir else (output_dir / "hls")
    dash_dir = Path(args.dash_dir) if args.dash_dir else (output_dir / "dash")

    if do_hls:
        hls_dir.mkdir(parents=True, exist_ok=True)
        for i in range(len(LADDER)):
            (hls_dir / f"v{i}").mkdir(parents=True, exist_ok=True)

    if do_dash:
        dash_dir.mkdir(parents=True, exist_ok=True)
        (dash_dir / "segments").mkdir(parents=True, exist_ok=True)

    # Detecta si el input tiene audio.
    audio_present = has_audio(input_path)
    print(f"Audio present: {'yes' if audio_present else 'no'}")

    # Genera HLS si se solicito.
    if do_hls:
        print("Generating HLS...")
        run_cmd(build_hls_cmd(input_path, hls_dir, audio_present, args.verbose), args.verbose)

    # Genera MPEG-DASH si se solicito.
    if do_dash:
        print("Generating MPEG-DASH...")
        run_cmd(
            build_dash_cmd(input_path, dash_dir, audio_present, args.verbose),
            args.verbose,
            cwd=str(dash_dir),
        )

    print("Done.")
    if do_hls:
        print(f"HLS master: {hls_dir / 'master.m3u8'}")
    if do_dash:
        print(f"DASH MPD: {dash_dir / 'stream.mpd'}")


if __name__ == "__main__":
    main()
