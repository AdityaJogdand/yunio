"""Turn a spoken lost/found conversation into structured fields, plus the next follow-up question, with Gnani Evon.

Evon (huggingface.co/gnani/gnani-evon-v3.3-30B-A3B) runs behind an OpenAI-compatible server, e.g. per its model card:
  vllm serve gnani/gnani-evon-v3.3 --served-model-name model --max-model-len 131072 --port 8001 --trust-remote-code \
    --enable-auto-tool-choice --tool-call-parser qwen3_coder --reasoning-parser nano_v3
"""
import json
import os
import re

import httpx

EVON_URL = os.environ.get("EVON_URL", "http://localhost:8001/v1")
MODEL = os.environ.get("EVON_MODEL", "model")  # the --served-model-name

LANG_NAMES = {"hi": "Hindi", "mr": "Marathi", "gu": "Gujarati", "te": "Telugu", "kn": "Kannada", "ta": "Tamil",
              "bn": "Bengali", "pa": "Punjabi", "ml": "Malayalam", "en": "English"}

PROMPT = """You fill a missing-person form at a lost-and-found camp in India.
Below is a conversation at the camp desk ({kind} report, language {lang}). "Person:" lines are what was said to us;
"Yunio:" lines are follow-up questions we already asked. Extract only what the person said; leave a field empty if they didn't.
- name, nickname, village, district, place: copy exactly as spoken, in the transcript's own script. Do not translate or transliterate.
- village: the person's home town, where they come FROM ("सिन्नरच्या आहेत", "बहराइच से आए" -> village). Never put home town in place.
- place: where they got separated (missing) or where the person was found (found) at the mela, e.g. a ghat, gate or temple.
- clothing: what they wear, as spoken.
- clothing_tags: the same clothing as short lowercase English words (colours and garments), e.g. ["green", "saree"].
- age: a number as a string, approximate ages become the number ("about 70" -> "70").
- gender: "F" or "M" if clear from words like mother/aaji/beta, else "".
- phone: digits only, if said.
- question: ONE short, simple, polite follow-up question in {lang_name} (its own script), for the most important detail still
  missing, in this order: name, age, what they are wearing, village, where {where}{phone}. A missing report: ask the family about the
  missing person. A found report: speak gently and directly to the found person, who may be elderly or a child.
  Return "" if none of these are missing, or if the person already said they don't know it. Never ask twice for the same thing.
- question_en: the same question in English, for the volunteer.

Conversation:
{transcript}"""

_STR = {"type": "string"}
_KEYS = ("name", "nickname", "age", "gender", "clothing", "village", "district", "place", "phone", "question", "question_en")
SCHEMA = {
    "type": "object",
    "properties": {**{k: _STR for k in _KEYS}, "clothing_tags": {"type": "array", "items": _STR}},
    "required": [*_KEYS, "clothing_tags"],
}


def _json(text: str) -> dict:
    """The JSON object in the reply, in case a reasoning trace or code fence slips through."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def extract(transcript: str, lang: str, kind: str) -> dict:
    """`transcript` is one report, or the whole conversation so far as "Person: ..." / "Yunio: ..." lines."""
    prompt = PROMPT.format(
        kind=kind, lang=lang, lang_name=LANG_NAMES.get(lang[:2], "Hindi"), transcript=transcript,
        where="they got separated" if kind == "missing" else "they were found",
        phone=", the family's phone number" if kind == "missing" else "")
    key = os.environ.get("EVON_API_KEY")  # only if the server is behind auth
    try:
        r = httpx.post(
            f"{EVON_URL}/chat/completions",
            headers={"Authorization": f"Bearer {key}"} if key else {},
            json={
                "model": MODEL,
                "messages": [{"role": "user", "content": prompt + "\n\nReply with one JSON object only."}],
                # The card's deterministic mode; temperature 0 because this fills a form, not a chat.
                "chat_template_kwargs": {"enable_thinking": False},
                "temperature": 0, "repetition_penalty": 1.1, "max_tokens": 2048,
                "response_format": {"type": "json_schema", "json_schema": {"name": "report", "schema": SCHEMA}},
            },
            timeout=60,
        )
    except httpx.ConnectError:
        raise RuntimeError(f"Evon server not reachable at {EVON_URL}; set EVON_URL in .env")
    if r.is_error:
        raise RuntimeError(f"Evon {r.status_code}: {r.text[:300]}")
    out = _json(r.json()["choices"][0]["message"]["content"])
    out["gender"] = out.get("gender") if out.get("gender") in ("F", "M") else ""
    return out

if __name__ == "__main__":
    out = extract("Person: माझी आजी हरवली आहे. नाव सखुबाई पाटील, सगळे आक्का म्हणतात. वय सत्तर. हिरवी नऊवारी साडी. "
                  "गाव सिन्नर, जिल्हा नाशिक. रामकुंडाजवळ चुकामूक झाली.", "mr-IN", "missing")
    print(json.dumps(out, ensure_ascii=False, indent=1))
    assert out["gender"] == "F" and out["age"] == "70" and "सिन्नर" in out["village"], out
    # Only the phone is missing, so that's what it should ask for
    assert out["question"] and any(w in out["question_en"].lower() for w in ("phone", "mobile", "number")), out["question_en"]

    # Short report: it should ask, and the answer should fill the gap
    first = extract("Person: मेरे पिताजी खो गए हैं, नाम रामदास यादव।", "hi-IN", "missing")
    assert first["question"] and not first["age"], first
    convo = f"Person: मेरे पिताजी खो गए हैं, नाम रामदास यादव।\nYunio: {first['question']}\nPerson: सत्तर साल के हैं।"
    second = extract(convo, "hi-IN", "missing")
    assert second["age"] == "70" and second["name"] == "रामदास यादव", second
    print("asked:", first["question_en"], "| then:", second["question_en"])
    print("extract self-check ok")
