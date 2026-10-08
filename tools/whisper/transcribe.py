"""Local transcription fallback (faster-whisper, CPU, int8). Used when Groq is unavailable.

Usage: python transcribe.py <media-path> [model]
Prints one JSON object: {"text", "duration", "segments": [{"start", "end", "text"}]}
"""
import json
import sys

from faster_whisper import WhisperModel

# The words this cohort says that a general model has never heard. Whisper conditions on this as if
# it were the transcript so far, so it biases the vocabulary rather than instructing the model.
# Without it the German process nouns come back as English near-homophones: "Anerkennung" as "an
# according", "Chancenkarte" as "chancing cart". Must stay a word list — a prompt with sentences in
# it makes the model continue them when the audio goes quiet.
PROMPT = (
    "Educaro, Germany, Anerkennung, Chancenkarte, Ausbildung, Bewerbung, Aufenthaltstitel, "
    "Anmeldung, Bürgeramt, Blocked account, Sperrkonto, APS, uni-assist, Studienkolleg, Goethe, "
    "telc, ÖSD, TestDaF, IELTS, CEFR, A1, A2, B1, B2, C1, Pflegefachkraft, Krankenpflege, GNM, "
    "B.Tech, CGPA, RWTH Aachen, TUM, TU Darmstadt, Kochi, Pune, Kerala, visa."
)

# Whisper's stock phrases on silence, mirrored from media.service.ts. On near-silent audio the
# model falls back on what it saw most in training: sign-offs from captioned video.
STOCK = {
    "thank you",
    "thanks",
    "thank you.",
    "thanks.",
    "thank you very much.",
    "thank you for watching.",
    "thanks for watching.",
    "please subscribe.",
    "you",
    "you.",
    "bye.",
    "bye",
    "[music]",
    "[applause]",
    "[silence]",
    "[blank_audio]",
    "[inaudible]",
}


def usable(text: str) -> bool:
    return bool(text) and text.strip().lower() not in STOCK


def main() -> None:
    path = sys.argv[1]
    # `small.en` over `base.en`: base mangles accented English badly enough that the agent then
    # reasons over words nobody said, and this path only runs when there is no Groq key, so the
    # extra CPU second is the cheaper mistake. Override with LOCAL_WHISPER_MODEL.
    model_name = sys.argv[2] if len(sys.argv) > 2 else "small.en"
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        path,
        language="en",
        vad_filter=True,
        # beam_size=1 is greedy decoding, which is what invents words on unclear audio. 5 is the
        # faster-whisper default and the difference is a second or two on a two-minute note.
        beam_size=5,
        temperature=0,
        initial_prompt=PROMPT,
        # Stop the decoder free-running into invented sentences when it loses the timeline.
        condition_on_previous_text=False,
        compression_ratio_threshold=2.4,
        no_speech_threshold=0.6,
    )

    segs = []
    for s in segments:
        text = s.text.strip()
        if not usable(text):
            continue
        # A decoder stuck in a loop repeats one sentence to the end of the file.
        if segs and segs[-1]["text"].strip().lower() == text.lower():
            continue
        segs.append({"start": round(s.start, 2), "end": round(s.end, 2), "text": text})

    print(json.dumps({"text": " ".join(s["text"] for s in segs), "duration": info.duration, "segments": segs}))


if __name__ == "__main__":
    main()
