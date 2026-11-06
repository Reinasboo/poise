# Poise Demo Recording Script

**Target runtime:** approximately 3 minutes  
**Recording status:** ready to record after the genuine SmartSpectra live gate  
**Truthfulness rule:** Do not use mock or synthetic values, prerecorded footage as
live sensing, or a successful SDK status unless it was observed in the recorded
run. Do not expose the API key, account details, or private session content.

## Before recording

- Use the packaged Windows app or a clean development build on Windows x64.
- Confirm camera permission, network access, and a valid key in the app. Enter
  the key locally; never place it in the capture or terminal.
- Use a quiet, well-lit environment and a non-confidential practice objective.
- Clear prior saved sessions or use a clean app profile.
- Verify the actual SmartSpectra stream, validation, stable sample timestamps,
  and clean stop/restart. If a metric is not genuinely available, say so and
  show Poise leaving it unavailable.
- Disable desktop notifications; close unrelated apps and windows.
- Capture application and terminal separately where practical so no key,
  process arguments, profile path, or unrelated personal data is visible.

## Time-coded story

| Time | Picture and action | Narration |
|---|---|---|
| 0:00–0:18 | Open on the Poise welcome screen. Hold on the headline and practice loop. | “You can prepare your words. But how do you prepare yourself for the moment? Poise is a rehearsal companion for the interview, presentation, or pitch that matters to you.” |
| 0:18–0:38 | Select Interview, enter a simple objective, continue to consent. Show the consent and optional-save controls. | “Before sensing starts, Poise explains what the camera is used for, what stays local, and how to stop. Saving a session is a separate choice.” |
| 0:38–1:08 | Start the SDK and show the actual camera preview and quality guidance. Open the in-memory SmartSpectra diagnostics panel. | “The official SmartSpectra SDK processes camera input locally. Poise waits for the real stream and validation, and keeps missing readings unavailable rather than filling in a guess.” |
| 1:08–1:32 | Show genuine timestamped pulse, breathing, and HRV cards only if valid. Briefly show the real event names in the diagnostics panel. | “These are the values and timestamps emitted in this session. Stability and the SDK’s confidence information guide what Poise can show; the minimum analysis windows do not guarantee an output.” |
| 1:32–1:52 | Enter Observe warm-up and show the orb responding only after valid breathing is available. If unavailable, show the truthful waiting state. Optionally select Guided and show the selected target separate from measured response. | “The warm-up follows valid measured breathing in Observe mode. Guided mode is a pace I selected—not a measured value—and the actual response stays separate.” |
| 1:52–2:17 | Enter the Stage, answer a local interview prompt. Show talking intervals and pauses; avoid capturing confidential speech. | “Poise gives me a prompt and room to practise in my own words. It marks observable talking activity; it does not record, transcribe, or judge my answer.” |
| 2:17–2:42 | Finish rehearsal, show recovery phase, then the actual reflection. | “After a separate recovery check, Poise compares only compatible valid readings. Its next-practice idea comes from what I did or the goal I chose—not an inference about how I feel.” |
| 2:42–3:00 | Show opt-in local save/history and privacy controls; finish on the Poise mark. | “I choose whether to save a summary, and I can delete it from this device. Poise: show up as yourself. At your best.” |

## Capture and edit checklist

- [ ] Show the actual app, actual camera feed, and only genuine SDK data.
- [ ] Show a brief terminal or in-app diagnostics view with SDK lifecycle events;
      keep credentials and sensitive paths out of frame.
- [ ] Include the consent screen and optional local-save choice.
- [ ] Include Observe and Guided labels so target and measurement are not
      confused.
- [ ] Include a real rehearsal activity interval and an honest unavailable
      state if the SDK does not produce a required metric.
- [ ] Include the public repository URL only after it exists and is safe to
      publish.
- [ ] Add captions, legible UI scale, and a clear audio mix.
- [ ] Review the final recording frame by frame for API keys, personal data,
      fabricated claims, and unsupported medical/emotional language.
- [ ] Export the final video and add its URL to the DEV draft and submission
      checklist.

## Current capture assets

- [Welcome screen](./screenshots/welcome.png)
- [Consent screen](./screenshots/consent.png)

These are static, pre-sensing interface captures; they are not evidence of live
SDK measurements.
