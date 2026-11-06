# Poise — Codex Build Plan

> **Purpose:** Governing, implementation-ready plan for building Poise from the product brief in `Poise - Google Docs.pdf`. Treat this document as the product scope and acceptance checklist. Treat the current official Presage SmartSpectra documentation, installed SDK types, and actual runtime payloads as authoritative for SDK details.

## 1. Product and delivery objective

Build **Poise**, a polished Windows-first Electron desktop application that helps people prepare for interviews, presentations, and pitches using live, camera-derived human signals. The product must connect those signals to real interactions—not merely show a biometric dashboard—and complete the journey from preparation through rehearsal and reflection.

- **Tagline:** “Show up as yourself. At your best.”
- **Supporting line:** “A little more prepared. A little more yourself.”
- **Category:** Human-sensing rehearsal companion / human-sensing performance preparation.
- **Primary hackathon user and workflow:** Someone preparing for an important interview; presentation preparation is the second supported workflow.
- **Additional scenario:** Pitch practice using the same rehearsal engine.
- **Competition:** Presage SmartSpectra SDK Challenge, November 2026.
- **Target categories:** Best Overall Human-Sensing Experience, Most Creative or Delightful Use, and Best Thoughtful Real-World Use.
- **First and non-negotiable milestone:** Genuine SmartSpectra measurements flowing through a fresh Poise Electron application.

The experience should feel like a complete, premium, reassuring product—not a mockup, a medical device, or an SDK sample app. The core product principle is: **human signals should change the experience, not just appear on a dashboard.**

## 2. Scope boundaries

### Build for Poise 1.0 (the hackathon MVP)

- Windows desktop app using Electron, React, TypeScript, and Vite.
- Official `@smartspectra/node-sdk` Node.js/Electron integration.
- Camera consent, setup, measurement quality guidance, valid physiological check-in, warm-up, speaking rehearsal, recovery, reflection, local history, and deletion.
- Live pulse, breathing, and HRV when supported, valid, and their required measurement conditions are met.
- Face visibility/landmarks, talking activity, speaking intervals and pauses, and available blink observations.
- Interview question library stored locally; presentation topic/short outline entry; pitch duration selection.
- Responsive measured-breathing warm-up and a clearly distinct, user-selected guided breathing mode.
- Local-first SQLite session summaries, user-controlled history, individual deletion, and complete local data deletion.
- Documentation, tests, Windows packaging, and competition submission materials.

### Explicitly out of scope for the MVP

- Accounts, cloud database, automatic cloud uploads, or cloud synchronization.
- Third-party AI, generated questions, AI practice partner, or AI processing of camera, physiological data, or session data.
- Speech transcription or semantic speech analysis. Any future transcription requires separate microphone consent.
- Claims or inferences about confidence, anxiety, honesty, emotional state, or medical status from pulse, breathing, blinking, facial expression, or other signals.
- Blood-pressure measurement. The relative arterial pressure waveform may be included only as an optional technical demonstration and must never be presented as a blood-pressure reading.
- Monetization, team/organization features, and mobile companion.

Future product ideas (not MVP commitments) include an AI interview partner, additional scenarios, presentation-structure analysis, transcription with separate consent, longitudinal insights, user-defined routines, mobile, optional encrypted sync, and team/organization editions. The proposed customer segments and Free/Plus/Pro/Organizations plans are commercial hypotheses, not validated demand or implementation requirements.

## 3. Mandatory execution order and gates

Do not build the full UI against assumed SDK behavior. Complete each gate before proceeding; if the real SDK blocks a requirement, record the limitation and adapt the product transparently rather than faking success.

### Gate 0 — Inspect and establish the project

1. Inspect the existing workspace before changing it; preserve unrelated files and user changes.
2. Confirm Node/npm versions, Windows build prerequisites, package availability, SDK access/authentication requirements, and competition deadline/submission rules.
3. Use a fresh project/repository only if the workspace is actually intended to be initialized for Poise; do not overwrite existing work.
4. Read the current official SmartSpectra Node.js/Electron quickstart, API reference, metric configuration, quality/validation guidance, model cards/limitations, and telemetry/privacy documentation.
5. Record verified SDK version, supported Windows/Electron setup, required credentials, actual event/payload types, and any trial or licensing constraints in `docs/SMARTSPECTRA_INTEGRATION.md`.

### Gate 1 — Prove live sensing in minimal Electron

1. Install and use the official `@smartspectra/node-sdk`; do not implement camera-based vital-sign estimation independently.
2. Run the official Electron integration with its main-process SDK integration, supplied preload bridge, renderer integration, and message-decoding utilities. Follow its documented security model.
3. Acquire an actual user-authorized camera stream and confirm it is attached to a video element.
4. Request explicit metric bundles for:
   - Cardio: pulse rate and HRV.
   - Breathing: breathing rate and breathing waveform.
   - Face: landmarks/visibility, talking detection, and blink detection.
   - Optional, where appropriate and supported: relative arterial pressure waveform and facial-expression classification.
5. Observe real `streamAvailable`, `metrics`, `validationStatus`, `processingStatus`, and `error` events; support `insight` only if optional insights are implemented. Verify decoding against actual SDK types/payloads.
6. Confirm actual live pulse and breathing outputs, validation/confidence information, and required capture conditions on a real device. Verify HRV against its longer analysis window. Keep a brief-lived diagnostic/log view available for technical verification without exposing secrets.
7. Verify SDK shutdown, camera release, and restart behavior; test Windows packaging feasibility.

**Gate 1 pass condition:** Real camera stream and genuine SDK measurements reach the application, measurement validation is understood, and app shutdown releases camera/SDK resources. Do not label fixture data as live or move to the full product implementation until this passes. If access, authentication, licensing, or device conditions prevent a pass, document the blocker and keep the limitation explicit.

### Gate 2 — Secure app foundation and session engine

1. Establish Electron main/preload/renderer boundaries. Use context isolation and sandboxing; expose only a narrow, typed preload API; restrict camera permission to the app’s own bundled content.
2. Implement explicit camera consent and permission handling before enabling sensing.
3. Implement a typed SmartSpectra adapter that isolates SDK-specific APIs and payloads from UI/product logic.
4. Implement typed signal ingestion and normalization that retain metric identity, value, timestamp, confidence, and stability whenever supplied by the SDK.
5. Implement the testable Signal-to-Action Engine modules:
   - Signal ingestion and normalization.
   - Signal quality: SDK validation events, confidence, stability, required measurement windows, and user guidance.
   - Session context and phase management.
   - Baseline and post-session comparison.
   - Adaptive rules.
   - Experience controller for UI, animation, feedback, and workflow.
6. Implement and test explicit state transitions:
   `IDLE → CONSENT → CAMERA_SETUP → CHECK_IN → WARMUP → REHEARSAL → RECOVERY → REFLECTION → COMPLETED`, with `ERROR` and explicit recovery/exit paths. Define allowed transitions, cancellation, retry, and resource cleanup rather than allowing arbitrary phase changes.
7. Keep preparation, rehearsal, and recovery sensing phases distinct:
   - **Preparation/check-in:** stationary capture for pulse, breathing, and HRV.
   - **Rehearsal:** talking detection, face landmarks, and blink observations.
   - **Recovery:** stationary capture for valid post-practice measurements.
8. Do not present breathing measurements as valid while the user is speaking or when documented camera/capture conditions are unmet.

### Gate 3 — Complete the end-to-end product journey

Build the complete journey below, prioritizing the interview workflow and sharing the rehearsal engine with presentation and pitch practice.

#### A. Welcome and session selection

- Welcome with the message: **“Big moments deserve thoughtful preparation.”**
- Explain Poise and offer: interview, presentation, pitch, and speaking on camera.
- Let the user select session duration and a personal objective.
- Set up navigation for Home (New Session, My Sessions, My Progress), Practice (Interviews, Presentations, Pitches), and Settings (Camera, Privacy, Data, About Poise).

#### B. Consent and camera setup

- Explain why the camera is needed; which signals may be measured; how the signals are used; whether session information is saved; how sensing can be stopped; and how data can be deleted.
- Let the user explicitly enable camera access or continue to camera-free practice without starting the SDK.
- Show preview, face positioning, framing and lighting guidance; advise comfortable posture and stillness during physiological check-in.
- Show camera-active state persistently and provide an immediately available stop-sensing control.
- Show measurement quality/availability and SDK-sourced validation guidance (face not detected, poor lighting, camera instability, insufficient confidence, and other actual supported validation hints).
- Handle denied permission, unavailable/occupied camera, disconnection, no/multiple faces, and SDK initialization/authentication errors with understandable recovery paths.

#### C. Check-in and session baseline

- Wait for valid, sufficiently confident and stable measurements; show progress/availability, not invented or premature values.
- Establish a **session-specific personal baseline**, not a medical normal range or population comparison.
- Respect minimum documented analysis windows: pulse **12 seconds**, breathing **30 seconds**, HRV **60 seconds**. These are minimums, not guarantees; require SDK confidence/stability and all actual quality conditions too.
- Expire displayed live readings when their sample timestamp is more than 10 seconds old or is in the future.
- Never interpret missing/invalid data as zero. Never use an unreliable reading to drive adaptive interactions.

#### D. Responsive Warm-up

Create an immersive, polished breathing experience whose animation has a real functional purpose. Implement three explicit states: waiting for valid measurement, following measured breathing, and guiding at the user’s selected practice pace.

- **Observe mode:** animate from actual valid measured breathing rate/waveform; label it as measured/responding biofeedback.
- **Guided mode:** let the user choose a comfortable target pace; display the target separately from the actual measured response and show whether/how the measured rhythm changes. Never imply the app controls the user’s breathing or that target pace is a measurement.
- Show measurement confidence/quality and waiting/unavailable states.
- Keep modes distinct; never present an unverified signal as a real measurement.
- Use smooth, purposeful transitions into rehearsal.

#### E. Stage / rehearsal studio

- Provide a distraction-free practice UI, camera preview, timer, selected prompt/topic/outline, talking activity, speaking intervals and observable pause timeline.
- Interview: use a small, locally stored question library (not an external AI service).
- Presentation: allow entry of a topic or pasted short outline.
- Pitch: allow duration selection and rehearsal.
- Track practice duration, speaking intervals, speaking pauses, talking activity, available blink observations, and completion.
- Treat SDK talking detection only as talking activity—not transcript, semantic speech analysis, confidence, honesty, anxiety, or emotion evaluation.
- Do not infer confidence, nervousness, dishonesty, or emotional state from pulse, blinking, expression, or other physiological/facial signals.
- Support stop/cancel and clean transition to recovery.

#### F. Recovery, reflection, and repeat

- After rehearsal, run a separate stationary recovery measurement phase.
- Produce a session report with session type, date and duration, completion, valid measurements, confidence/quality, speaking activity, observable pauses, and baseline/post-session comparisons.
- Compare only valid, matching measurements collected under compatible conditions. Show pulse comparison only when both values are valid; likewise breathing. Show HRV comparison only when required conditions are satisfied.
- If a required value is unavailable or conditions are incompatible, explain why and omit the comparison; never fabricate a value or comparison.
- Provide next-practice suggestions based only on observed practice activity or the user’s selected goal (for example, shorter opening or allowing more time for a first pause), never fabricated emotional interpretations.
- Allow the user to repeat a session and compare practice patterns across saved sessions without diagnosing or implying medical change.
- Let users reopen a saved summary to review its objective, valid measurement metadata/comparisons, practice observations, timeline, and next-practice suggestion.

#### G. History, progress, and settings

- Store session summaries locally in SQLite; preferences locally.
- Provide user-controlled session history and progress across repeat sessions.
- Support individual session deletion and complete local data deletion, with clear confirmation and truthful completion states.
- Settings must include camera, privacy, data retention/deletion, telemetry disclosure, and About Poise.

### Gate 4 — Privacy, security, and truthful product claims

1. Do not store Poise-owned raw camera video or raw face-landmark history. Process camera frames for live sensing only. Keep live measurements in memory; persist only the session summary fields the user elects to save. Talking activity may be summarized as a session timeline; blink activity may be an aggregate only if useful and supported.
2. Keep user preferences local and session summaries in local SQLite. No automatic cloud upload, accounts, or third-party AI in the MVP.
3. Explicitly configure SmartSpectra `enableTelemetry: false` in the challenge build and disclose that setting.
4. Explain accurately that disabling SDK telemetry does **not** disable authentication or other SDK service communications. Distinguish Presage service communications from Poise-owned storage/transmission.
5. Keep API credentials outside source control. Provide secure local development/judge configuration and a secret-free `.env.example`; do not expose credentials to renderer code or logs.
6. Ensure consent and privacy copy matches the final implementation. It must state, in plain language, that camera frames are processed for live SmartSpectra sensing, Poise does not record/upload video, the user controls start/stop, optional summaries are saved locally and deletable, and feedback is informational—not medical assessment or diagnosis. Disclose supported signals and any actual service communications accurately.
7. Use no alarmist red biometric dashboards; measurement and validation states must be clear, non-judgmental, and calm.

### Gate 5 — Design system and product polish

- Desktop-first layouts that scale to different window sizes; accessible typography and large interaction targets.
- Brand character: human, reassuring, intelligent, elegant, thoughtful, non-judgmental, encouraging; companion rather than medical device or corporate productivity dashboard.
- Visual direction: near-black charcoal and deep midnight; soft electric violet and cool blue accents; muted green success; warm amber attention; modern editorial sans-serif; restrained glass surfaces; understated charts; cinematic lighting; slow, fluid, purposeful motion.
- Keep the camera central, make measurements understandable, and make measurement quality visible.
- Avoid generic admin-dashboard layouts, excessive gradients, alarmist red biometric displays, meditation-template clichés, and decorative animation without functional meaning.

## 4. Technical architecture and proposed repository shape

Use the following stack unless verified SDK/platform compatibility requires a documented change: Electron, React, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, Zod, SQLite, Vitest, Playwright, and Electron Builder. SmartSpectra is the principal external dependency. Do not add Sentry, Supabase, OpenAI, accounts, analytics, or other integrations for the MVP.

Suggested structure (adapt to an existing project rather than duplicating it):

```text
poise/
├── apps/
│   └── desktop/
│       ├── electron/
│       │   ├── main.ts
│       │   └── preload.ts
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   │   ├── onboarding/
│       │   │   ├── consent/
│       │   │   ├── check-in/
│       │   │   ├── warmup/
│       │   │   ├── rehearsal/
│       │   │   ├── reflection/
│       │   │   └── history/
│       │   ├── integrations/smartspectra/
│       │   ├── engine/
│       │   │   ├── signal-ingestion/
│       │   │   ├── signal-quality/
│       │   │   ├── session-context/
│       │   │   ├── adaptive-rules/
│       │   │   └── experience-controller/
│       │   ├── services/
│       │   ├── store/
│       │   └── styles/
│       └── tests/
├── packages/
│   ├── shared-types/
│   └── signal-engine/
├── docs/
│   ├── PRODUCT_VISION.md
│   ├── ARCHITECTURE.md
│   ├── SMARTSPECTRA_INTEGRATION.md
│   ├── PRIVACY.md
│   ├── CONSENT.md
│   └── TESTING.md
├── assets/
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

Keep the SDK behind a typed adapter so the engine and UI can be tested independently. Use the actual SDK payload schema and metric types rather than guessed interfaces. Validate external/runtime payloads (for example with Zod where appropriate), expose narrow typed events across the preload bridge, and surface initialization, decoding, camera, validation, storage, and shutdown errors explicitly.

## 5. Verification plan

### Automated tests

- **Vitest unit tests:** signal normalization; timestamps/metric identity; confidence/stability and minimum-window gating; missing/invalid values; state machine transitions and cleanup; adaptive rules; comparison compatibility; recommendation rules; local persistence/deletion.
- Use clearly labelled synthetic fixtures for engine tests only. Strictly separate fixtures from live SDK measurements; never let fixture values enter a live UI state or be labelled as real output.
- **Playwright workflow tests:** welcome → consent → setup → camera-free warm-up → rehearsal → recovery → reflection; saved-summary review; consent and opt-in saving; stop sensing; save/delete session; reduced-motion behavior and responsive desktop window sizes.
- Test boundary conditions and errors without silently treating failure as success.

### Required manual/device scenarios

- Successful camera permission and explicit denial.
- Camera already occupied, disconnection, SDK shutdown/restart, app restart, and authentication/initialization errors.
- Poor lighting, backlighting, no face, multiple faces, face mispositioning, camera instability, and excessive user movement.
- Insufficient confidence, unavailable metrics, interrupted/too-short measurement windows, and speaking during attempted breathing capture.
- Pulse/breathing/HRV minimum windows and valid post-session recovery readings.
- Warm-up responds only to genuine, valid live breathing; target and measured values remain distinct.
- SQLite persistence, individual deletion, complete local deletion, and fresh-install behavior.
- Windows packaging and launching from a fresh installation.
- Privacy, consent, telemetry, service-communication disclosures, and actual storage behavior agree.

### Definition of done for any feature

A feature is not done because it renders. It must work with actual SDK output where applicable, preserve the validity/consent constraints, handle failure and cleanup, be covered by appropriate automated/manual tests, and be documented when user-facing or operational behavior changes.

## 6. Competition readiness and deliverables

Deliver a working Windows desktop application plus a public, reproducible source repository. Include:

- `README.md`: what Poise is and the problem it solves; screenshots; feature overview; architecture diagram; SmartSpectra integration explanation; install/setup; API key configuration; run/build instructions; camera permissions/requirements; privacy/data handling; testing; known limitations; demo video; credits/licensing.
- The six required docs under `docs/`: product vision, architecture, SmartSpectra integration, privacy, consent, and testing. Include setup, camera requirements, credential setup, SDK lifecycle, accurate privacy disclosures, known limitations, and testing guidance.
- Screenshots, public repository, explicit consent/data-handling disclosure, evidence of live SmartSpectra integration, and reproducible judge setup.
- A roughly **3-minute** story-led demo video:
  1. Problem: “You can prepare your words. But how do you prepare yourself for the moment?”
  2. Enter Poise: select interview rehearsal, show consent and camera setup.
  3. Human sensing: actual SDK integration, live pulse/breathing/confidence, visible metric names and actual measurement timestamps.
  4. Signature Warm-up: show visualization responding to genuine valid measurements.
  5. Stage: rehearse an interview answer and show talking detection/speaking timeline.
  6. Reflection: post-session measurement, valid comparison, and grounded next-practice suggestion.
  7. Close: “Poise. Show up as yourself. At your best.”
- In the video, show the actual application, real camera feed, genuine live SDK output, and a brief terminal/log view proving integration; do not show fabricated or prerecorded values as live. Show the public repository and setup instructions.
- A product-led DEV submission using the official template. Suggested title: **“Poise: A Human-Sensing Rehearsal Companion Built with Presage SmartSpectra”**. Explain the problem, product, journey, SDK integration, signal-driven interactions, architecture, privacy/consent, screenshots, demo, public repo, and installation.
- Select all three target prize categories in the submission template (including both additional categories).
- Final validation and submission before **November 22, 2026, 11:59 PM PST**; verify the official rules/tags and deadline rather than assuming them.

## 7. Time-boxed execution schedule

The brief’s intended competition window is November 6–22, 2026. Preserve the order and gates; adjust dates only if the official deadline or actual SDK access differs.

| Dates | Focus | Exit gate |
|---|---|---|
| Nov 6–7 | Register with Presage; inspect docs; install SDK; run Electron quickstart; verify real camera, live signals, validation, and Windows packaging feasibility. | **Gate 1: Live signal verified** |
| Nov 8–10 | Establish project/foundation; secure camera permission; consent/onboarding; state machine; Signal-to-Action Engine. | Foundation testable and SDK isolated |
| Nov 11–13 | Integrate pulse, breathing, HRV, face metrics, confidence/validation; build check-in/Green Room and Warm-up; verify real responsive feedback. | **Gate 2: Signal drives UI** |
| Nov 14–16 | Interview workflow; talking detection; speaking timeline; post-practice check-in; reflection; local history. | **Gate 3: Complete user journey** |
| Nov 17–19 | UI polish; measurement edge cases; privacy/data controls; deletion; security checks; Windows package. | Full acceptance suite passes |
| Nov 20–21 | Fresh-install test; record demo; finish README/docs; publish DEV article; verify public repo and demo. | Reproducible submission package |
| Nov 22 | Final validation; confirm tags and prize categories; submit before 11:59 PM PST. | Submission confirmed |

## 8. Final acceptance checklist

- [ ] Starts successfully on Windows and is packaged for a fresh installation.
- [ ] Requests camera permission explicitly and acquires an actual camera stream.
- [ ] Uses the official SmartSpectra SDK and documented secure Electron integration.
- [ ] Shows genuine live measurements with timestamps and validation/confidence; no fabricated live values.
- [ ] Enforces analysis windows, measurement quality, and phase/capture conditions; never substitutes zero or simulated data.
- [ ] Expires displayed measurements when their timestamps are stale or future-dated; keeps saved historical readings separately reviewable.
- [ ] Valid live breathing drives the Warm-up; Observe and Guided modes clearly distinguish measured response from selected target.
- [ ] Complete interview workflow works; presentation and pitch scenarios use the same rehearsal engine.
- [ ] Real talking events update speaking intervals/timeline; no transcript or unsupported emotional/personality claims.
- [ ] Recovery, reflection, and comparisons use only valid compatible measurements and omit unavailable results transparently.
- [ ] Local summaries persist; user can delete one session or all local Poise data.
- [ ] User can reopen an opted-in summary and review its objective, valid readings and metadata, practice observations, and suggestion.
- [ ] Camera stops/releases on stop, cancellation, errors, phase transitions as appropriate, and app shutdown.
- [ ] Consent, telemetry, storage, external service, and privacy statements accurately match implementation.
- [ ] No raw video storage, no automatic cloud upload, no MVP account or AI integration, no credentials committed.
- [ ] Automated tests use isolated synthetic fixtures; required edge cases and Windows packaging are verified.
- [ ] Required docs, screenshots, public repo, three-minute demo, DEV article, and competition category selections are ready.

## 9. Implementation rules for Codex

1. Work in small, independently testable increments; inspect the current repository and its conventions before changing files.
2. Start with the SDK proof and use official documentation/real SDK payloads for all integration decisions.
3. Do not invent SDK APIs, measurements, validation states, or successful fallbacks. Surface failures explicitly and preserve a truthful unavailable state.
4. Maintain strict boundaries between main, preload, and renderer; keep credentials and sensitive processing out of renderer-accessible APIs.
5. Make the smallest complete change for each milestone; avoid adding out-of-scope services or dependencies.
6. Update directly related docs and tests with behavior changes. Run the smallest relevant test/build command after each coherent milestone, then the full acceptance checks before submission.
7. Keep privacy and measurement limitations visible in the product, documentation, and demo—not only in implementation notes.
8. Deliver working software, not only mockups, screenshots, or a design prototype.
