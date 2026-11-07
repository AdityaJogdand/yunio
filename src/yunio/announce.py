"""Fixed announcement templates: only name, village and camp are filled in, so nothing is machine-translated
at broadcast time. A volunteer approves before any of these is played.

ponytail: templates written by us, not native speakers; get each language checked before real use.
"""
from yunio.match import to_script

TEMPLATES = {
    "hi-IN": ("हिंदी", "{village} से आए {name} के परिवार वाले ध्यान दें। {name} कैंप नंबर {camp} पर सुरक्षित हैं। कृपया वहाँ आएँ।"),
    "mr-IN": ("मराठी", "{village} येथून आलेल्या {name} यांच्या नातेवाईकांनी लक्ष द्यावे. {name} कॅम्प क्रमांक {camp} येथे सुरक्षित आहेत. कृपया तिथे या."),
    "gu-IN": ("ગુજરાતી", "{village}થી આવેલા {name}ના પરિવારજનો ધ્યાન આપે. {name} કેમ્પ નંબર {camp} પર સુરક્ષિત છે. કૃપા કરીને ત્યાં આવો."),
    "te-IN": ("తెలుగు", "{village} నుండి వచ్చిన {name} కుటుంబ సభ్యులు గమనించండి. {name} క్యాంప్ నంబర్ {camp} వద్ద సురక్షితంగా ఉన్నారు. దయచేసి అక్కడికి రండి."),
    "kn-IN": ("ಕನ್ನಡ", "{village} ಊರಿನಿಂದ ಬಂದ {name} ಅವರ ಕುಟುಂಬದವರು ಗಮನಿಸಿ. {name} ಶಿಬಿರ ಸಂಖ್ಯೆ {camp}ರಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿದ್ದಾರೆ. ದಯವಿಟ್ಟು ಅಲ್ಲಿಗೆ ಬನ್ನಿ."),
    "ta-IN": ("தமிழ்", "{village} ஊரிலிருந்து வந்த {name} அவர்களின் குடும்பத்தினர் கவனிக்கவும். {name} முகாம் எண் {camp}-ல் பாதுகாப்பாக இருக்கிறார். தயவுசெய்து அங்கு வாருங்கள்."),
    "bn-IN": ("বাংলা", "{village} থেকে আসা {name}-এর পরিবারের লোকজন মনোযোগ দিন। {name} ক্যাম্প নম্বর {camp}-এ নিরাপদে আছেন। অনুগ্রহ করে সেখানে আসুন।"),
    "pa-IN": ("ਪੰਜਾਬੀ", "{village} ਤੋਂ ਆਏ {name} ਦੇ ਪਰਿਵਾਰ ਵਾਲੇ ਧਿਆਨ ਦੇਣ। {name} ਕੈਂਪ ਨੰਬਰ {camp} 'ਤੇ ਸੁਰੱਖਿਅਤ ਹਨ। ਕਿਰਪਾ ਕਰਕੇ ਉੱਥੇ ਆਓ।"),
    "ml-IN": ("മലയാളം", "{village} എന്ന സ്ഥലത്തുനിന്ന് വന്ന {name} എന്നവരുടെ കുടുംബാംഗങ്ങൾ ശ്രദ്ധിക്കുക. {name} ക്യാമ്പ് നമ്പർ {camp}-ൽ സുരക്ഷിതരാണ്. ദയവായി അവിടേക്ക് വരൂ."),
}

# After the family's own language, the languages most pilgrims at a Nashik mela speak
DEFAULT_ORDER = ["mr-IN", "hi-IN", "gu-IN", "te-IN", "kn-IN"]


def build(person: dict, camp: int, family_lang: str, n=5) -> list[dict]:
    """Announcements for the family of `person` (the found one, safe at `camp`), family's language first."""
    langs = [family_lang] + [l for l in DEFAULT_ORDER if l != family_lang]
    out = []
    for lang in [l for l in langs if l in TEMPLATES][:n]:
        label, tpl = TEMPLATES[lang]
        name = to_script(person.get("name") or "", lang)
        village = to_script(person.get("village") or "", lang)
        out.append({"lang": lang, "label": label, "text": tpl.format(name=name, village=village, camp=camp)})
    return out


if __name__ == "__main__":
    a = build({"name": "रामदास यादव", "village": "बहराइच"}, 2, "hi-IN")
    assert a[0]["lang"] == "hi-IN" and "रामदास यादव" in a[0]["text"] and len(a) == 5, a
    assert "రామదాస్" in next(x for x in a if x["lang"] == "te-IN")["text"]
    s = build({"name": "सखुबाई पाटील", "village": "सिन्नर"}, 4, "mr-IN")
    assert "సఖుబాయి" in next(x for x in s if x["lang"] == "te-IN")["text"], s
    assert "ಸಖುಬಾಯಿ" in next(x for x in s if x["lang"] == "kn-IN")["text"], s
    assert "સખુબાઈ" in next(x for x in s if x["lang"] == "gu-IN")["text"], s  # north scripts unchanged
    for x in a:
        print(x["label"], "|", x["text"])
    print("announce self-check ok")
