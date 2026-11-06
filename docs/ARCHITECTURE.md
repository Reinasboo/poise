# Poise Architecture

## Runtime shape

```text
React renderer
  ├─ session UI and explicit phase machine
  ├─ SmartSpectra typed adapter
  │    └─ official renderer SDK + message decoder
  └─ SQL.js session store
       └─ narrow poiseStorage bridge
            └─ Electron main: atomic SQLite file in app userData

Electron main
  ├─ official SmartSpectra main-process IPC binding
  ├─ official SDK preload bundled with Poise preload
  ├─ camera-only permission policy for trusted app content
  └─ local database read/write/delete IPC
```

In the packaged app, the renderer is loaded from the packaged `dist` directory.
During development, Electron loads the Vite server bound to `127.0.0.1`.
Popups and navigation away from the trusted app page are denied. Electron uses
context isolation, sandboxing, and disabled Node integration.
The renderer content security policy limits sources to the app and permits
`wasm-unsafe-eval` for SQL.js's WebAssembly runtime; it does not enable general
`unsafe-eval`.

## Technology

- Electron 43, React 19, TypeScript, Vite 7
- `@smartspectra/node-sdk` 3.4.0 (official Node.js/Electron integration)
- SQL.js for SQLite serialization; the main process writes an atomic database
  file under Electron `userData`
- Zod for validating persisted session detail JSON
- Vitest for engine tests, Playwright for browser-level onboarding/consent
  checks, and Electron Builder for Windows packaging

## Session lifecycle

The engine in `src/engine/session.ts` defines allowed transitions:

`IDLE → CONSENT → CAMERA_SETUP → CHECK_IN → WARMUP → REHEARSAL → RECOVERY → REFLECTION → COMPLETED`

Consent/setup errors enter `ERROR`; stop/cancel returns to `IDLE`. The UI
coordinates phase changes and calls the SDK stop/destroy lifecycle on stop,
completion, and window unload. Preparation, rehearsal, and recovery are distinct
sensing contexts. Breathing samples are accepted only with a recent stable
not-talking observation.

## SmartSpectra boundary

`src/integrations/smartspectra/client.ts` loads the renderer SDK and decoder
dynamically. It requests pulse, HRV, breathing rate/traces, face landmarks,
talking, and blinking; expression classification and arterial-pressure traces
are not requested. SDK telemetry is explicitly disabled with
`enableTelemetry: false`; required authentication/service traffic remains.

Metric samples preserve identity, value, SDK timestamp, stability, and
confidence where supplied. SDK timestamps are microseconds since the Unix
epoch. Pulse, breathing, and HRV have minimum stationary analysis windows of
12, 30, and 60 seconds respectively. Stable status, current-phase timestamps,
and available confidence are also checked. The window is a minimum, not a
promise that a valid sample will arrive.

The session view offers a collapsed, in-memory diagnostics disclosure with a
bounded recent-event list for stream, processing, validation, decoded metrics,
and stop/error events. It excludes the API key and raw camera frames and is
never written to session history or the log.

The API key is entered into a password field and held in renderer memory while
the renderer SDK session runs. It is not a Vite variable, source constant,
persistent preference, session summary, or log entry. This is not a
hardware-backed secret store; users should enter only their own key and close
the session to clear it.

## Data and persistence

The user may opt in to saving a session summary. SQL.js serializes summaries to
`session-summaries.sqlite`; in Electron, the main process stores it beneath
`app.getPath("userData")` using a temporary file and rename. The browser
development fallback uses IndexedDB. The summary contains session type/date,
duration, objective, completion, valid baseline/recovery values and sample
metadata, talking intervals/counts, pause count, blink aggregate, and a
practice suggestion. Raw frames, raw landmark history, API keys, and
high-frequency live samples are not persisted.

Database IPC checks the trusted sender and limits the serialized payload to
20 MiB. The preload exposes only read, write, and delete operations for the
session database. The user can delete an individual saved session or delete
all saved Poise summaries.

## Windows packaging

`npm run dist:dir` builds the app and creates an unpacked Windows x64 app under
`dist/win-unpacked`. `npm run dist:win` builds the Windows installer. The
SmartSpectra Windows native libraries are copied as an extra resource; the
packaged main process sets `SMARTSPECTRA_CAPI_PATH` to the bundled C API DLL.
The current package is unsigned and uses Electron's default icon.

## Known verification boundary

Compilation, unit tests, dependency audit, and Windows unpacked packaging have
passed. The real-device SmartSpectra gate remains pending: a valid user API key,
camera permission, genuine metric/validation events, and stop/release/restart
behavior have not yet been verified in a live Poise session. No fixture or
simulated signal is presented as live.
