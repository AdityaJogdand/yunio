<p align="center">
  <img src="brag-output/yunio-thumbnail.png" alt="Yunio: voice lost-and-found for mass gatherings, built on Gnani Prisma + Timbre" width="480">
</p>

# Yunio

A voice-first lost-and-found desk for mass gatherings such as the Kumbh Mela, the Wari or Ganesh visarjan.

A family reports their grandmother missing in Marathi. A volunteer at another camp registers her in Kannada. Yunio matches the two reports across scripts and announces the match in five languages.

Built for Gnani AI's Great Indian AI Internship Challenge. #GnaniAI #GreatIndianAIInternshipChallenge

> Prototype. Synthetic data only. Not a government service.

## How it works

The whole pipeline runs on Gnani models: **Prisma** hears the report, **Evon** understands it, and **Timbre** speaks the announcement.

1. **Speak the report.** A volunteer records the family (or the found person) in their own language. **Gnani Prisma** transcribes it.
2. **Fill the form.** **Gnani Evon** ([`gnani-evon-v3.3-30B-A3B`](https://huggingface.co/gnani/gnani-evon-v3.3-30B-A3B), Gnani's open Indic LLM) pulls out the name, age, clothing, village and where they were separated or found. It then asks one short follow-up question in the speaker's language, at most three per report. The volunteer confirms before anything is saved.
3. **Match across scripts.** Names and villages stay in the script they were spoken in. The matcher transliterates them to a common phonetic form, so सखुबाई and ಸಖುಬಾಯಿ score as the same name. Age, gender and clothing add to the score. Strong matches go to a volunteer for review.
4. **Announce.** Fixed templates fill in only the name, village and camp number, so nothing is machine-translated at broadcast time. **Gnani Timbre** speaks them, in the family's language first, after a volunteer approves.

## Repo layout

| Path | What |
|---|---|
| `src/yunio/server.py` | FastAPI backend (intake, cases, matches, review, announce, TTS) |
| `src/yunio/gnani.py` | Gnani Prisma STT and Timbre TTS client |
| `src/yunio/extract.py` | Transcript → structured fields + follow-up question (Gnani Evon, JSON schema output) |
| `src/yunio/match.py` | Cross-script, sound-alike matching |
| `src/yunio/announce.py` | Announcement templates in 9 Indian languages |
| `data/seed.json` | Synthetic cases |
| `mobile/` | Expo / React Native volunteer app |
| `scripts/smoke.py` | Round-trip check: Timbre speaks a report, Prisma hears it back |
| `brag-output/` | Launch video composition and thumbnail |

## Run it

Evon (needs a GPU; command from the [model card](https://huggingface.co/gnani/gnani-evon-v3.3-30B-A3B)):

```sh
pip install -U "vllm>=0.12.0"
vllm serve gnani/gnani-evon-v3.3 --served-model-name model --max-model-len 131072 --port 8001 \
  --trust-remote-code --enable-auto-tool-choice --tool-call-parser qwen3_coder --reasoning-parser nano_v3
```

Backend (Python 3.12+, [uv](https://docs.astral.sh/uv/)):

```sh
cp .env.example .env   # add GNANI_API_KEY and YUNIO_TOKEN; EVON_URL points at your Evon server
uv sync
uv run --env-file .env uvicorn yunio.server:app --host 0.0.0.0 --port 8000
uv run --env-file .env scripts/smoke.py   # optional: check the Gnani keys work
```

App:

```sh
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-machine-ip>:8000 EXPO_PUBLIC_API_TOKEN=<same as YUNIO_TOKEN> npx expo start
```

If you leave out `EXPO_PUBLIC_API_URL`, the app runs in demo mode on synthetic data.

## Security

- Every API call needs the shared `X-Yunio-Token`, so others on the camp Wi-Fi can't read cases, close them or spend the Gnani key. The backend refuses to start without one.
- New reports keep only the form's fields, each capped at 200 characters; a client can't set a case's status or camp.
- Recordings over 2 MB are rejected.
- `uv run python scripts/check_security.py` checks all of the above.

## Limits

- Cases are kept in memory and reset when the server restarts.
- The announcement templates were not written by native speakers. Each language needs checking before real use.
- One shared token for all volunteers, over plain HTTP on the local network. A real deployment needs HTTPS, per-volunteer logins and rate limits.
