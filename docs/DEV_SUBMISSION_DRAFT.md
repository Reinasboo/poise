# Poise: A Human-Sensing Rehearsal Companion Built with Presage SmartSpectra

> **Draft only.** Replace every bracketed item and verify the actual device
> run, public repository, demo, and competition rules before publishing. Do not
> describe the live-sensing gate as passed until genuine SDK events have been
> recorded.

## The moment before the moment

You can prepare your words. But how do you prepare yourself for the moment?

An interview answer or pitch is more than a script. People often want a chance
to settle into a rehearsal, practise in their own words, and reflect on what
they actually did—without an AI grading their personality or pretending to
know how they feel.

Poise is a human-sensing rehearsal companion built for that space between
preparation and performance.

## The experience

Choose an interview, presentation, pitch, or on-camera practice. Poise explains
camera and data use before sensing, then gives the user a quiet check-in, a
responsive breathing warm-up, a focused practice stage, a separate recovery
check, and a grounded reflection.

Interview prompts are local. Presentation and pitch topics come from the user.
Talking detection marks observable activity; Poise does not record or
transcribe the answer.

## What SmartSpectra contributes

Poise integrates the official `@smartspectra/node-sdk` Electron workflow:
main-process SDK IPC, the official preload bridge, the renderer SDK, and the
SDK message decoder. The app explicitly requests the signals it uses and
disables optional telemetry. SmartSpectra computes measurements on-device;
authentication and subscription validation still require Presage service
communication.

Poise preserves sample timestamps, stability, and confidence where supplied.
It honors minimum analysis windows and omits unavailable or invalid results.
The live proof was verified on **[device and OS]** using SDK **[version]** on
**[date]**. Observed stream, validation, and metric event details:
**[insert only outcomes actually verified; do not include the API key]**.

## The signal changes the experience

In Observe warm-up mode, the visualization follows a valid measured breathing
rate. Guided mode uses a pace selected by the user and shows that target
separately from the measured response. During rehearsal, stable talking events
mark intervals and candidate pauses. Reflection compares only matching,
stable baseline and recovery samples collected in their separate stationary
phases.

There is no confidence, anxiety, honesty, or emotion score. A personal
baseline is not a medical normal range, and Poise is not a medical device.

## Privacy by design

Camera sensing requires explicit consent. Poise does not record or upload
camera video, save raw landmark histories, or automatically upload session
data. Local session summaries are optional and deletable. There are no
accounts, cloud sync, third-party AI, speech transcription, or
semantic-speech analysis in this MVP. The API key is entered in the app,
remains in memory for the active session, and is not stored by Poise.

## Built for Windows

Poise is an Electron, React, TypeScript, and Vite application. SmartSpectra
signals are isolated behind a typed adapter. A testable session engine enforces
phases and valid-measurement windows. Opted-in summaries use SQL.js and a local
SQLite file. Automated checks cover the session engine, consent and setup,
local persistence/deletion, production compilation, and Windows packaging.

## Try it

- Source repository: **[public repository URL — publish only after review]**
- Windows installer: **[release URL]**
- Three-minute demo: **[video URL — genuine live session required]**
- Setup: [README](../README.md)
- Product and privacy details: [architecture](./ARCHITECTURE.md),
  [privacy](./PRIVACY.md), [consent](./CONSENT.md), and
  [SmartSpectra integration](./SMARTSPECTRA_INTEGRATION.md)

## What we learned

The integration makes signal validity part of the product design rather than
an afterthought. A camera stream is not the same as a valid measurement, and a
measurement is not an explanation of a person. The experience is more useful
when it is clear about both what it can observe and what it cannot.

## Competition submission checks

Before publication, use the official submission template, verify the current
deadline and tags, and select all three planned categories only if they match
the current rules:

- Best Overall Human-Sensing Experience
- Most Creative or Delightful Use
- Best Thoughtful Real-World Use

Do not submit with unresolved bracketed fields or claim capabilities that
were not demonstrated in the final build.
