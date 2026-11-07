"""Day-1 API check: Timbre speaks a lost-person report, Prisma hears it back.
Run: uv run --env-file .env scripts/smoke.py
"""
from pathlib import Path

from yunio import gnani

OUT = Path("out")
OUT.mkdir(exist_ok=True)

CASES = [
    ("mr-IN", "माझी आजी हरवली आहे. नाव सखुबाई पाटील, वय सत्तर, हिरवी नऊवारी साडी, गाव सिन्नर."),
    ("hi-IN", "मेरी माँ कमला देवी खो गई हैं, सत्तर साल की हैं, हरी साड़ी पहनी है, गाँव सीतापुर."),
]

for lang, text in CASES:
    wav = gnani.tts(text, lang)
    (OUT / f"smoke_{lang}.wav").write_bytes(wav)
    res = gnani.stt(wav, lang=lang)
    print(f"[{lang}] tts {len(wav)} bytes | stt {res['_latency']:.2f}s "
          f"detected={res.get('detected_language_code')}")
    print("  said :", text)
    print("  heard:", res["transcript"])
