# Testing and Release Verification

## Automated commands

Run from the project root:

```powershell
npm test
npm run test:e2e
npm run build
npm audit
npm run dist:dir
npm run dist:win
```

- Before the first browser run, install its supported browser with
  `npx playwright install chromium`.
- `npm test` runs Vitest engine tests for phase transitions, minimum
  measurement windows, stable/confident/current samples, compatible
  comparisons, and grounded suggestions.
- `npm run test:e2e` runs Playwright in Chromium against the Vite development
  renderer. The tests cover welcome, scenario setup, consent disclosures, the
  independent opt-in save checkbox, privacy navigation, and SQL.js summary
  persistence/deletion through the browser's IndexedDB fallback. They do not
  inject measurements or claim to verify live sensing.
- `npm run build` type-checks TypeScript, builds the renderer, and bundles the
  secure preload.
- `npm audit` should report zero known dependency vulnerabilities.
- `npm run dist:dir` builds and packages the Windows x64 app without creating
  an installer.
- `npm run dist:win` creates the unsigned Windows x64 NSIS installer.

The current unit suite contains eight passing tests, and all three Playwright
browser tests pass. The production build and Windows unpacked app and NSIS
installer have built successfully. The packaged Electron window, renderer
startup, SQL.js initialization, and storage IPC read/write/delete cycle have
been smoke-tested. The latest installer was installed into a temporary
location, launched successfully, and uninstalled. Live SmartSpectra proof
still requires a user key and manual camera/device validation.

## Manual live-device acceptance

Use an authorized Windows x64 machine with a supported camera, network access,
and a valid SmartSpectra key entered in the app. Never store the key in a
fixture, environment variable used by Vite, screenshot, or test output.

1. Verify the welcome/setup path and read the complete consent disclosure.
2. Confirm sensing cannot start without the consent checkbox and API key.
3. Grant OS camera permission; verify actual stream attachment and visible
   camera status.
4. Observe genuine SDK processing/validation events and timestamped stable
   pulse, breathing, and HRV where available; do not shorten minimum windows or
   substitute test values.
5. Confirm the warm-up follows genuine valid breathing only in Observe mode;
   in Guided mode confirm the target is distinct from measured response.
6. Verify stable talking observations update the practice timeline, without
   transcription or emotional-state interpretation.
7. Verify recovery comparisons appear only for valid compatible baseline and
   recovery samples.
8. Stop, cancel, complete, and restart sensing. Confirm SDK shutdown, camera
   release, retry behavior, and no secret in logs.
9. Opt into a summary, restart the app, review it, delete one summary, then
   confirm delete-all and verify the history is empty.
10. Build and launch the Windows package from a fresh install/location; check
    OS camera permission and storage behavior.

Also test explicit permission denial, busy/disconnected camera, invalid key,
SDK initialization failure, poor lighting, no/multiple faces, movement,
insufficient confidence, unavailable metrics, short/interrupted windows, and
speaking during stationary breathing capture. Record device, package version,
conditions, and observed outcomes without recording the API key or raw video.

## Fixtures and truthfulness

Synthetic values are permitted only in isolated engine tests and must never be
presented by the app as live measurements. The browser workflow tests remain
before the sensing step and use no signal fixtures. Do not mark the live gate
complete until genuine SDK events and cleanup have been observed.
