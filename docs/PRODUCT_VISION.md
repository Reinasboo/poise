# Poise Product Vision

## North star

**Show up as yourself. At your best.** Poise helps people prepare for important
interviews, presentations, pitches, and on-camera moments by connecting a
private, camera-based check-in to practical rehearsal and reflection.

The product is a rehearsal companion, not a biometric dashboard. Human signals
should change or inform the experience, not be presented as a diagnosis or
judgment about the person.

## Audience and need

The first user is someone preparing for an important interview. Presenters,
pitchers, and people practising on camera share the same need: a useful way to
settle into practice, rehearse their own words, and notice observable patterns
without being evaluated by an opaque AI system.

**Job to be done:** Before an important moment, help me prepare deliberately,
practise in my own words, and reflect on what I actually did.

## The product loop

1. **Choose a practice.** Select an interview, presentation, pitch, or camera
   session, a personal objective, and a duration.
2. **Choose whether to sense.** Review camera, data, service-communication, and
   non-medical disclosures. Explicitly enable camera use or continue without
   sensing; local saving is separate and optional.
3. **Check in.** Offer calm framing and lighting guidance. Show only stable,
   sufficiently current SDK measurements with their timestamps and available
   confidence information. Missing signals stay unavailable.
4. **Warm up.** In Observe mode, the visualization follows a valid measured
   breathing rate. In Guided mode, the selected pace is clearly a target, not a
   measurement; the measured response remains separate.
5. **Rehearse.** Practise with a local interview prompt or a user-entered topic.
   Show talking activity and observable intervals only; do not transcribe or
   infer emotion, confidence, honesty, or anxiety.
6. **Recover and reflect.** Collect a separate stationary reading where
   possible. Compare only valid, matching readings, then offer a suggestion
   grounded in the selected goal or observed practice.
7. **Choose what to keep.** Save an optional local summary, revisit it, or
   delete one or all saved summaries.

## Experience principles

- **Truth before completeness:** SDK validation and sample metadata determine
  what can be shown. A missing result is not zero.
- **Non-judgmental:** No red-alert biometric dashboard, population norm, or
  claim about a person's inner state.
- **User control:** Consent precedes sensing; camera stop is always available;
  camera-free practice is available; saving is opt-in; local data is deletable
  and saved summaries can be reviewed.
- **Practical:** Every measurement or animation supports a rehearsal action.
- **Private by default:** No account, cloud database, automatic upload, or
  third-party AI in this MVP. Non-sensitive practice preferences stay local;
  API credentials and camera consent are never saved as preferences.
- **Accessible and calm:** Clear language, usable interaction targets, and
  restrained motion support different desktop sizes and comfort levels.

## MVP scope

The Windows-first Electron app uses SmartSpectra for live supported camera
signals; React, TypeScript, and Vite for the interface; and local SQLite
summaries for opt-in history. It supports interviews, presentations, pitches,
and speaking on camera. Camera frames and live measurements are not stored by
Poise. Session summaries are stored only when the user opts in.

The MVP does not include accounts, cloud sync, generated questions, speech
transcription, semantic speech analysis, medical assessment, blood-pressure
readings, monetization, or mobile/team products. Talking detection is activity
only. The SmartSpectra relative arterial-pressure waveform is not a blood
pressure measurement and is not part of the Poise experience.

## Success criteria

- A user can understand and complete the practice journey without being
  promised a measurement the SDK has not validated.
- Valid live signals inform the check-in and responsive warm-up; unavailable or
  invalid signals remain clearly unavailable.
- A rehearsal can complete and produce a grounded reflection without
  transcription or unsupported personal-state claims.
- A user can complete practice without enabling camera sensing or providing an
  API key; sensing-dependent observations remain unavailable.
- Saving, review, and deletion are user-controlled and local.
- A fresh Windows package starts, requests camera access only after consent,
  and releases sensing resources when stopped.

## Future ideas, not MVP commitments

An AI practice partner, more scenarios, separate-consent transcription,
presentation-structure analysis, user-defined routines, mobile, optional
encrypted sync, and team editions require separate validation and privacy
decisions. They are not active product requirements.
