"""Yunio backend: the phone app sends recordings here; Gnani + Gemini keys stay on this machine.
Run: uv run --env-file .env uvicorn yunio.server:app --host 0.0.0.0 --port 8000
"""
import json
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.responses import Response

from yunio import announce, gnani, match
from yunio.extract import extract

app = FastAPI(title="Yunio")

# ponytail: in-memory store seeded from synthetic data; resets on restart. SQLite when cases must survive.
CASES: list[dict] = json.loads((Path(__file__).parents[2] / "data" / "seed.json").read_text())
CAMP = 3  # the camp this backend serves; new reports are filed here
REVIEW_AT = 0.6  # matches at or above this score go to a volunteer for review
MAX_QUESTIONS = 3  # follow-ups per report, so a family isn't kept at the desk
REJECTED: set[tuple[str, str]] = set()  # (lost, found) pairs a volunteer said are different people


def _case(case_id: str) -> dict:
    case = next((c for c in CASES if c["id"] == case_id), None)
    if not case:
        raise HTTPException(404, f"No case {case_id}")
    return case


def _for_matching(c: dict) -> dict:
    """App fields -> what match.score expects."""
    age = "".join(ch for ch in str(c.get("age", "")) if ch.isdigit())
    return {
        "name": c.get("name"),
        "nickname": c.get("nickname"),
        "age": int(age) if age else None,
        "gender": c.get("gender") or None,
        "clothing": c.get("clothing_tags") or (c["clothing"] if isinstance(c.get("clothing"), list) else None),
        "village": c.get("village"),
        "location": c.get("place") or c.get("location"),
    }


def _matches(case: dict, k=3) -> list[dict]:
    other = [c for c in CASES if c["kind"] != case["kind"] and c.get("status", "open") == "open"]
    norm = [_for_matching(c) for c in other]
    source = {id(n): c for n, c in zip(norm, other)}  # rank returns the dicts we passed in
    return [
        {"id": source[id(n)]["id"], "name": source[id(n)].get("name"), "score": round(s, 2), "reasons": reasons}
        for s, reasons, n in match.rank(_for_matching(case), norm, k)
        if s > 0
    ]


@app.post("/api/intake")
async def intake(audio: UploadFile, lang: str = Form(...), kind: str = Form(...), history: str = Form("")):
    """Recording -> Prisma transcript -> Gemini fields + the next follow-up question.

    `history` is the conversation so far ("Person: ..." / "Yunio: ..." lines); each answer is re-read with it,
    so the profile always reflects everything said. The volunteer confirms before anything is saved."""
    data = await audio.read()
    if not data:
        raise HTTPException(400, "Empty recording")
    heard = gnani.stt(data, lang=lang, filename=audio.filename or "intake.m4a")
    transcript = heard.get("transcript", "").strip()
    if not transcript:
        raise HTTPException(422, "No speech heard")
    try:
        convo = f"{history}\nPerson: {transcript}".strip()
        fields = extract(convo, lang, "missing" if kind == "lost" else "found")
    except RuntimeError as e:  # missing key: say so instead of a bare 500
        raise HTTPException(503, str(e))
    asked = history.count("Yunio:")
    q, q_en = fields.pop("question", ""), fields.pop("question_en", "")
    return {
        "transcript": transcript,
        "question": {"text": q, "en": q_en} if q and asked < MAX_QUESTIONS else None,
        "lang": heard.get("detected_language_code") or lang,
        "model": heard.get("model"),
        "latency": round(heard["_latency"], 2),
        "profile": fields,
    }


@app.post("/api/cases")
def create_case(case: dict):
    kind = case.get("kind")
    if kind not in ("lost", "found"):
        raise HTTPException(400, "kind must be lost or found")
    n = max(int(c["id"][2:]) for c in CASES) + 1
    case["id"] = f"{'L' if kind == 'lost' else 'F'}-{n:04d}"
    case.setdefault("camp", CAMP)
    case["time"] = datetime.now().strftime("%H:%M")
    CASES.append(case)
    return {"id": case["id"], "matches": _matches(case)}


@app.get("/api/cases")
def list_cases():
    return CASES


@app.get("/api/cases/{case_id}/matches")
def case_matches(case_id: str):
    return _matches(_case(case_id))


def _open(c: dict) -> bool:
    return c.get("status", "open") == "open"


@app.get("/api/review")
def review():
    """Likely pairs waiting for a volunteer, best first: each open missing report with its best open match.
    A found person can appear twice when two reports describe them (e.g. two relatives reported separately)."""
    pairs = []
    for lost in (c for c in CASES if c["kind"] == "lost" and _open(c)):
        for m in _matches(lost, k=3):
            found = _case(m["id"])
            if m["score"] >= REVIEW_AT and _open(found) and (lost["id"], found["id"]) not in REJECTED:
                pairs.append({"lost": lost, "found": found, "score": m["score"], "reasons": m["reasons"]})
                break
    return sorted(pairs, key=lambda p: -p["score"])


@app.get("/api/pair")
def pair(lost: str, found: str):
    l, f = _case(lost), _case(found)
    s, reasons = match.score(_for_matching(l), _for_matching(f))
    return {"lost": l, "found": f, "score": round(s, 2), "reasons": reasons}


@app.get("/api/announce")
def announcement(lost: str, found: str):
    """Approved-template announcements telling the family where their person is safe."""
    l, f = _case(lost), _case(found)
    # Use the family's own words for name and village: that's what they'll recognise
    person = {"name": l.get("name") or f.get("name"), "village": l.get("village") or f.get("village")}
    return announce.build(person, f.get("camp", CAMP), l.get("lang", "hi-IN"))


@app.post("/api/reunite")
def reunite(body: dict):
    for case_id in (body.get("lost"), body.get("found")):
        _case(case_id)["status"] = "reunited"
    return {"ok": True}


@app.post("/api/reject")
def reject(body: dict):
    """Volunteer says these two are different people: stop suggesting the pair."""
    _case(body.get("lost")), _case(body.get("found"))
    REJECTED.add((body["lost"], body["found"]))
    return {"ok": True}


@app.get("/api/tts")
def tts(text: str, lang: str):
    """Timbre speech for read-back; v3.0 voices speak all 10 languages."""
    return Response(gnani.tts(text[:500], lang), media_type="audio/wav")
