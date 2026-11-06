# Camera and Data Consent

## Before starting

Poise should present the following disclosures before the user enables camera
sensing:

- The camera is used for live SmartSpectra sensing, which can include pulse,
  breathing, and observable facial activity such as face visibility, talking,
  and blinking.
- Poise does not record or upload camera video. Live measurements are held in
  memory for the practice and are not automatically saved.
- The user can stop sensing at any time. Stopping ends the SDK session and
  releases the camera through the SDK lifecycle.
- SmartSpectra must authenticate the user's API key. Poise disables optional
  SDK telemetry; authentication and other required Presage service
  communication still occur.
- Saving a session summary is a separate opt-in choice. Saved summaries remain
  on this device and can be deleted in the app.
- Feedback is informational rehearsal support, not medical assessment or
  diagnosis. Signals do not reveal confidence, anxiety, honesty, or emotional
  state.

## Consent controls

The camera consent checkbox is required before the “Enable camera and check
in” action is enabled. OS-level camera permission is also required. Declining
or leaving the checkbox unchecked must not start SmartSpectra or request camera
access.

The “Save this session summary locally” checkbox is independent, optional, and
off by default. Users may practise without saving. Granting camera consent
does not authorize storage of raw video or raw face landmarks.

## During and after a session

The app shows camera/sensing status and offers Stop sensing while the SDK is
active. Stop, cancel, errors, completion, and app shutdown must invoke SDK
cleanup; a failed cleanup is surfaced to the user rather than represented as a
successful stop.

Users can review and delete individual saved summaries or confirm deletion of
all local Poise data in Settings. Deletion confirmation must explain that the
action cannot be undone. Poise does not offer a remote account or remote
deletion request in this MVP.

## Measurement limits

Measurements may be absent, unstable, stale, or below the SDK's quality
requirements. Poise omits them rather than substituting zero or presenting a
fabricated value. Minimum sample windows (12 seconds for pulse, 30 seconds for
breathing, 60 seconds for HRV) do not guarantee that a valid result will be
available. Breathing comparisons are suppressed during talking activity.

## Implementation note

The current consent UI includes the disclosures above and a separate optional
save checkbox. The user-entered API key is needed by the official renderer SDK
and exists in renderer memory during the session; it is not persisted or
logged by Poise. See [PRIVACY.md](./PRIVACY.md) for the full storage and
service-communication description.
