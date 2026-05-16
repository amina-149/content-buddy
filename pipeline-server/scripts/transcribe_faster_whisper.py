#!/usr/bin/env python3
"""
Local speech-to-text (no cloud API). Requires: pip install faster-whisper
Usage: transcribe_faster_whisper.py <input_video_or_audio> <output.srt> [model_size]
"""
from __future__ import annotations

import os
import sys


def format_ts(seconds: float) -> str:
    if seconds < 0:
        seconds = 0
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int(round((seconds - int(seconds)) * 1000))
    if ms >= 1000:
        ms = 0
        s += 1
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: transcribe_faster_whisper.py <input_media> <output.srt> [model]", file=sys.stderr)
        return 2
    inp = os.path.abspath(sys.argv[1])
    outp = os.path.abspath(sys.argv[2])
    model_size = sys.argv[3] if len(sys.argv) > 3 else os.environ.get("LOCAL_WHISPER_MODEL", "base")

    if not os.path.isfile(inp):
        print(f"input not found: {inp}", file=sys.stderr)
        return 1

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper not installed. Run: pip install faster-whisper", file=sys.stderr)
        return 1

    device = os.environ.get("LOCAL_WHISPER_DEVICE", "cpu")
    compute = os.environ.get("LOCAL_WHISPER_COMPUTE", "int8")
    model = WhisperModel(model_size, device=device, compute_type=compute)

    segments, _info = model.transcribe(inp, beam_size=5, language=os.environ.get("LOCAL_WHISPER_LANG") or None)

    lines: list[str] = []
    for i, seg in enumerate(segments, start=1):
        text = (seg.text or "").strip()
        if not text:
            continue
        lines.append(str(i))
        lines.append(f"{format_ts(seg.start)} --> {format_ts(seg.end)}")
        lines.append(text)
        lines.append("")

    with open(outp, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).strip() + "\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
