<p align="center">
  <img src="brag-output/yunio-thumbnail.png" alt="Yunio: voice lost-and-found for mass gatherings, built on Gnani Prisma + Timbre" width="480">
</p>

# Yunio

A voice-first lost-and-found desk for mass gatherings such as the Kumbh Mela, the Wari or Ganesh visarjan.

A family reports their grandmother missing in Marathi. A volunteer at another camp registers her in Kannada. Yunio matches the two reports across scripts and announces the match in five languages.

Built for Gnani AI's Great Indian AI Internship Challenge. #GnaniAI #GreatIndianAIInternshipChallenge

> Prototype. Synthetic data only. Not a government service.

## How it works

1. **Speak the report.** A volunteer records the family (or the found person) in their own language. **Gnani Prisma** transcribes it.
2. **Fill the form.** Gemini pulls out the name, age, clothing, village and where they were separated or found. It then asks one short follow-up question in the speaker's language, at most three per report. The volunteer confirms before anything is saved.
3. **Match across scripts.** Names and villages stay in the script they were spoken in. The matcher transliterates them to a common phonetic form, so सखुबाई and ಸಖುಬಾಯಿ score as the same name. Age, gender and clothing add to the score. Strong matches go to a volunteer for review.
4. **Announce.** Fixed templates fill in only the name, village and camp number, so nothing is machine-translated at broadcast time. **Gnani Timbre** speaks them, in the family's language first, after a volunteer approves.

## Repo layout

| Path | What |
|---|---|
| `src/yunio/server.py` | FastAPI backend (intake, cases, matches, review, announce, TTS) |
| `src/yunio/gnani.py` | Gnani Prisma STT and Timbre TTS client |
| `src/yunio/extract.py` | Transcript → structured fields + follow-up question (Gemini, JSON mode) |
| `src/yunio/match.py` | Cross-script, sound-alike matching |
| `src/yunio/announce.py` | Announcement templates in 9 Indian languages |
| `data/seed.json` | Synthetic cases |
| `mobile/` | Expo / React Native volunteer app |
| `scripts/smoke.py` | Round-trip check: Timbre speaks a report, Prisma hears it back |
| `brag-output/` | Launch video composition and thumbnail |

## Run it

Backend (Python 3.12+, [uv](https://docs.astral.sh/uv/)):

```sh
cp .env.example .env   # add GNANI_API_KEY and GEMINI_API_KEY
uv sync
uv run --env-file .env uvicorn yunio.server:app --host 0.0.0.0 --port 8000
uv run --env-file .env scripts/smoke.py   # optional: check the Gnani keys work
```

App:

```sh
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-machine-ip>:8000 npx expo start
```

If you leave out `EXPO_PUBLIC_API_URL`, the app runs in demo mode on synthetic data.

## Limits

- Cases are kept in memory and reset when the server restarts.
- The announcement templates were not written by native speakers. Each language needs checking before real use.
