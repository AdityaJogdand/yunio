"""Thin client for Gnani Prisma (STT) and Timbre (TTS). Docs: https://docs.gnani.ai"""
import json
import os
import time

import httpx

BASE = "https://api.vachana.ai"


def _headers():
    key = os.environ.get("GNANI_API_KEY")
    if not key:
        raise RuntimeError("GNANI_API_KEY not set (copy .env.example to .env)")
    return {"X-API-Key-ID": key}


def stt(audio: bytes, lang="indic-auto", model="prisma-v3.0", fmt="verbatim",
        keyterms=None, previous_text=None, filename="audio.wav") -> dict:
    """Transcribe a <=30s clip. Returns the API JSON plus our own `_latency` (s).

    v3.0 (launched Oct 2026) sometimes returns 504; retry once, then fall back to v2.5,
    which ignores v3.0-only context fields. The response's `model` says which one answered.
    """
    data = {"model": model, "language_code": lang, "format": fmt}
    if keyterms:
        data["keyterms"] = json.dumps(keyterms[:200])
    if previous_text:
        data["previous_text"] = previous_text
    fallback = {"language_code": lang if lang != "indic-auto" else "hi-IN", "format": fmt}
    t = time.perf_counter()
    for attempt in (data, data, fallback):
        try:
            r = httpx.post(f"{BASE}/stt/v3", headers=_headers(), data=attempt,
                           files={"audio_file": (filename, audio)}, timeout=60)
        except httpx.TimeoutException:
            continue
        if r.status_code < 500:
            break
    r.raise_for_status()
    return r.json() | {"_latency": time.perf_counter() - t}


def tts(text: str, lang: str, voice="Shivani", model="timbre-v3.0", speed=1.0,
        container="wav", sample_rate=16000) -> bytes:
    """Synthesize speech. container='mulaw' gives 8 kHz telephone audio."""
    audio_config = {"container": container}
    if container not in ("mulaw", "alaw"):
        audio_config["sample_rate"] = sample_rate
    r = httpx.post(f"{BASE}/api/v1/tts/inference", headers=_headers(), timeout=60,
                   json={"text": text, "model": model, "voice": voice,
                         "language": lang, "speed": speed, "audio_config": audio_config})
    r.raise_for_status()
    return r.content
