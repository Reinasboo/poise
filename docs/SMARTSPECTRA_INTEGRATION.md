# SmartSpectra Integration

## Verified SDK details

- Package: `@smartspectra/node-sdk` (pinned to `3.4.0`).
- Official platform: Node.js/Electron.
- Host: Windows x64; official docs list Windows x64 as supported.
- Node.js requirement: `>=20`; the implementation environment currently has Node `v24.19.0`.
- Electron integration uses `@smartspectra/node-sdk/main`, the official
  `@smartspectra/node-sdk/preload`, and `@smartspectra/node-sdk/renderer`.
- The renderer SDK owns camera acquisition and sends frames through the official preload/main
  bridge. It emits `streamAvailable` with the camera `MediaStream`.
- Decode the SDK `metrics` event payload using
  `decodeMetrics` from `@smartspectra/node-sdk/messages`.
- Request `breathingMetrics`, `cardioMetrics`, and `faceMetrics` explicitly. Fields that were not
  requested or are not authorized for the API key can be absent; absence is not a zero value.
- SDK lifecycle events include `processingStatus`, `validationStatus`, `metrics`, and `error`.
  The Electron renderer sample additionally uses `streamAvailable`.
- The current Poise session screen has a collapsed, bounded in-memory diagnostics panel for
  recent stream, processing, validation, metrics-received, and stop/error events. It does not
  record API keys, raw video, or persistent event logs.
- The SDK option `enableTelemetry` defaults to `true`; Poise must explicitly pass `false`.
- Official current references:
  - [Node.js/Electron SDK](https://smartspectra.presagetech.com/docs/nodejs.md)
  - [API reference](https://smartspectra.presagetech.com/docs/nodejs/api-reference.md)
  - [Metric configuration and payload](https://smartspectra.presagetech.com/docs/nodejs/metrics.md)
  - [Data types](https://smartspectra.presagetech.com/docs/data-types.md)
  - [Maintained Electron quickstart](https://github.com/Presage-Security/SmartSpectra/tree/main/nodejs/samples/electron-quickstart)

## Runtime measurement handling

The decoded payload has optional `breathing`, `cardio`, and `face` sections. The documented
fields include breathing rate and chest/abdomen traces; cardio pulse rate, HRV, and a relative
arterial-pressure trace; and face landmarks, talking, blinking, and expression observations.
Physiological samples carry values and stability/confidence/timestamp metadata according to the
field schema. Face detections carry detection, stability, and timestamp.

The product layer must retain metric identity, value, timestamp, confidence, and stability when
available. Use only actual stable samples after the applicable Poise stationary capture window:
pulse 12 seconds, breathing 30 seconds, and HRV 60 seconds. A minimum time elapsed does not
guarantee that a valid reading will be emitted. The SDK validation status and actual sample
metadata are authoritative; show guidance and omit unavailable values rather than inventing or
zero-filling them. Displayed live readings expire when their SDK timestamp is more than 10 seconds
old or lies in the future relative to the application clock.

Breathing is not considered a valid stationary comparison while the user is speaking. The
relative arterial-pressure waveform is never a blood-pressure measurement. Talking detection is
activity only, not a transcript or semantic/emotional assessment.

## Credentials and privacy

SmartSpectra requires a valid API key and network access for authentication/subscription
validation. According to the SDK skill and documentation, metrics are computed on-device; the
service connection for authentication is distinct from Poise-owned storage or uploads. Disabling
SDK telemetry does not disable authentication or other required SDK service communication.

Poise never commits credentials or places a key in a Vite `VITE_*` variable (which would embed it
in the renderer bundle). The app requests the key at session start and keeps it in memory only.
Do not log it, persist it, or include it in screenshots or diagnostics. Users should obtain keys
from the [Presage developer portal](https://physiology.presagetech.com/auth/login).

## First live-sensing gate

**Status: Pending an API key and real runtime validation.** The current implementation
environment has a Windows x64 integrated webcam and Node.js 24.19.0, but no
`SMARTSPECTRA_API_KEY` or `VITE_SMARTSPECTRA_API_KEY` environment variable was present at
initial inspection. Do not mark the technical proof complete until a user-provided key is entered,
camera permission is granted, and the app receives genuine SDK stream, validation, and metric
events. No simulated values may be represented as live.

Before calling Gate 1 complete, record the installed package version, camera/SDK startup result,
real event/payload verification, telemetry configuration, and stop/release/restart behavior here.
