# Hyperframes Composition Brief: Yunio

## Objective
A short, polished LinkedIn demo of Yunio for the Gnani AI hackathon, voiced by Gnani Timbre.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: square, 1080x1080
- Duration: 35s (voice-paced; see plan)

## Source Material
- Project root: repo root. Files read: mobile/src/ui.tsx, mobile/src/app/{index,intake,match}.tsx, src/yunio/{announce,match,extract}.py
- Product name: Yunio
- Strongest claim: one report in Marathi, found in Kannada, matched and announced in five languages
- Copy that must appear verbatim: "Someone is missing", "I found someone", "They said", "Yunio asks", "Is this the same person?", "Tell the family", "Reunited", the real announcement texts from `announce.build`
- All names and data are synthetic (seed data); no real people, phone numbers or hosts

## Creative Direction
- Tone: polished; quiet, human product film on black
- Hook: "Every few minutes / someone gets separated." with the missing counter
- Outro: Reunited → Yunio wordmark → "Built on Gnani Prisma + Timbre"
- Avoid: generic SaaS language, abstract filler, government branding, any disaster imagery

## Visual Identity
App tokens from mobile/src/ui.tsx: bg #000, card #0E0E0E, rim rgba(255,255,255,.1), radius 28, white text, muted .6 / quiet .42, missing #FF6B3D, found #30D158, review #FFB340. System UI fonts (generic families only, so Indic scripts fall back to system fonts).

## Storyboard
See `brag-plan.md`. Scenes: Hook 0–5.6 · Reveal 5.6–9.8 · Conversation 9.8–19.2 · Match 19.2–23.4 · Announcement 23.4–31.0 · Reunited 31.0–35.0

## Audio
- Voice: Gnani Timbre clips in `assets/vo/` (vo1–vo6 narration; q.wav and ann.wav are product audio), each placed at its scene's start
- Music: vol-12 at ~0.12, fading out at the end
- Cue locks: 19.66 match score, 23.46 first announcement card, 32.74 wordmark
- SFX (sparse): interface/drop_001 on the Yunio-asks bubble, casino/card-fan-1 on the announcement cards, impact/impactBell_heavy_000 on Reunited
