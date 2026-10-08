"""Local transcription fallback (faster-whisper, CPU, int8). Used when Groq is unavailable.

Usage: python transcribe.py <media-path> [model]
Prints one JSON object: {"text", "duration", "segments": [{"start", "end", "text"}]}
"""
import json
import sys

from faster_whisper import WhisperModel


def main() -> None:
    path = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else "base.en"
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(path, language="en", vad_filter=True, beam_size=1)
    segs = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()} for s in segments]
    print(json.dumps({"text": " ".join(s["text"] for s in segs), "duration": info.duration, "segments": segs}))


if __name__ == "__main__":
    main()
