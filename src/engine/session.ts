export type SessionPhase =
  | "IDLE"
  | "CONSENT"
  | "CAMERA_SETUP"
  | "CHECK_IN"
  | "WARMUP"
  | "REHEARSAL"
  | "RECOVERY"
  | "REFLECTION"
  | "COMPLETED"
  | "ERROR";

export type SessionKind = "interview" | "presentation" | "pitch" | "camera";
export type MetricName = "pulse" | "breathing" | "hrv";

export interface SignalSample {
  metric: MetricName;
  value: number;
  timestampUs: number;
  confidence?: number;
  stable?: boolean;
}

export interface TalkingInterval {
  startedAt: number;
  endedAt: number;
}

export interface SessionDraft {
  id: string;
  kind: SessionKind;
  objective: string;
  durationSeconds: number;
  startedAt: number;
}

const transitions: Record<SessionPhase, readonly SessionPhase[]> = {
  IDLE: ["CONSENT"],
  CONSENT: ["CAMERA_SETUP", "WARMUP", "IDLE", "ERROR"],
  CAMERA_SETUP: ["CHECK_IN", "CONSENT", "IDLE", "ERROR"],
  CHECK_IN: ["WARMUP", "IDLE", "ERROR"],
  WARMUP: ["REHEARSAL", "IDLE", "ERROR"],
  REHEARSAL: ["RECOVERY", "IDLE", "ERROR"],
  RECOVERY: ["REFLECTION", "IDLE", "ERROR"],
  REFLECTION: ["COMPLETED", "IDLE", "ERROR"],
  COMPLETED: ["IDLE", "CONSENT"],
  ERROR: ["IDLE", "CONSENT"],
};

export function canTransition(from: SessionPhase, to: SessionPhase): boolean {
  return transitions[from].includes(to);
}

export function transition(from: SessionPhase, to: SessionPhase): SessionPhase {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid session transition: ${from} -> ${to}`);
  }
  return to;
}

export const minimumWindowsMs: Record<MetricName, number> = {
  pulse: 12_000,
  breathing: 30_000,
  hrv: 60_000,
};

export const maximumSampleAgeMs = 10_000;

export type SensingPhase = "preparation" | "rehearsal" | "recovery";

export function isStationaryMetricUsable(
  sample: SignalSample,
  phase: SensingPhase,
  phaseStartedAt: number,
  now: number,
): boolean {
  if (phase === "rehearsal") return false;
  if (!Number.isFinite(sample.value) || !Number.isFinite(sample.timestampUs)) {
    return false;
  }
  const sampleTimeMs = sample.timestampUs / 1_000;
  const sampleAgeMs = now - sampleTimeMs;
  if (
    sampleTimeMs < phaseStartedAt ||
    sampleAgeMs < 0 ||
    sampleAgeMs > maximumSampleAgeMs
  ) {
    return false;
  }
  if (sample.stable !== true) return false;
  if (
    sample.confidence !== undefined &&
    (!Number.isFinite(sample.confidence) ||
      sample.confidence <= 0 ||
      sample.confidence > 100)
  ) {
    return false;
  }
  return now - phaseStartedAt >= minimumWindowsMs[sample.metric];
}

export function compareMeasurements(
  baseline: SignalSample | undefined,
  recovery: SignalSample | undefined,
): { baseline: number; recovery: number; delta: number } | null {
  if (!baseline || !recovery) return null;
  if (
    baseline.metric !== recovery.metric ||
    !Number.isFinite(baseline.value) ||
    !Number.isFinite(recovery.value) ||
    baseline.stable !== true ||
    recovery.stable !== true
  ) {
    return null;
  }
  return {
    baseline: baseline.value,
    recovery: recovery.value,
    delta: recovery.value - baseline.value,
  };
}

export function nextPracticeSuggestion(
  speakingIntervals: readonly TalkingInterval[],
  objective: string,
): string {
  const firstInterval = speakingIntervals[0];
  if (firstInterval && firstInterval.startedAt > 5_000) {
    return "Try beginning your answer a little sooner next time.";
  }
  if (speakingIntervals.length > 0) {
    return objective.trim()
      ? `Keep practising toward your goal: ${objective.trim()}`
      : "Try another rehearsal and notice which opening feels most natural.";
  }
  return "Try a short opening when you feel ready to begin.";
}

export function createSessionDraft(
  kind: SessionKind,
  objective: string,
  durationSeconds: number,
  now = Date.now(),
): SessionDraft {
  return {
    id: crypto.randomUUID(),
    kind,
    objective,
    durationSeconds,
    startedAt: now,
  };
}
