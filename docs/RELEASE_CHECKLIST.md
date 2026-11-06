# Release and Submission Checklist

This checklist distinguishes work completed locally from steps that require a
real SmartSpectra account/device, public sharing, or a competition account.

## Completed local preparation

- [x] Windows x64 Electron app builds and launches.
- [x] Windows NSIS installer builds (unsigned).
- [x] Latest installer installed into a temporary location, launched, and
      uninstalled successfully.
- [x] Production build and secure preload compile.
- [x] Unit, browser workflow, and browser persistence/deletion tests pass.
- [x] `npm audit` reports no known vulnerabilities.
- [x] Packaged Electron startup and storage IPC read/write/delete smoke check.
- [x] Product, architecture, integration, privacy, consent, and testing docs.
- [x] Welcome and consent screenshots captured without live/synthetic metrics.
- [x] Demo script and DEV article draft prepared with explicit proof placeholders.
- [x] `using-smartspectra` Codex skill installed in `.agents/skills/`.

## Required before describing the product as live

- [ ] Obtain/confirm a valid SmartSpectra key in the Presage portal. Enter it
      only in Poise's in-app password field; never send it in chat, commit it,
      or place it in a `VITE_*` environment variable.
- [ ] Grant camera permission after reviewing consent.
- [ ] Record SDK package version, OS/device/camera, date, and actual
      `streamAvailable`, `processingStatus`, `validationStatus`, and `metrics`
      outcomes. Redact secrets and personal information.
- [ ] Confirm genuine pulse/breathing outputs, stable/confidence/timestamp
      metadata, minimum windows, and warm-up behavior. Mark unsupported or
      unavailable metrics honestly.
- [ ] Confirm SDK stop/destroy releases the camera and a second session starts
      cleanly; repeat after an SDK error.
- [ ] Complete the device scenarios in [TESTING.md](./TESTING.md).
- [ ] Update [SmartSpectra integration status](./SMARTSPECTRA_INTEGRATION.md)
      using observed facts only.
- [ ] Record and review the three-minute demo using
      [DEMO_SCRIPT.md](./DEMO_SCRIPT.md).

## Required before public release/submission

- [x] Review tracked source and documentation for likely secrets; exclude the
      original source brief and unlicensed upstream skill from redistribution.
- [x] Repository owner authorized publishing source to the public
      `Reinasboo/poise` repository.
- [ ] Choose a source license and verify clone/build instructions from a clean
      checkout.
- [ ] Decide whether to sign the Windows installer and provide a project icon.
- [ ] Replace the bracketed fields in
      [DEV_SUBMISSION_DRAFT.md](./DEV_SUBMISSION_DRAFT.md) with verified
      repository, installer, live test, and demo links.
- [ ] Check the official challenge rules, current deadline, required tags,
      submission template, and eligibility. Select the three target categories
      only if they remain available and accurate.
- [ ] Submit the DEV article and competition entry from the authorized owner
      account and retain confirmation.

## Current external blockers

- No SmartSpectra API key has been provided to or entered in this environment;
  this is intentionally not requested in chat.
- The source license is not yet selected. The original source brief PDF and
  locally installed SmartSpectra skill are excluded from the public repository.
- No live recording, public demo URL, DEV article, or challenge submission has
  been published.
- The package uses Electron's default icon and is unsigned. The latest NSIS
  installer was smoke-tested from a temporary install location, not on a clean
  Windows profile.
