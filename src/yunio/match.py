"""Cross-script, sound-alike matching of lost vs found reports.

Reports are dicts produced by extraction. Names/villages stay as spoken (any script);
other fields are normalised by the extractor (gender "F"/"M", colours in English).
"""
import re

from indic_transliteration import sanscript
from rapidfuzz import fuzz

# Unicode block start -> sanscript scheme
_SCRIPTS = [
    (0x0900, sanscript.DEVANAGARI), (0x0980, sanscript.BENGALI), (0x0A00, sanscript.GURMUKHI),
    (0x0A80, sanscript.GUJARATI), (0x0B00, sanscript.ORIYA), (0x0B80, sanscript.TAMIL),
    (0x0C00, sanscript.TELUGU), (0x0C80, sanscript.KANNADA), (0x0D00, sanscript.MALAYALAM),
]

_DIGRAPHS = [("ph", "f"), ("kh", "k"), ("gh", "g"), ("chh", "c"), ("ch", "c"), ("jh", "j"),
             ("th", "t"), ("dh", "d"), ("bh", "b"), ("sh", "s"), ("ee", "i"), ("oo", "u"),
             ("w", "v"), ("z", "j"), ("q", "k"), ("x", "ks")]


def roman(text: str) -> str:
    """Any Indic script (or Latin) -> lowercase ASCII-ish roman."""
    out = []
    for word in text.split():
        cp = next((ord(c) for c in word if ord(c) >= 0x0900), None)
        if cp is not None and cp < 0x0D80:
            scheme = max(s for s in _SCRIPTS if s[0] <= cp)[1]
            # HK: 'z' is palatal sh; map it before lowercasing so it isn't read as Latin z
            word = sanscript.transliterate(word, scheme, sanscript.HK).replace("z", "s")
        out.append(word.lower())
    return re.sub(r"[^a-z ]", "", " ".join(out))


_LANG_SCRIPT = {
    "hi": sanscript.DEVANAGARI, "mr": sanscript.DEVANAGARI, "gu": sanscript.GUJARATI, "te": sanscript.TELUGU,
    "kn": sanscript.KANNADA, "ta": sanscript.TAMIL, "bn": sanscript.BENGALI, "pa": sanscript.GURMUKHI,
    "ml": sanscript.MALAYALAM,
}


_SCHWA_DROP = {sanscript.DEVANAGARI, sanscript.GUJARATI, sanscript.GURMUKHI, sanscript.BENGALI}
_HK_VOWELS = set("aAiIuUeoRMH")
_SCHWA_KEEP = {sanscript.TELUGU, sanscript.KANNADA, sanscript.TAMIL, sanscript.MALAYALAM}


def to_script(text: str, lang: str) -> str:
    """Write a name in the script of `lang` ("te-IN" -> Telugu), so an announcement reads naturally."""
    target = _LANG_SCRIPT.get(lang[:2])
    if target is None:  # English: plain roman
        return roman(text).title()
    out = []
    for word in text.split():
        cp = next((ord(c) for c in word if ord(c) >= 0x0900), None)
        if cp is not None and cp < 0x0D80:
            src = max(s for s in _SCRIPTS if s[0] <= cp)[1]
            if src == target:
                out.append(word)
                continue
            hk = sanscript.transliterate(word, src, sanscript.HK)
            # North Indian scripts drop a word-final inherent "a" (रामदास = Ramdas) unless it follows a
            # cluster (आदित्य = Aditya); write that consonant as silent so South Indian scripts don't voice it
            if src in _SCHWA_DROP and target in _SCHWA_KEEP and len(hk) > 2 and hk[-1] == "a" and hk[-2] not in _HK_VOWELS and hk[-3] in _HK_VOWELS:
                hk = hk[:-1]
            # A bare vowel after a vowel (बाई = bA+I) reads as a glide in South Indian scripts: బాయి, not బాఈ
            if target in _SCHWA_KEEP:
                hk = re.sub(r"(?<=[aAiIuUeo])([iI])", lambda m: "y" + m.group(1).lower(), hk)
            out.append(sanscript.transliterate(hk, sanscript.HK, target))
        else:  # ponytail: Latin spelled names go through HK as-is; good enough for common Indian names
            out.append(sanscript.transliterate(word.lower(), sanscript.HK, target))
    return " ".join(out)


def _norm(text: str) -> str:
    s = roman(text)
    for a, b in _DIGRAPHS:
        s = s.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", s)  # collapse doubles: "kamalla" -> "kamala"


def _skeleton(s: str) -> str:
    # ponytail: consonant skeleton handles schwa deletion (kamala/kamla); dialect-aware G2P if it misfires
    return " ".join(w[0] + re.sub(r"[aeiouy]", "", w[1:]) for w in s.split())


def _word_sim(a: str, b: str) -> float:
    return (fuzz.ratio(a, b) + fuzz.ratio(_skeleton(a), _skeleton(b))) / 200


def name_sim(a: str, b: str) -> float:
    """0..1 similarity of two names in any script. Each word of the shorter name is
    matched to its best word in the longer one, so a missing surname doesn't hurt."""
    wa, wb = _norm(a).split(), _norm(b).split()
    if not wa or not wb:
        return 0.0
    short, long_ = sorted((wa, wb), key=len)
    return sum(max(_word_sim(s, l) for l in long_) for s in short) / len(short)


# field -> weight. Only fields present in both reports count.
WEIGHTS = {"name": 0.35, "village": 0.2, "age": 0.15, "clothing": 0.1, "location": 0.1, "gender": 0.1}


def _say(sim: float, what: str) -> str:
    """Plain words a volunteer reads on the match card."""
    return f"same {what}" if sim >= 0.9 else f"similar {what}" if sim >= 0.6 else f"different {what}"


def score(lost: dict, found: dict) -> tuple[float, list[str]]:
    """Return (0..1 score, human-readable reasons)."""
    if lost.get("gender") and found.get("gender") and lost["gender"] != found["gender"]:
        return 0.0, ["gender differs"]
    parts, reasons = {}, []

    names_l = [n for n in (lost.get("name"), lost.get("nickname")) if n]
    names_f = [n for n in (found.get("name"), found.get("nickname")) if n]
    if names_l and names_f:
        parts["name"] = max(name_sim(a, b) for a in names_l for b in names_f)
        reasons.append(_say(parts["name"], "name"))
    if lost.get("village") and found.get("village"):
        parts["village"] = name_sim(lost["village"], found["village"])
        reasons.append(_say(parts["village"], "village"))
    if lost.get("age") and found.get("age"):
        d = abs(int(lost["age"]) - int(found["age"]))
        parts["age"] = 1.0 if d <= 5 else 0.5 if d <= 10 else 0.0
        reasons.append("similar age" if d <= 5 else f"{d} years apart")
    if lost.get("clothing") and found.get("clothing"):
        cl, cf = set(lost["clothing"]), set(found["clothing"])
        parts["clothing"] = len(cl & cf) / len(cl | cf)
        if cl & cf:
            reasons.append("both in " + " ".join(sorted(cl & cf)))
    if lost.get("location") and found.get("location"):
        parts["location"] = name_sim(lost["location"], found["location"])
    if lost.get("gender") and found.get("gender"):
        parts["gender"] = 1.0

    if not parts:
        return 0.0, []
    total = sum(WEIGHTS[k] for k in parts)
    return sum(WEIGHTS[k] * v for k, v in parts.items()) / total, reasons


def rank(lost: dict, founds: list[dict], k=3):
    """Top-k found reports for a lost report: [(score, reasons, found), ...]."""
    scored = [(*score(lost, f), f) for f in founds]
    return sorted(scored, key=lambda x: -x[0])[:k]


if __name__ == "__main__":
    # Same person across scripts / spellings
    assert name_sim("कमला देवी", "Kamla Devi") > 0.85, name_sim("कमला देवी", "Kamla Devi")
    assert name_sim("ಬಾಬುರಾವ್", "Baburao") > 0.8, name_sim("ಬಾಬುರಾವ್", "Baburao")
    assert name_sim("సఖుబాయి", "सखुबाई") > 0.8, name_sim("సఖుబాయి", "सखुबाई")
    # Different people stay apart
    assert name_sim("Kamla Devi", "Radha Bai") < 0.5, name_sim("Kamla Devi", "Radha Bai")

    lost = {"name": "सखुबाई पाटील", "nickname": "आक्का", "age": 70, "gender": "F",
            "clothing": ["green", "nauvari"], "village": "सिन्नर", "location": "Ramkund"}
    right = {"name": "ಸಖುಬಾಯಿ", "age": 72, "gender": "F", "clothing": ["green"], "village": "Sinnar"}
    decoy = {"name": "Sakina Bano", "age": 35, "gender": "F", "clothing": ["black"], "village": "Malegaon"}
    man = {"name": "Sakharam", "age": 70, "gender": "M", "village": "Sinnar"}
    top = rank(lost, [decoy, man, right])
    assert top[0][2] is right and top[0][0] > 0.8, top
    print("match self-check ok:", f"{top[0][0]:.0%}", top[0][1])
