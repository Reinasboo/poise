# Poise Privacy and Data Handling

This document describes the current MVP implementation. It is product
information, not legal advice.

## What Poise processes

| Information | Purpose | Poise storage |
|---|---|---|
| Camera frames | Live SmartSpectra sensing after explicit consent | Not recorded or saved by Poise |
| Pulse, breathing, HRV, face landmarks, talking, and blink observations | Check-in, responsive warm-up, speaking activity, and reflection | Kept in memory while needed; no raw landmark history |
| Optional session summary | History and personal practice progress | Saved locally only when the user opts in |
| SmartSpectra API key | Authenticate the SDK session | Held in renderer memory for the active session; not logged or persisted by Poise |
| Session objective and selected scenario | Personalize and describe the practice | Included in the saved summary only if the user opts in |

An opted-in summary can include the session type, date, practice duration,
objective, completion, valid baseline/recovery sample values and available
confidence/stability/timestamps, speaking intervals, pause count, blink
aggregate, whether camera sensing was enabled, and a practice suggestion. Do
not enter sensitive third-party or confidential information into an objective.

## Where summaries are stored

In the Windows desktop app, Poise stores the SQLite database under Electron's
per-user `userData` directory. The database is not encrypted by an
application-level encryption layer; protect access to your Windows account and
device. During browser development, the fallback is IndexedDB on the local
origin. No Poise account, cloud database, automatic upload, or sync exists in
this MVP.

Users can delete a single saved summary from My Sessions or use Settings →
Privacy & data → Delete all local Poise data. Full deletion removes the local
session database. Standard operating-system backups or filesystem recovery
are outside Poise's control.

## SmartSpectra service communication

Poise sets SmartSpectra `enableTelemetry: false`. This disables optional SDK
telemetry; it does **not** disable authentication, subscription validation, or
other service communication required by the SDK. Review the current Presage
documentation and service terms for their handling of those communications.
Poise does not claim that SmartSpectra use is fully offline.

The API key is entered in the in-app password field because the official
renderer SDK uses it to create the SDK session. It exists in renderer process
memory while the session is active, is cleared on stop/completion, and is not
stored in `.env`, a Vite `VITE_*` variable, the database, or logs. Never send
the key in chat, screenshots, issue reports, or source control.

## Consent and limits

Camera sensing starts only after the user checks the explicit consent control
and starts a session. Saving a summary is a separate, optional control that is
off by default. A persistent camera status and Stop sensing control are shown
while sensing is active.

Camera-derived measurements are informational rehearsal feedback, not
diagnosis or medical advice. They do not establish confidence, anxiety,
honesty, or emotional state. A personal baseline is not a medical normal range.
Talking detection is activity only; Poise does not record audio, transcribe
speech, or perform semantic speech analysis.

## Contact and changes

This prototype has no support/contact service or privacy-request backend.
Users can remove local summaries in the app. Before any future account, cloud,
AI, or transcription feature is added, its data flow and consent must be
reviewed and documented separately.
