# Brag Plan: Yunio

## What is this app?
A voice-first lost-and-found for mass gatherings: a camp volunteer listens, Gnani Prisma transcribes the family in their own language, Yunio asks back for missing details, matches reports across camps and scripts, and Gnani Timbre announces the reunion in every language.

## The angle
One grandmother, सुमन, followed end to end. Her family reports her in Marathi; she is found at another camp and registered in Kannada as ಸುಮನ್. The video shows the real app doing each step, and the product's own Timbre audio (the follow-up question, the announcement) is heard inside the video. It's a quiet, human product film for a hackathon audience.

## Hook (first 2-3 seconds)
"Every few minutes" → "someone gets separated." in huge type over black, with the app's own "missing" counter ticking up.

## Key moments (the middle)
- The conversation: the Marathi transcript appears in a "They said" bubble, then the white "Yunio asks" bubble pops in *as Timbre speaks it* ("आजींनी काय घातलं आहे?").
- The match: सुमन गायकवाड (मराठी, Camp 3) ↔ ಸುಮನ್ (ಕನ್ನಡ, Camp 4), with the score counting up to 97% and four plain reasons arriving one by one.
- The announcement: five language cards fan in; the Marathi one plays and Timbre is heard.

## Outro / punchline
A green check, "Reunited", then the Yunio wordmark and "Built on Gnani Prisma + Timbre".

## User flow worth showing
Report by voice (with follow-up question) → cross-script match → multilingual announcement → reunited.

## Tone
- Preset: polished
- Creative direction: quiet, human product film on black
- Interpretation: few words on screen, long holds, slow crossfades, voice carries the story, colour only for status.

## Format: square — 1080x1080 (safe in the LinkedIn feed on mobile and desktop)
## Duration: ~35s. Over the usual 15–25s on purpose: the voiceover sets the pace and two scenes play real product audio. Every scene is as short as its narration line allows.

## Visual identity (from the project: mobile/src/ui.tsx)
- Background: #000000; cards #0E0E0E with hairline rim rgba(255,255,255,0.1); 28px continuous corners
- Text: #FFFFFF; muted rgba(255,255,255,0.6); quiet rgba(255,255,255,0.42)
- Status accents: missing #FF6B3D, found #30D158, review #FFB340
- Display / body font: system UI (SF Pro), SF Rounded for numbers; system Indic fonts for scripts
- Strongest visual element: the phone screens (Home, conversation thread, match card, announcement list)

## Share copy (draft)
Yunio: a family reports a missing grandmother in Marathi, a volunteer at another camp registers her in Kannada, and Yunio matches them and announces it in five languages, voiced by Gnani Prisma + Timbre.

## Voiceover script (Gnani Timbre, en-IN, voice Shivani)
1. "Every few minutes at a mass gathering like the Kumbh Mela, someone gets separated from their family." (5.52s)
2. "This is Yunio. Every camp, connected by voice." (3.60s)
3. "Families speak in their own language. Gnani Prisma writes it down. If something is missing, Yunio asks." (6.88s)
   — product audio (Timbre, mr-IN): "आजींनी काय घातलं आहे?" (1.36s)
4. "Then it matches reports across every camp, even across scripts." (3.84s)
5. "Gnani Timbre announces it, in every language." (3.44s)
   — product audio (Timbre, mr-IN): "सुमन गायकवाड कॅम्प क्रमांक चार येथे सुरक्षित आहेत." (3.68s)
6. "Yunio. So no one stays lost for long." (2.96s)
"Gnani" is spelled "Gyaani" in the TTS text so Timbre pronounces the brand correctly.

## Audio direction
- Role: warm bed under a voiceover
- Music: happy-beats-business-moves-vol-12 (steady, clean; polished)
- Music treatment: low bed (~0.12) under the voice, short fade out at the end
- Music cue guidance: preset `vol-12.music-cues.json`, 110 BPM. Strong cues: 19.66 (match score lands), 23.46 (announcement cards), 32.74 (wordmark)
- Audio-reactive treatment: none. The voice carries it; a reactive glow would compete.
- SFX posture: sparse (3): soft drop on the Yunio-asks bubble, card fan on the announcement cards, one bell on Reunited
- Restraint rule: nothing over the voice except the product's own audio

## Storyboard
### Scene 1 — Hook — 0–5.6s
"Every few minutes" (muted), "someone gets separated." (huge). Small "missing" counter with an orange dot ticks 9 → 12.
Transition: soft crossfade.

### Scene 2 — Reveal — 5.6–9.8s
Left: Yunio wordmark, "Yunio", "Voice lost-and-found for mass gatherings". Right: phone rises with the Home screen (Today ring, "Someone is missing / कोणी हरवले आहे", "I found someone / कोणी सापडले आहे").

### Scene 3 — The conversation — 9.8–19.2s
Phone: New report, Missing selected, मराठी chip on. "They said" bubble types the Marathi report; a "Gnani Prisma · 0.8s" tag lands. At 17.2s the white "Yunio asks" bubble pops in as Timbre speaks it, with the English line beneath. Left captions, one at a time: "They speak." / "Prisma writes." / "Yunio asks back."

### Scene 4 — The match — 19.2–23.4s
Phone: "Is this the same person?" Missing सुमन गायकवाड (मराठी · Camp 3) ↔ Found ಸುಮನ್ (ಕನ್ನಡ · Camp 4). Score counts to 97% and lands on the 19.66 cue; four reasons appear one at a time and then hold. Left: "Across camps." / "Across scripts."

### Scene 5 — The announcement — 23.4–31.0s
Phone: "Tell the family". Five language cards slide in (first on the 23.46 cue); the मराठी card highlights while the real Timbre announcement plays. Left: "Announced in every language."

### Scene 6 — Reunited — 31.0–35.0s
A green check and "Reunited", then Yunio + "Yunio" (wordmark on the 32.74 cue) + "Built on Gnani Prisma + Timbre" + "Prototype · synthetic data · not a government service".

**Music mood:** calm, warm.
**Audio summary:** a low warm bed under one calm voice, interrupted twice by the product itself speaking Marathi.
