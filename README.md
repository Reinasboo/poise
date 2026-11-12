# Poise

**Show up as yourself. At your best.**

Poise is a privacy-conscious rehearsal companion for interviews,
presentations, pitches, and speaking on camera. It connects a personal
check-in, an adaptive warm-up, focused rehearsal, and a grounded reflection in
one deliberate practice flow.

Optional camera sensing is powered by Presage SmartSpectra. Poise displays only
supported, current measurements and observable practice activity—it does not
infer confidence, anxiety, honesty, emotion, or intent.

> Poise is informational rehearsal software, not a medical device or
> diagnostic tool.

## What makes Poise different

- **A complete practice arc.** Move from intention and check-in through warm-up,
  rehearsal, recovery, and reflection.
- **Grounded feedback.** Missing or unreliable signals remain visibly
  unavailable instead of being replaced with zeroes or synthetic values.
- **Camera-optional by design.** Complete the full rehearsal flow without an
  API key, camera, or sensing consent.
- **Explicit privacy choices.** Camera sensing and local session saving are
  separate opt-ins. Saving is off by default.
- **Local-first history.** Opted-in summaries are stored locally in SQLite;
  there is no Poise account, cloud sync, transcript, or third-party AI service.
- **Accessible, responsive interface.** The redesigned React interface includes
  keyboard focus states, reduced-motion support, active-page semantics, a skip
  link, and mobile navigation.

## Practice journey

1. Choose a scenario, personal objective, and practice duration.
2. Review the camera and data disclosures.
3. Explicitly consent to sensing, or continue without the camera.
4. Check in and warm up using a measured rhythm or a clearly labelled guided
   pace.
5. Rehearse with a local interview prompt or your own topic. Poise observes
   speaking intervals and pauses; it does not create a transcript.
6. Review a reflection based only on supported measurements and practice
   activity.
7. Optionally save the summary locally and revisit it from session history.

Non-sensitive scenario, duration, and guided-pace preferences can persist
locally between app runs. Consent and credentials never persist.

## Technology

- Electron 43, React 19, TypeScript, and Vite 7
- Presage `@smartspectra/node-sdk` 3.4 for optional camera sensing
- SQL.js with an Electron storage bridge for local SQLite summaries
- Zod for persisted-data validation
- Framer Motion and Recharts for interface motion and progress views
- Vitest and Playwright for unit and browser-level verification
- Electron Builder for Windows packaging

## Requirements

- Node.js 22.12 or newer recommended
- Windows x64 for the packaged desktop application
- A supported webcam for camera sensing
- A valid SmartSpectra API key and network access for SDK authentication and
  required Presage service communication

Camera-free practice does not require the SDK, an API key, or a webcam.
Disabling optional SDK telemetry does not make SmartSpectra authentication or
required service communication offline.

## Get started

Clone and install the exact dependency versions from the lockfile:

```bash
git clone https://github.com/Reinasboo/poise.git
cd poise
npm ci
```

Run the complete Electron development application:

```bash
npm run dev
```

Run only the browser renderer for interface development:

```bash
npm run dev:web
```

Choose camera-free practice without a key. If you opt into camera sensing,
enter your personal SmartSpectra API key in the in-app password field. Poise
holds it in memory only for the sensing session and does not persist or log it.

Do not place credentials in a `VITE_*` variable, source file, screenshot,
fixture, or chat. [`.env.example`](./.env.example) intentionally contains no
secret and documents why runtime entry is used.

For Codex, install the official SmartSpectra skill from its source repository:

```text
$skill-installer Presage-Security/SmartSpectra/.agents/skills/using-smartspectra
```

The upstream skill is not vendored here because its repository does not
declare a redistribution license.

## Build and package

Create a production renderer and bundled preload:

```bash
npm run build
```

Build the unpacked Windows application or unsigned NSIS installer:

```bash
npm run dist:dir
npm run dist:win
```

The unpacked application is written to `dist/win-unpacked`; installer output
is written beneath `dist/`. The current package is unsigned and uses the
default Electron icon, so Windows may display a publisher warning.

## Website and downloads

The static download page is in [`website/`](./website/). Deploy it to Cloudflare
Pages with `website` as the build output directory and no build command. The
Windows installer is published as a GitHub Release asset; pushing a `v*` tag
builds and attaches the installer automatically. See
[Website and Windows installer](./docs/DEPLOYMENT.md) for setup details.

## Tests and verification

```bash
npm test
npm run test:e2e
npm run build
npm audit
```

The current automated suite includes:

- 9 passing unit tests for the session engine and SmartSpectra adapter
- 6 passing Playwright flows covering setup, consent, camera-free completion,
  saved-reflection reopening, reduced motion, preference validation and
  persistence, privacy navigation, and SQLite summary persistence/deletion
- A passing TypeScript and production build

Before the first browser test run, install Playwright Chromium:

```bash
npx playwright install chromium
```

If bundled Chromium is unavailable on the host but Google Chrome is installed,
select the system browser explicitly:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

PowerShell equivalent:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm run test:e2e
```

Browser tests do not inject or simulate physiological measurements and do not
claim to verify live sensing. See [Testing and release verification](./docs/TESTING.md)
for the complete acceptance plan.

## Architecture and data handling

The Electron main and preload processes bind the official SmartSpectra IPC and
expose a narrow, trusted storage API. In Electron, SQL.js serializes opted-in
summaries to a SQLite file under the application `userData` directory. Browser
development uses an IndexedDB fallback.

Camera frames are processed for live sensing and are not recorded or uploaded
by Poise. Raw face landmarks, high-frequency measurements, and API keys are not
persisted. Session summaries can include the selected scenario, objective,
duration, supported baseline/recovery samples, speaking intervals, pause and
blink aggregates, and a grounded practice suggestion.

Read the detailed documentation:

- [Architecture](./docs/ARCHITECTURE.md)
- [Privacy and data handling](./docs/PRIVACY.md)
- [Camera and data consent](./docs/CONSENT.md)
- [SmartSpectra integration](./docs/SMARTSPECTRA_INTEGRATION.md)

## Repository structure

```text
electron/                  Electron main and preload processes
src/engine/                Session state machine and comparison logic
src/integrations/          SmartSpectra adapter
src/services/              Preferences and local session storage
src/App.tsx                Product flows and application shell
src/styles.css             Responsive visual system
tests/e2e/                 Playwright product-flow tests
docs/                      Product, privacy, architecture, and release docs
```

## Current verification boundary

Compilation, unit tests, browser flows, dependency audit, Windows packaging,
installer lifecycle, renderer startup, and local storage operations have been
verified. The real-device SmartSpectra gate remains open: it requires a valid
user key, camera permission, genuine SDK validation and metric events, and
stop/release/restart verification on compatible hardware.

No synthetic value is presented as a live measurement.

## Additional project documents

- [Product vision](./docs/PRODUCT_VISION.md)
- [Testing and release verification](./docs/TESTING.md)
- [Three-minute demo script](./docs/DEMO_SCRIPT.md)
- [DEV submission draft](./docs/DEV_SUBMISSION_DRAFT.md)
- [Release checklist](./docs/RELEASE_CHECKLIST.md)
- [Codex build plan](./CODEX_BUILD_PLAN.md)

## Credits and licensing

Poise integrates Presage's SmartSpectra SDK. Consult the current SDK
documentation, terms, and included third-party notices for SDK and native
library licensing. This prototype does not yet include a separate license for
the Poise source.
