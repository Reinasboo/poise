import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canTransition,
  compareMeasurements,
  createSessionDraft,
  isStationaryMetricUsable,
  nextPracticeSuggestion,
  transition,
  type MetricName,
  type SessionDraft,
  type SessionKind,
  type SessionPhase,
  type SignalSample,
  type TalkingInterval,
} from "./engine/session";
import {
  smartSpectraClient,
  type LiveMetrics,
} from "./integrations/smartspectra/client";
import {
  sessionStore,
  type StoredSession,
} from "./services/sessionStore";
import {
  defaultPreferences,
  readPreferences,
  resetPreferences,
  writePreferences,
} from "./services/preferencesStore";

type Screen =
  | "home"
  | "setup"
  | "session"
  | "history"
  | "progress"
  | "settings"
  | "about";
type SamplesByMetric = Partial<Record<MetricName, SignalSample>>;
type WarmupMode = "observe" | "guided";
interface DiagnosticEntry {
  occurredAt: number;
  event: string;
  detail: string;
}

const interviewQuestions = [
  "Tell me about a project or piece of work you’re especially proud of.",
  "What is a challenge you learned something important from?",
  "How do you approach a problem when the answer is not obvious?",
  "What kind of work gives you energy?",
  "Tell me about a time you worked with someone whose approach differed from yours.",
  "What would you like to learn in your next role?",
  "How do you decide what to focus on when priorities compete?",
  "What would you like us to remember about you?",
];

const scenarioInfo: Record<SessionKind, { label: string; description: string; mark: string }> = {
  interview: {
    label: "Interview",
    description: "Practise thoughtful answers with a locally stored question prompt.",
    mark: "01",
  },
  presentation: {
    label: "Presentation",
    description: "Rehearse a topic or short outline in your own words.",
    mark: "02",
  },
  pitch: {
    label: "Pitch",
    description: "Shape a focused pitch and practise to a chosen time.",
    mark: "03",
  },
  camera: {
    label: "Speaking on camera",
    description: "Get comfortable delivering a message to the camera.",
    mark: "04",
  },
};

function Icon({
  name,
  className = "nav-icon",
}: {
  name: "home" | "play" | "sessions" | "progress" | "settings" | "arrow" | "close" | "shield";
  className?: string;
}) {
  const paths: Record<typeof name, string> = {
    home: "M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6",
    play: "m8 5 11 7-11 7z",
    sessions: "M5 4h14v16H5zM8 8h8M8 12h8M8 16h5",
    progress: "M4 19V5m0 14h17M7 15l4-4 3 2 6-7",
    settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 13.5l2 1.2-2 3.5-2.2-1a7.8 7.8 0 0 1-1.6.9l-.3 2.4h-4l-.3-2.4a7.8 7.8 0 0 1-1.6-.9l-2.2 1-2-3.5 2-1.2a8 8 0 0 1 0-1.8l-2-1.2 2-3.5 2.2 1a7.8 7.8 0 0 1 1.6-.9l.3-2.4h4l.3 2.4a7.8 7.8 0 0 1 1.6.9l2.2-1 2 3.5-2 1.2a8 8 0 0 1 0 1.8Z",
    arrow: "M4 12h15m-6-6 6 6-6 6",
    close: "m6 6 12 12M18 6 6 18",
    shield: "M12 3 5 6v5c0 4.7 2.9 8.2 7 10 4.1-1.8 7-5.3 7-10V6zM9 12l2 2 4-4",
  };
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redactSensitiveText(message: string, secret: string): string {
  const exactSecret = secret.trim();
  return (exactSecret ? message.split(exactSecret).join("[redacted]") : message)
    .replace(
      /((?:api[_-]?key|authorization|access[_-]?token)\s*[:=]\s*["']?)[^\s"'&,]+/gi,
      "$1[redacted]",
    );
}

function displayMetric(
  sample: SignalSample | undefined,
  unit: string,
): { value: string; unit: string } {
  if (!sample) return { value: "—", unit: "Not available" };
  return {
    value: sample.value.toFixed(sample.metric === "hrv" ? 1 : 0),
    unit,
  };
}

function confidenceNote(
  baseline: SignalSample | undefined,
  recovery: SignalSample | undefined,
): string {
  if (!baseline || !recovery) return "A valid compatible pair was not available";
  const baselineConfidence =
    baseline.confidence === undefined
      ? "confidence unavailable"
      : `${baseline.confidence.toFixed(0)}% confidence`;
  const recoveryConfidence =
    recovery.confidence === undefined
      ? "confidence unavailable"
      : `${recovery.confidence.toFixed(0)}% confidence`;
  return `Stable SDK readings · baseline ${baselineConfidence} · recovery ${recoveryConfidence}`;
}

function sampleIsCurrent(
  sample: SignalSample | undefined,
  phase: SessionPhase,
  startedAt: number,
  now: number,
): sample is SignalSample {
  if (!sample) return false;
  const sensingPhase = phase === "RECOVERY" ? "recovery" : "preparation";
  if (phase !== "CHECK_IN" && phase !== "WARMUP" && phase !== "RECOVERY") {
    return false;
  }
  return isStationaryMetricUsable(sample, sensingPhase, startedAt, now);
}

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [phase, setPhase] = useState<SessionPhase>("IDLE");
  const phaseRef = useRef<SessionPhase>("IDLE");
  const sensingAttemptRef = useRef(0);
  const [kind, setKind] = useState<SessionKind>(defaultPreferences.kind);
  const [session, setSession] = useState<SessionDraft | null>(null);
  const [objective, setObjective] = useState("");
  const [topic, setTopic] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(defaultPreferences.durationMinutes);
  const [apiKey, setApiKey] = useState("");
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [saveLocally, setSaveLocally] = useState(false);
  const [sessionUsesCamera, setSessionUsesCamera] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [warmupMode, setWarmupMode] = useState<WarmupMode>("observe");
  const [guidedRate, setGuidedRate] = useState(defaultPreferences.guidedRate);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preferencesWritable, setPreferencesWritable] = useState(true);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [latestSamples, setLatestSamples] = useState<SamplesByMetric>({});
  const [baseline, setBaseline] = useState<SamplesByMetric>({});
  const [recovery, setRecovery] = useState<SamplesByMetric>({});
  const [waveform, setWaveform] = useState<number[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [faceVisible, setFaceVisible] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const attachVideo = useCallback(
    (video: HTMLVideoElement | null) => {
      videoRef.current = video;
      if (!video || !stream) return;
      video.srcObject = stream;
      void video.play().catch((error: unknown) => {
        setSdkError(`Camera preview could not start: ${errorMessage(error)}`);
      });
    },
    [stream],
  );
  const [validation, setValidation] = useState("Waiting for camera and SDK validation.");
  const [processingStatus, setProcessingStatus] = useState("Not started");
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [sdkError, setSdkError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [preferencesError, setPreferencesError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [phaseStartedAt, setPhaseStartedAt] = useState(0);
  const phaseStartedAtRef = useRef(0);
  const rehearsalStartedAtRef = useRef(0);
  const lastTalkingTimestampRef = useRef(0);
  const lastBlinkTimestampRef = useRef(0);
  const lastMetricsDiagnosticAtRef = useRef(0);
  const talkingStateRef = useRef(false);
  const openIntervalStartedAtRef = useRef<number | null>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [talkingIntervals, setTalkingIntervals] = useState<TalkingInterval[]>([]);
  const [pauseCount, setPauseCount] = useState(0);
  const [blinkCount, setBlinkCount] = useState(0);
  const [practiceDurationMs, setPracticeDurationMs] = useState(0);
  const [history, setHistory] = useState<StoredSession[]>([]);
  const [completedSummary, setCompletedSummary] = useState<StoredSession | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [warmupStartedAt, setWarmupStartedAt] = useState(0);
  const [warmupElapsedMs, setWarmupElapsedMs] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  const isSensing =
    sessionUsesCamera &&
    (stream !== null ||
      phase === "CAMERA_SETUP" ||
      phase === "CHECK_IN" ||
      phase === "WARMUP" ||
      phase === "REHEARSAL" ||
      phase === "RECOVERY");

  const setSessionPhase = useCallback((next: SessionPhase) => {
    const current = phaseRef.current;
    if (current !== next && !canTransition(current, next)) {
      throw new Error(`Invalid session transition: ${current} -> ${next}`);
    }
    if (current !== next) transition(current, next);
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await sessionStore.list());
      setStorageError("");
    } catch (error) {
      setStorageError(`Local session storage is unavailable: ${errorMessage(error)}`);
    }
  }, []);

  const recordDiagnostic = useCallback((event: string, detail: string) => {
    setDiagnostics((previous) => [
      ...previous.slice(-19),
      { occurredAt: Date.now(), event, detail },
    ]);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    try {
      const saved = readPreferences();
      setKind(saved.kind);
      setDurationMinutes(saved.durationMinutes);
      setGuidedRate(saved.guidedRate);
      setPreferencesWritable(true);
    } catch (error) {
      setPreferencesWritable(false);
      setPreferencesError(`Could not load local practice preferences: ${errorMessage(error)}`);
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesReady || !preferencesWritable) return;
    try {
      writePreferences({ kind, durationMinutes, guidedRate });
      setPreferencesError("");
    } catch (error) {
      setPreferencesError(`Could not save local practice preferences: ${errorMessage(error)}`);
    }
  }, [durationMinutes, guidedRate, kind, preferencesReady, preferencesWritable]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch((error: unknown) => {
      setSdkError(`Camera preview could not start: ${errorMessage(error)}`);
    });
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const onBeforeUnload = () => {
      void smartSpectraClient.stop().catch((error: unknown) => {
        console.error(
          "Poise could not cleanly stop SmartSpectra during window close.",
          redactSensitiveText(errorMessage(error), apiKeyRef.current),
        );
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const resetSessionState = useCallback(() => {
    setSession(null);
    setLatestSamples({});
    setBaseline({});
    setRecovery({});
    setWaveform([]);
    setFaceVisible(null);
    setTalkingIntervals([]);
    setPauseCount(0);
    setBlinkCount(0);
    setPracticeDurationMs(0);
    setCompletedSummary(null);
    setIsTalking(false);
    talkingStateRef.current = false;
    openIntervalStartedAtRef.current = null;
    lastTalkingTimestampRef.current = 0;
    lastBlinkTimestampRef.current = 0;
    setSdkError("");
    setSaveError("");
    setDiagnostics([]);
    lastMetricsDiagnosticAtRef.current = 0;
    setValidation("Waiting for camera and SDK validation.");
  }, []);

  const beginNewSession = useCallback(() => {
    if (phaseRef.current === "COMPLETED" || phaseRef.current === "ERROR") {
      setSessionPhase("IDLE");
    }
    resetSessionState();
    setObjective("");
    setTopic("");
    setApiKey("");
    setConsentAccepted(false);
    setSaveLocally(false);
    setSessionUsesCamera(false);
    setSelectedHistoryId(null);
    setScreen("setup");
  }, [resetSessionState, setSessionPhase]);

  const continueToConsent = useCallback(() => {
    if (phaseRef.current !== "IDLE") setSessionPhase("IDLE");
    const nextSession = createSessionDraft(
      kind,
      objective.trim(),
      durationMinutes * 60,
    );
    setSession(nextSession);
    setQuestionIndex(Math.floor(Math.random() * interviewQuestions.length));
    setSessionPhase("CONSENT");
    setScreen("session");
  }, [durationMinutes, kind, objective, setSessionPhase]);

  const continueWithoutCamera = useCallback(() => {
    setSessionUsesCamera(false);
    setApiKey("");
    setWarmupMode("guided");
    setWarmupStartedAt(Date.now());
    setSessionPhase("WARMUP");
  }, [setSessionPhase]);

  const handleMetrics = useCallback((metrics: LiveMetrics) => {
    const currentPhase = phaseRef.current;
    const eventTime = Date.now();
    if (metrics.faceVisible !== null) setFaceVisible(metrics.faceVisible);
    if (
      currentPhase === "CHECK_IN" ||
      currentPhase === "WARMUP" ||
      currentPhase === "RECOVERY"
    ) {
      const sensingPhase = currentPhase === "RECOVERY" ? "recovery" : "preparation";
      const verifiedNotTalking =
        metrics.talking?.stable === true && metrics.talking.detected === false;
      const talkingTimestampUs = metrics.talking?.timestampUs;
      for (const sample of metrics.samples) {
        if (
          sample.metric === "breathing" &&
          (!verifiedNotTalking ||
            talkingTimestampUs === undefined ||
            talkingTimestampUs < sample.timestampUs)
        ) {
          continue;
        }
        if (
          isStationaryMetricUsable(
            sample,
            sensingPhase,
            phaseStartedAtRef.current,
            eventTime,
          )
        ) {
          setLatestSamples((previous) => ({
            ...previous,
            [sample.metric]: sample,
          }));
          if (currentPhase === "CHECK_IN") {
            setBaseline((previous) => ({ ...previous, [sample.metric]: sample }));
          } else if (currentPhase === "RECOVERY") {
            setRecovery((previous) => ({ ...previous, [sample.metric]: sample }));
          }
        }
      }
      if (
        verifiedNotTalking &&
        talkingTimestampUs !== undefined &&
        metrics.breathingWaveformTimestampUs !== undefined &&
        talkingTimestampUs >= metrics.breathingWaveformTimestampUs &&
        metrics.breathingWaveform.length > 0
      ) {
        setWaveform(metrics.breathingWaveform);
      }
    }

    if (
      currentPhase === "REHEARSAL" &&
      metrics.talking?.stable &&
      metrics.talking.timestampUs > lastTalkingTimestampRef.current
    ) {
      lastTalkingTimestampRef.current = metrics.talking.timestampUs;
      const detectedAtMs = Math.max(
        0,
        metrics.talking.timestampUs / 1_000 - rehearsalStartedAtRef.current,
      );
      if (metrics.talking.detected && !talkingStateRef.current) {
        talkingStateRef.current = true;
        openIntervalStartedAtRef.current = detectedAtMs;
        setIsTalking(true);
      } else if (!metrics.talking.detected && talkingStateRef.current) {
        const startedAt = openIntervalStartedAtRef.current ?? detectedAtMs;
        setTalkingIntervals((previous) => [
          ...previous,
          { startedAt, endedAt: Math.max(startedAt, detectedAtMs) },
        ]);
        openIntervalStartedAtRef.current = null;
        talkingStateRef.current = false;
        setIsTalking(false);
        setPauseCount((previous) => previous + 1);
      }
    }

    if (
      currentPhase === "REHEARSAL" &&
      metrics.blinking?.detected &&
      metrics.blinking.stable &&
      metrics.blinking.timestampUs > lastBlinkTimestampRef.current
    ) {
      lastBlinkTimestampRef.current = metrics.blinking.timestampUs;
      setBlinkCount((previous) => previous + 1);
    }
  }, []);

  const startSensing = useCallback(async () => {
    if (!consentAccepted) {
      setSdkError("Please review and accept the camera and data disclosure before continuing.");
      return;
    }
    if (!apiKey.trim()) {
      setSdkError("Enter your SmartSpectra API key to start live sensing.");
      return;
    }
    const attempt = ++sensingAttemptRef.current;
    setIsBusy(true);
    setSessionUsesCamera(true);
    setSdkError("");
    setDiagnostics([]);
    lastMetricsDiagnosticAtRef.current = 0;
    recordDiagnostic("session", "Sensing start requested; API key not recorded.");
    setSessionPhase("CAMERA_SETUP");
    const stopAfterSdkFailure = (message: string) => {
      setSessionPhase("ERROR");
      recordDiagnostic("cleanup", "Fatal SDK state; stopping and destroying the SDK.");
      void smartSpectraClient.stop().then(
        () => {
          if (attempt !== sensingAttemptRef.current) return;
          setStream(null);
          setApiKey("");
          setSessionUsesCamera(false);
          setProcessingStatus("Stopped");
          recordDiagnostic("cleanup", "SDK stop and destroy completed.");
        },
        (cleanupError: unknown) => {
          if (attempt !== sensingAttemptRef.current) return;
          const safeCleanupError = redactSensitiveText(
            errorMessage(cleanupError),
            apiKey,
          );
          recordDiagnostic("cleanup error", safeCleanupError);
          setSdkError(
            `${message} Camera cleanup also failed: ${safeCleanupError}`,
          );
        },
      );
    };
    try {
      await smartSpectraClient.start(apiKey, {
        onStream: (nextStream) => {
          if (attempt === sensingAttemptRef.current) {
            setStream(nextStream);
            recordDiagnostic("streamAvailable", "Camera media stream received.");
          }
        },
        onMetrics: (metrics) => {
          if (attempt !== sensingAttemptRef.current) return;
          handleMetrics(metrics);
          const receivedAt = Date.now();
          if (receivedAt - lastMetricsDiagnosticAtRef.current < 5_000) return;
          lastMetricsDiagnosticAtRef.current = receivedAt;
          const metricNames = [...new Set(metrics.samples.map(({ metric }) => metric))];
          const received = metricNames.length > 0
            ? metricNames.join(", ")
            : "no numeric samples";
          recordDiagnostic(
            "metrics",
            `Decoded SDK metrics event: ${received}; face ${metrics.faceVisible === null ? "unknown" : metrics.faceVisible ? "visible" : "not visible"}.`,
          );
        },
        onProcessingStatus: (status) => {
          if (attempt !== sensingAttemptRef.current) return;
          setProcessingStatus(status);
          recordDiagnostic("processingStatus", status);
          if (status === "Error") {
            const message = "SmartSpectra entered an error state.";
            setSdkError(redactSensitiveText(message, apiKey));
            stopAfterSdkFailure(message);
          }
          if (status === "Running" && phaseRef.current === "CAMERA_SETUP") {
            const startedAt = Date.now();
            phaseStartedAtRef.current = startedAt;
            setPhaseStartedAt(startedAt);
            setSessionPhase("CHECK_IN");
          }
        },
        onValidation: (hint, timestampUs) => {
          if (attempt !== sensingAttemptRef.current) return;
          const safeHint = redactSensitiveText(hint, apiKey);
          setValidation(
            `${safeHint} · ${new Date(timestampUs / 1_000).toLocaleTimeString()}`,
          );
          recordDiagnostic(
            "validationStatus",
            `${safeHint} · ${new Date(timestampUs / 1_000).toLocaleTimeString()}`,
          );
        },
        onError: (message, retryable) => {
          if (attempt !== sensingAttemptRef.current) return;
          const safeMessage = redactSensitiveText(message, apiKey);
          setSdkError(`${safeMessage}${retryable ? " You can try again." : ""}`);
          recordDiagnostic(
            "SDK error",
            retryable ? "Retryable SDK error; details shown above." : "Non-retryable SDK error; details shown above.",
          );
          if (!retryable) {
            stopAfterSdkFailure(safeMessage);
          }
        },
      });
      if (
        attempt === sensingAttemptRef.current &&
        phaseRef.current === "CAMERA_SETUP"
      ) {
        const startedAt = Date.now();
        phaseStartedAtRef.current = startedAt;
        setPhaseStartedAt(startedAt);
        setSessionPhase("CHECK_IN");
      }
    } catch (error) {
      if (attempt !== sensingAttemptRef.current) return;
      const message = errorMessage(error);
      const safeMessage = redactSensitiveText(message, apiKey);
      setSdkError(safeMessage);
      recordDiagnostic("start error", safeMessage);
      setApiKey("");
      setSessionUsesCamera(false);
      try {
        await smartSpectraClient.stop();
        setStream(null);
      } catch (cleanupError) {
        const safeCleanupError = redactSensitiveText(
          errorMessage(cleanupError),
          apiKey,
        );
        recordDiagnostic("cleanup error", safeCleanupError);
        setSdkError(
          `${safeMessage} Camera cleanup also failed: ${safeCleanupError}`,
        );
      }
      setSessionPhase("ERROR");
    } finally {
      if (attempt === sensingAttemptRef.current) setIsBusy(false);
    }
  }, [apiKey, consentAccepted, handleMetrics, recordDiagnostic, setSessionPhase]);

  const stopSensing = useCallback(async (returnHome = true): Promise<boolean> => {
    sensingAttemptRef.current += 1;
    setIsBusy(true);
    setIsStopping(true);
    try {
      await smartSpectraClient.stop();
      recordDiagnostic("stop", "SDK stop and destroy completed.");
      setStream(null);
      setApiKey("");
      setSessionUsesCamera(false);
      setProcessingStatus("Stopped");
      setIsTalking(false);
      talkingStateRef.current = false;
      openIntervalStartedAtRef.current = null;
      if (phaseRef.current !== "IDLE") setSessionPhase("IDLE");
      if (returnHome) setScreen("home");
      return true;
    } catch (error) {
      const safeMessage = redactSensitiveText(errorMessage(error), apiKey);
      recordDiagnostic("stop error", safeMessage);
      setSdkError(`Could not stop camera sensing cleanly: ${safeMessage}`);
      return false;
    } finally {
      setIsBusy(false);
      setIsStopping(false);
    }
  }, [apiKey, recordDiagnostic, setSessionPhase]);

  const enterWarmup = useCallback(() => {
    setSessionPhase("WARMUP");
    setWarmupStartedAt(Date.now());
  }, [setSessionPhase]);

  const enterRehearsal = useCallback(() => {
    const startedAt = Date.now();
    rehearsalStartedAtRef.current = startedAt;
    lastTalkingTimestampRef.current = 0;
    lastBlinkTimestampRef.current = 0;
    talkingStateRef.current = false;
    openIntervalStartedAtRef.current = null;
    setTalkingIntervals([]);
    setPauseCount(0);
    setBlinkCount(0);
    setIsTalking(false);
    setPracticeDurationMs(0);
    setSessionPhase("REHEARSAL");
  }, [setSessionPhase]);

  const enterRecovery = useCallback(() => {
    const endedAt = Date.now();
    setPracticeDurationMs(Math.max(0, endedAt - rehearsalStartedAtRef.current));
    if (talkingStateRef.current && openIntervalStartedAtRef.current !== null) {
      const elapsedMs = Math.max(0, endedAt - rehearsalStartedAtRef.current);
      setTalkingIntervals((previous) => [
        ...previous,
        {
          startedAt: openIntervalStartedAtRef.current ?? elapsedMs,
          endedAt: Math.max(
            openIntervalStartedAtRef.current ?? elapsedMs,
            elapsedMs,
          ),
        },
      ]);
    }
    setIsTalking(false);
    talkingStateRef.current = false;
    openIntervalStartedAtRef.current = null;
    setLatestSamples({});
    setRecovery({});
    const startedAt = Date.now();
    phaseStartedAtRef.current = startedAt;
    setPhaseStartedAt(startedAt);
    setSessionPhase("RECOVERY");
  }, [setSessionPhase]);

  useEffect(() => {
    if (
      phase === "REHEARSAL" &&
      now - rehearsalStartedAtRef.current >= durationMinutes * 60_000
    ) {
      enterRecovery();
    }
  }, [durationMinutes, enterRecovery, now, phase]);

  const finishRecovery = useCallback(async () => {
    if (!sessionUsesCamera) {
      setSessionPhase("REFLECTION");
      return;
    }
    setIsBusy(true);
    try {
      await smartSpectraClient.stop();
      recordDiagnostic("stop", "Recovery ended; SDK stop and destroy completed.");
      setStream(null);
      setApiKey("");
      setSessionUsesCamera(false);
      setProcessingStatus("Stopped");
      setSessionPhase("REFLECTION");
    } catch (error) {
      const safeMessage = redactSensitiveText(errorMessage(error), apiKey);
      recordDiagnostic("stop error", safeMessage);
      setSdkError(`Could not stop camera sensing cleanly: ${safeMessage}`);
    } finally {
      setIsBusy(false);
    }
  }, [apiKey, recordDiagnostic, sessionUsesCamera, setSessionPhase]);

  const completeSession = useCallback(async () => {
    if (!session) return;
    setIsBusy(true);
    const intervalCount =
      talkingIntervals.length + (talkingStateRef.current ? 1 : 0);
    const suggestion = nextPracticeSuggestion(talkingIntervals, session.objective);
    const summary: StoredSession = {
      id: session.id,
      kind: session.kind,
      createdAt: session.startedAt,
      durationMs: practiceDurationMs,
      objective: session.objective,
      practiceCompleted: practiceDurationMs > 0,
      baselinePulse: baseline.pulse?.value,
      recoveryPulse: recovery.pulse?.value,
      baselineBreathing: baseline.breathing?.value,
      recoveryBreathing: recovery.breathing?.value,
      baselineHrv: baseline.hrv?.value,
      recoveryHrv: recovery.hrv?.value,
      details: {
        baseline,
        recovery,
        talkingIntervals,
        blinkCount,
        cameraSensingUsed: sessionUsesCamera,
      },
      speakingIntervals: intervalCount,
      pauses: pauseCount,
      suggestion,
    };
    setCompletedSummary(summary);
    setSaveError("");
    try {
      if (sessionUsesCamera) {
        await smartSpectraClient.stop();
        recordDiagnostic("stop", "Session finished; SDK stop and destroy completed.");
        setStream(null);
        setApiKey("");
        setSessionUsesCamera(false);
        setProcessingStatus("Stopped");
      }
      if (saveLocally) {
        await sessionStore.save(summary);
        await loadHistory();
      }
      setSessionPhase("COMPLETED");
    } catch (error) {
      setSaveError(
        `The session could not be saved or camera sensing could not be stopped: ${redactSensitiveText(errorMessage(error), apiKey)}`,
      );
      setSdkError(redactSensitiveText(errorMessage(error), apiKey));
      recordDiagnostic("finish error", "Session finish failed; details shown above.");
    } finally {
      setIsBusy(false);
    }
  }, [
    baseline,
    loadHistory,
    apiKey,
    pauseCount,
    practiceDurationMs,
    recordDiagnostic,
    recovery,
    saveLocally,
    session,
    sessionUsesCamera,
    setSessionPhase,
    talkingIntervals,
  ]);

  const deleteSession = useCallback(async (id: string) => {
    if (!window.confirm("Delete this saved session from this device?")) return;
    try {
      await sessionStore.delete(id);
      setSelectedHistoryId((selectedId) => selectedId === id ? null : selectedId);
      await loadHistory();
    } catch (error) {
      setStorageError(`Could not delete the saved session: ${errorMessage(error)}`);
    }
  }, [loadHistory]);

  const deleteAllData = useCallback(async () => {
    const confirmed = window.confirm(
      "Delete all saved Poise session summaries from this device? This cannot be undone.",
    );
    if (!confirmed) return;
    try {
      await sessionStore.deleteAll();
      setHistory([]);
      setSelectedHistoryId(null);
      setStorageError("");
    } catch (error) {
      setStorageError(`Could not delete all local Poise data: ${errorMessage(error)}`);
    }
  }, []);

  const restoreDefaultPreferences = useCallback(() => {
    try {
      resetPreferences();
      setKind(defaultPreferences.kind);
      setDurationMinutes(defaultPreferences.durationMinutes);
      setGuidedRate(defaultPreferences.guidedRate);
      setPreferencesWritable(true);
      setPreferencesError("");
    } catch (error) {
      setPreferencesError(`Could not reset local practice preferences: ${errorMessage(error)}`);
    }
  }, []);

  const activeSamples = useMemo(() => {
    const sensingStarted = phaseStartedAt;
    return {
      pulse: sampleIsCurrent(latestSamples.pulse, phase, sensingStarted, now)
        ? latestSamples.pulse
        : undefined,
      breathing: sampleIsCurrent(
        latestSamples.breathing,
        phase,
        sensingStarted,
        now,
      )
        ? latestSamples.breathing
        : undefined,
      hrv: sampleIsCurrent(latestSamples.hrv, phase, sensingStarted, now)
        ? latestSamples.hrv
        : undefined,
    } satisfies SamplesByMetric;
  }, [latestSamples, now, phase, phaseStartedAt]);

  const elapsedSincePhaseStart =
    phaseStartedAt > 0 ? Math.max(0, now - phaseStartedAt) : 0;
  const elapsedSinceWarmupStart =
    warmupStartedAt > 0 ? Math.max(0, now - warmupStartedAt) : 0;
  const checkInReady = elapsedSincePhaseStart >= 60_000;
  const recoveryReady = elapsedSincePhaseStart >= 60_000;

  useEffect(() => {
    setWarmupElapsedMs(elapsedSinceWarmupStart);
  }, [elapsedSinceWarmupStart]);

  const navigate = useCallback(
    async (destination: Screen) => {
      if (isSensing) {
        const confirmed = window.confirm(
          "Stop camera sensing and leave this session?",
        );
        if (!confirmed) return;
        const stopped = await stopSensing(false);
        if (!stopped) return;
      }
      setScreen(destination);
    },
    [isSensing, stopSensing],
  );

  const chartData = useMemo(
    () =>
      [...history]
        .reverse()
        .map((item) => ({
          date: new Date(item.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          pulse: item.baselinePulse ?? null,
          breathing: item.baselineBreathing ?? null,
        })),
    [history],
  );

  const renderWelcome = () => (
    <div className="page-content">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">A little more prepared. A little more yourself.</div>
          <h1>
            Big moments deserve
            <br />
            <span>thoughtful preparation.</span>
          </h1>
          <p className="lead">
            Practise what you want to say, notice your own patterns, and find a
            rhythm that feels like yours.
          </p>
          <div className="button-row">
            <button className="button-primary" onClick={beginNewSession}>
              <Icon name="play" />
              Prepare for a moment
              <Icon name="arrow" />
            </button>
            {history.length > 0 && (
              <button
                className="button-secondary"
                onClick={() => setScreen("history")}
              >
                View my sessions
              </button>
            )}
          </div>
        </div>
        <div aria-hidden="true" className="hero-orbit">
          <div className="orbit-ring" />
          <div className="orbit-ring" />
          <div className="orbit-ring" />
          <div className="orbit-core" />
        </div>
      </section>

      <div className="section-heading">
        <div>
          <div className="eyebrow">The Poise practice</div>
          <h2>Prepare with intention.</h2>
        </div>
        <p>Self-awareness, made actionable.</p>
      </div>
      <div className="feature-grid">
        {[
          ["01", "Check in", "A quiet moment to settle in and understand what is measurable today."],
          ["02", "Warm up", "A responsive breathing experience that follows your measured rhythm."],
          ["03", "Reflect", "A thoughtful review grounded in your practice—not assumptions about you."],
        ].map(([number, title, description]) => (
          <article className="glass-card feature-card" key={number}>
            <div className="feature-number">{number}</div>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
      <p className="footer-note">
        Poise offers informational rehearsal feedback, not medical assessment or
        diagnosis. Measurements can be unavailable or unreliable; the app will
        explain when it cannot show a valid result.
      </p>
    </div>
  );

  const renderSetup = () => (
    <div className="page-content">
      <div className="eyebrow">A practice, shaped around you</div>
      <h1 className="screen-title">What are you preparing for?</h1>
      <p className="screen-intro">
        Choose a starting point. You can practise at your own pace and stop
        sensing whenever you like.
      </p>
      <div className="scenario-grid">
        {(Object.keys(scenarioInfo) as SessionKind[]).map((scenario) => (
          <button
            aria-pressed={kind === scenario}
            className={`scenario-card ${kind === scenario ? "selected" : ""}`}
            key={scenario}
            onClick={() => setKind(scenario)}
          >
            <span className="scenario-mark">{scenarioInfo[scenario].mark}</span>
            <span>
              <strong>{scenarioInfo[scenario].label}</strong>
              <small>{scenarioInfo[scenario].description}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="form-grid">
        <label className="field-label">
          Your personal objective
          <input
            className="field-input"
            maxLength={240}
            onChange={(event) => setObjective(event.target.value)}
            placeholder="For example, find a clear opening"
            value={objective}
          />
        </label>
        <label className="field-label">
          Practice duration
          <select
            className="field-select"
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            value={durationMinutes}
          >
            {[2, 3, 4, 5, 7, 10, 15].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </label>
        {(kind === "presentation" || kind === "pitch" || kind === "camera") && (
          <label className="field-label" style={{ gridColumn: "1 / -1" }}>
            {kind === "presentation" ? "Topic or short outline" : "What would you like to say?"}
            <textarea
              className="field-textarea"
              maxLength={2_000}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Add a few notes if they would help you practise."
              value={topic}
            />
          </label>
        )}
      </div>
      <div className="button-row">
        <button className="button-secondary" onClick={() => setScreen("home")}>
          Back
        </button>
        <button className="button-primary" onClick={continueToConsent}>
          Continue to camera consent <Icon name="arrow" />
        </button>
      </div>
    </div>
  );

  const renderMetric = (
    label: string,
    sample: SignalSample | undefined,
    unit: string,
    note: string,
  ) => {
    const formatted = displayMetric(sample, unit);
    return (
      <article className="glass-card metric-card" key={label}>
        <div className="metric-label">
          <span className={`quality-dot ${sample ? "live" : ""}`} />
          {label}
        </div>
        <div className="metric-value">{formatted.value}</div>
        <div className="metric-unit">{sample ? formatted.unit : note}</div>
        <div className="quality-text">
          {sample
              ? `Stable reading${sample.confidence === undefined ? "" : ` · ${sample.confidence.toFixed(0)}% confidence`} · ${new Date(sample.timestampUs / 1_000).toLocaleTimeString()}`
            : "Waiting for a valid measurement"}
        </div>
      </article>
    );
  };

  const renderConsent = () => (
    <>
      <div className="eyebrow">Before we begin</div>
      <h1 className="screen-title">You’re in control.</h1>
      <p className="screen-intro">
        Choose camera sensing with SmartSpectra, or continue with a camera-free
        practice. Camera use begins only after explicit consent.
      </p>
      <div className="glass-card">
        <div className="consent-list">
          <div className="consent-line">
            <Icon name="shield" />
            <span>
              Your camera processes supported signals including pulse,
              breathing, and observable facial activity. Camera frames are not
              recorded or uploaded by Poise.
            </span>
          </div>
          <div className="consent-line">
            <Icon name="shield" />
            <span>
              Measurements are processed live. Session summaries are saved on
              this device only if you opt in; you can delete them later.
            </span>
          </div>
          <div className="consent-line">
            <Icon name="shield" />
            <span>
              Camera sensing requires SmartSpectra to authenticate your API
              key. Poise disables optional SDK telemetry, but this does not
              disable authentication or other required Presage service
              communication.
            </span>
          </div>
          <div className="notice">
            Poise provides informational rehearsal feedback, not medical
            assessment or diagnosis. Pulse, breathing, blinking, and facial
            observations do not reveal confidence, anxiety, honesty, or
            emotional state.
          </div>
          <label className="consent-line">
            <input
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              type="checkbox"
            />
            <span>
              I understand how camera sensing and session information are used,
              and I choose to start camera sensing for this practice.
            </span>
          </label>
          <label className="consent-line">
            <input
              checked={saveLocally}
              onChange={(event) => setSaveLocally(event.target.checked)}
              type="checkbox"
            />
            <span>
              Save this session summary locally so I can review it later
              (optional; off by default).
            </span>
          </label>
          <label className="field-label">
            SmartSpectra API key
            <input
              autoComplete="off"
              className="field-input"
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Enter your key from the Presage developer portal"
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            <span className="muted">
              Required only if you choose camera sensing. Kept in memory for
              the sensing session; never committed or stored by Poise.
            </span>
          </label>
          {sdkError && <div className="notice error">{sdkError}</div>}
          <div className="button-row">
            <button
              className="button-secondary"
              onClick={() => {
                setSessionPhase("IDLE");
                setScreen("setup");
              }}
            >
              Back
            </button>
            <button
              className="button-secondary"
              onClick={continueWithoutCamera}
            >
              Continue without camera
            </button>
            <button
              className="button-primary"
              disabled={!consentAccepted || !apiKey.trim() || isBusy}
              onClick={() => void startSensing()}
            >
              {isBusy ? "Starting camera…" : "Enable camera and check in"}
              <Icon name="arrow" />
            </button>
          </div>
          <p className="footer-note">
            No account, cloud sync, or third-party AI is used in this MVP. Learn
            more in Settings → Privacy.
          </p>
        </div>
      </div>
    </>
  );

  const renderCameraSetup = () => (
    <>
      <div className="eyebrow">Camera setup</div>
      <h1 className="screen-title">Let’s find a comfortable frame.</h1>
      <p className="screen-intro">
        Keep your face in view, find even light, and sit comfortably. For the
        check-in, try to remain still while the SDK checks measurement quality.
      </p>
      <div className="camera-layout">
        <div className="camera-frame">
          <video autoPlay muted playsInline ref={attachVideo} />
          {!stream && (
            <div className="camera-placeholder">
              Waiting for the camera stream from SmartSpectra. If permission is
              denied or the camera is busy, stop and try again.
            </div>
          )}
          <div className="camera-status">
            <span className={`status-dot ${stream ? "live" : ""}`} />
            {stream ? "Camera active" : "Starting camera"}
          </div>
        </div>
        <div className="glass-card">
          <h3>Measurement guidance</h3>
          <p className="muted">{validation}</p>
          <p className="muted">
            Face framing: {faceVisible === true
              ? "Face landmarks detected"
              : faceVisible === false
                ? "No face landmarks detected yet"
                : "Waiting for face observations"}
          </p>
          <p className="muted">
            Minimum analysis windows are 12 seconds for pulse, 30 seconds for
            breathing, and 60 seconds for HRV. A valid result may take longer
            or may not be available.
          </p>
          <div className="notice info">
            SDK status: {processingStatus}
          </div>
          {sdkError && <div className="notice error" style={{ marginTop: 12 }}>{sdkError}</div>}
          <div className="button-row">
            <button
              className="button-secondary"
              disabled={isStopping}
              onClick={() => void stopSensing()}
            >
              Stop sensing
            </button>
            {phase === "ERROR" && (
              <button
                className="button-primary"
                onClick={() => {
                  setSessionPhase("CONSENT");
                  setSdkError("");
                }}
              >
                Review and retry
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderCheckIn = () => (
    <>
      <div className="eyebrow">The check-in · {formatDuration(elapsedSincePhaseStart)}</div>
      <h1 className="screen-title">Notice your starting point.</h1>
      <p className="screen-intro">
        Stay comfortable and still while SmartSpectra checks for valid
        measurements. This is a personal session reference, not a medical
        normal range.
      </p>
      <div className="camera-layout">
        <div className="camera-frame">
          <video autoPlay muted playsInline ref={attachVideo} />
          <div className="camera-status">
            <span className={`status-dot ${stream ? "live" : ""}`} />
            {stream ? "Camera active" : "Camera starting"} · {processingStatus}
          </div>
        </div>
        <div className="glass-card">
          <h3>Signal quality</h3>
          <p className="muted">{validation}</p>
          <p className="muted">
            Face framing: {faceVisible === true
              ? "Face landmarks detected"
              : faceVisible === false
                ? "No face landmarks detected yet"
                : "Waiting for face observations"}
          </p>
          <div className="notice info">
            Keep your face visible, avoid strong backlighting, and hold your
            device steady. Missing measurements remain unavailable—not zero.
          </div>
          <div className="button-row">
            <button
              className="button-secondary"
              disabled={isStopping}
              onClick={() => void stopSensing()}
            >
              Stop sensing
            </button>
          </div>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <div className="eyebrow">Your session baseline</div>
          <h2>Only valid readings appear.</h2>
        </div>
      </div>
      <div className="metric-grid">
        {renderMetric("Pulse", activeSamples.pulse, "bpm", "Not available")}
        {renderMetric("Breathing", activeSamples.breathing, "breaths/min", "Waiting for a stable not-talking observation")}
        {renderMetric("HRV · RMSSD", activeSamples.hrv, "ms", "Not available")}
      </div>
      {sdkError && <div className="notice error" style={{ marginTop: 16 }}>{sdkError}</div>}
      <div className="button-row">
        <button
          className="button-primary"
          disabled={!checkInReady || isBusy}
          onClick={enterWarmup}
        >
          {checkInReady ? "Continue to warm-up" : "Checking measurements…"}
          <Icon name="arrow" />
        </button>
      </div>
    </>
  );

  const renderWarmup = () => {
    const measuredBreathing = activeSamples.breathing;
    const target = warmupMode === "observe"
      ? measuredBreathing?.value
      : guidedRate;
    const breathingPeriodMs = target ? 60_000 / target : 6_000;
    const progress = (now % breathingPeriodMs) / breathingPeriodMs;
    const hasBreathingPace = warmupMode === "guided" || measuredBreathing !== undefined;
    const scale = !prefersReducedMotion && hasBreathingPace
      ? 0.88 + (Math.sin(progress * Math.PI * 2) + 1) * 0.075
      : 1;
    const waveformRange = waveform.length > 1
      ? Math.max(0.001, Math.max(...waveform) - Math.min(...waveform))
      : 1;
    const points = waveform.map((value, index) => {
      const x = (index / Math.max(1, waveform.length - 1)) * 100;
      const y = 50 - ((value - (Math.min(...waveform) + Math.max(...waveform)) / 2) / waveformRange) * 38;
      return `${x},${y}`;
    }).join(" ");

    return (
      <>
        <div className="eyebrow">The warm-up · {formatDuration(warmupElapsedMs)}</div>
        <h1 className="screen-title">Find your own rhythm.</h1>
        <p className="screen-intro">
          Take a comfortable moment. There is no perfect pace to reach; stop or
          change modes whenever you like.
        </p>
        {!sessionUsesCamera && (
          <div className="notice info">
            Camera sensing is off. No live measurements will be collected or
            used in this practice.
          </div>
        )}
        <div className="glass-card warmup">
          <div className="breath-stage">
            <div
              aria-label={
                warmupMode === "observe" && measuredBreathing
                  ? `Visualization following measured breathing at ${measuredBreathing.value.toFixed(0)} breaths per minute`
                  : warmupMode === "guided"
                    ? `Guided target of ${guidedRate} breaths per minute; measured response shown separately`
                    : "Waiting for a valid breathing measurement"
              }
              className={`breath-orb ${warmupMode === "observe" && !measuredBreathing ? "waiting" : ""}`}
              role="img"
              style={{
                transform: `scale(${scale})`,
                transitionDuration: prefersReducedMotion
                  ? "0s"
                  : `${Math.min(1.2, breathingPeriodMs / 20_000)}s`,
              }}
            />
            <div className="breath-center-label">
              {warmupMode === "observe"
                ? measuredBreathing
                  ? "Following your rhythm"
                  : "Waiting for a valid reading"
                : "A pace you selected"}
            </div>
            {warmupMode === "observe" && measuredBreathing && points && (
              <svg
                aria-label="Recent measured breathing waveform"
                className="waveform-svg"
                role="img"
                viewBox="0 0 100 100"
              >
                <polyline
                  fill="none"
                  points={points}
                  stroke="rgba(220, 207, 255, 0.62)"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
          </div>
          <div className="warmup-control">
            <div className="eyebrow">Warm-up mode</div>
            <div aria-label="Warm-up mode" className="segmented" role="group">
              <button
                aria-pressed={warmupMode === "observe"}
                className={`segment-button ${warmupMode === "observe" ? "active" : ""}`}
                onClick={() => setWarmupMode("observe")}
              >
                Observe
              </button>
              <button
                aria-pressed={warmupMode === "guided"}
                className={`segment-button ${warmupMode === "guided" ? "active" : ""}`}
                onClick={() => setWarmupMode("guided")}
              >
                Guided
              </button>
            </div>
            {warmupMode === "guided" && (
              <label className="field-label">
                Your comfortable target · {guidedRate} breaths/min
                <div className="range-row">
                  <span>4</span>
                  <input
                    max={16}
                    min={4}
                    onChange={(event) => setGuidedRate(Number(event.target.value))}
                    step={1}
                    type="range"
                    value={guidedRate}
                  />
                  <span>16</span>
                </div>
                <span className="muted">
                  This is the pace you selected, not a measured value.
                </span>
              </label>
            )}
            <div className="glass-card">
              <div className="metric-label">Measured breathing</div>
              <div className="metric-value">
                {measuredBreathing ? measuredBreathing.value.toFixed(0) : "—"}
              </div>
              <div className="metric-unit">
                {measuredBreathing ? "breaths/min · stable SDK sample" : "No valid reading yet"}
              </div>
            </div>
            <p className="muted">
              Observe follows measured breathing. Guided uses your chosen target
              and keeps the measured response separate.
            </p>
            {sdkError && <div className="notice error">{sdkError}</div>}
            <div className="button-row">
              {sessionUsesCamera && (
                <button
                  className="button-secondary"
                  disabled={isStopping}
                  onClick={() => void stopSensing()}
                >
                  Stop sensing
                </button>
              )}
              <button className="button-primary" onClick={enterRehearsal}>
                Enter the Stage <Icon name="arrow" />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderRehearsal = () => {
    const elapsed = Math.max(0, now - rehearsalStartedAtRef.current);
    const timeLeft = Math.max(0, durationMinutes * 60_000 - elapsed);
    const displayQuestion =
      kind === "interview"
        ? interviewQuestions[questionIndex]
        : kind === "presentation"
          ? topic.trim() || "Choose one idea you would like your audience to remember."
          : kind === "pitch"
            ? topic.trim() || "What problem are you solving, and why does it matter?"
            : topic.trim() || "What would you like to share with the camera?";

    return (
      <>
        <div className="eyebrow">The Stage · {scenarioInfo[kind].label}</div>
        <h1 className="screen-title">Take your time.</h1>
        <p className="screen-intro">
          Talking detection marks observable activity only. Poise does not
          transcribe or evaluate what you say.
        </p>
        <div className="question-block">
          <div className="eyebrow">
            {kind === "interview" ? "Practice question" : "Your practice prompt"}
          </div>
          <p>{displayQuestion}</p>
          {kind === "interview" && (
            <button
              className="button-quiet"
              onClick={() =>
                setQuestionIndex((questionIndex + 1) % interviewQuestions.length)
              }
            >
              Choose another question
            </button>
          )}
        </div>
        <div className="stage-layout">
          {sessionUsesCamera ? (
            <div className="camera-frame">
              <video autoPlay muted playsInline ref={attachVideo} />
              <div className="camera-status">
                <span className={`status-dot ${stream ? "live" : ""}`} />
                {stream ? "Camera active" : "Camera unavailable"} · {faceVisible === true ? "face visible" : "face status unavailable"} · talking {isTalking ? "detected" : "not detected"}
              </div>
            </div>
          ) : (
            <div className="glass-card">
              <h3>Camera off</h3>
              <p className="muted">
                This rehearsal uses no camera, live measurements, or SmartSpectra
                sensing. Your practice activity stays on this screen.
              </p>
            </div>
          )}
          <div className="glass-card">
            <div className="metric-label">Time remaining</div>
            <div className="big-timer">{formatDuration(timeLeft)}</div>
            <p className="muted">
              Practice target · {durationMinutes} minutes
              <br />
              Activity detection is not a transcript.
            </p>
            <div className="metric-label">Speaking intervals</div>
            <div className="metric-value">{talkingIntervals.length + (isTalking ? 1 : 0)}</div>
            <div className="metric-unit">observable talking activity</div>
            <div className="metric-label" style={{ marginTop: 16 }}>Candidate pauses</div>
            <div className="metric-value">{pauseCount}</div>
            <div className="metric-label" style={{ marginTop: 16 }}>Blink observations</div>
            <div className="metric-value">{blinkCount}</div>
            <p className="muted">
              These are observations only—not measures of confidence, emotion,
              or performance quality.
            </p>
          </div>
        </div>
        <div className="glass-card" style={{ marginTop: 16 }}>
          <div className="metric-label">Speaking activity timeline</div>
          <div aria-label="Speaking activity timeline" className="timeline">
            {Array.from({ length: 48 }, (_, index) => {
              const time = (index / 48) * Math.max(elapsed, 1);
              const speaking = talkingIntervals.some(
                (interval) => time >= interval.startedAt && time <= interval.endedAt,
              ) || (isTalking && time >= (openIntervalStartedAtRef.current ?? elapsed));
              return (
                <span
                  className={`timeline-mark ${speaking ? "speaking" : ""}`}
                  key={index}
                />
              );
            })}
          </div>
          <div className="button-row">
            {sessionUsesCamera && (
              <button
                className="button-secondary"
                disabled={isStopping}
                onClick={() => void stopSensing()}
              >
                Stop sensing
              </button>
            )}
            <button className="button-primary" onClick={enterRecovery}>
              Finish rehearsal <Icon name="arrow" />
            </button>
          </div>
        </div>
      </>
    );
  };

  const renderRecovery = () => !sessionUsesCamera ? (
    <>
      <div className="eyebrow">Recovery · {formatDuration(elapsedSincePhaseStart)}</div>
      <h1 className="screen-title">Take a moment to reflect.</h1>
      <p className="screen-intro">
        Camera sensing was off, so there are no post-practice measurements to
        compare. You can still review the time you practised and your observable
        speaking activity.
      </p>
      <div className="notice info">
        No camera data or SmartSpectra measurements were collected for this
        session.
      </div>
      <div className="button-row">
        <button className="button-primary" onClick={() => void finishRecovery()}>
          Continue to reflection <Icon name="arrow" />
        </button>
      </div>
    </>
  ) : (
    <>
      <div className="eyebrow">Recovery · {formatDuration(elapsedSincePhaseStart)}</div>
      <h1 className="screen-title">Take a quiet moment.</h1>
      <p className="screen-intro">
        If comfortable, sit still while Poise checks for post-practice readings.
        Comparisons appear only when both values are valid and collected under
        compatible conditions.
      </p>
      <div className="camera-layout">
        <div className="camera-frame">
          <video autoPlay muted playsInline ref={attachVideo} />
          <div className="camera-status">
            <span className={`status-dot ${stream ? "live" : ""}`} />
            Recovery sensing · {stream ? "camera active" : "camera unavailable"}
          </div>
        </div>
        <div className="glass-card">
          <h3>Measurement guidance</h3>
          <p className="muted">{validation}</p>
          <p className="muted">
            Pulse, breathing, and HRV each have different minimum windows.
            Missing readings will be left out of your reflection.
          </p>
          <button
            className="button-secondary"
            disabled={isBusy}
            onClick={() => void stopSensing()}
          >
            Stop sensing
          </button>
        </div>
      </div>
      <div className="metric-grid" style={{ marginTop: 17 }}>
        {renderMetric("Pulse", activeSamples.pulse, "bpm", "Not available")}
        {renderMetric("Breathing", activeSamples.breathing, "breaths/min", "Waiting for a stable not-talking observation")}
        {renderMetric("HRV · RMSSD", activeSamples.hrv, "ms", "Not available")}
      </div>
      {sdkError && <div className="notice error" style={{ marginTop: 16 }}>{sdkError}</div>}
      <div className="button-row">
        <button
          className="button-primary"
          disabled={isBusy}
          onClick={() => void finishRecovery()}
        >
          {recoveryReady ? "Review this session" : "Checking for valid readings…"}
          <Icon name="arrow" />
        </button>
      </div>
    </>
  );

  const renderReflection = () => {
    const pulseComparison = compareMeasurements(baseline.pulse, recovery.pulse);
    const breathingComparison = compareMeasurements(
      baseline.breathing,
      recovery.breathing,
    );
    const hrvComparison = compareMeasurements(baseline.hrv, recovery.hrv);
    const intervalCount =
      talkingIntervals.length + (talkingStateRef.current ? 1 : 0);
    const suggestion = session
      ? nextPracticeSuggestion(talkingIntervals, session.objective)
      : "Try another rehearsal when you are ready.";

    return (
      <>
        <div className="eyebrow">The reflection</div>
        <h1 className="screen-title">Your practice, thoughtfully reviewed.</h1>
        <p className="screen-intro">
          Observations are descriptive, not diagnostic. Missing or incompatible
          measurements are omitted rather than estimated.
        </p>
        <div className="summary-grid">
          <article className="glass-card">
            <h3>Practice preferences</h3>
            <p className="muted">
              Your selected practice type, duration, and guided breathing target
              are saved locally on this device. They do not include your API key
              or camera consent.
            </p>
          </article>
          <article className="glass-card">
            <div className="metric-label">Practice completed</div>
            <div className="metric-value">{formatDuration(practiceDurationMs)}</div>
            <div className="metric-unit">
              {session ? scenarioInfo[session.kind].label : "Rehearsal"}
            </div>
          </article>
          <article className="glass-card">
            <div className="metric-label">Observable speaking intervals</div>
            <div className="metric-value">{intervalCount}</div>
            <div className="metric-unit">
              {pauseCount} candidate pauses · {blinkCount} blink observations
            </div>
          </article>
          <article className="glass-card">
            <div className="metric-label">Pulse · baseline → recovery</div>
            <div className="metric-value">
              {pulseComparison
                ? `${pulseComparison.baseline.toFixed(0)} → ${pulseComparison.recovery.toFixed(0)}`
                : "Not available"}
            </div>
            <div className="metric-unit">
              {pulseComparison ? `bpm · ${confidenceNote(baseline.pulse, recovery.pulse)}` : confidenceNote(baseline.pulse, recovery.pulse)}
            </div>
          </article>
          <article className="glass-card">
            <div className="metric-label">Breathing · baseline → recovery</div>
            <div className="metric-value">
              {breathingComparison
                ? `${breathingComparison.baseline.toFixed(0)} → ${breathingComparison.recovery.toFixed(0)}`
                : "Not available"}
            </div>
            <div className="metric-unit">
              {breathingComparison ? `breaths/min · ${confidenceNote(baseline.breathing, recovery.breathing)}` : confidenceNote(baseline.breathing, recovery.breathing)}
            </div>
          </article>
          <article className="glass-card">
            <div className="metric-label">HRV · RMSSD · baseline → recovery</div>
            <div className="metric-value">
              {hrvComparison
                ? `${hrvComparison.baseline.toFixed(1)} → ${hrvComparison.recovery.toFixed(1)}`
                : "Not available"}
            </div>
            <div className="metric-unit">
              {hrvComparison ? `ms · ${confidenceNote(baseline.hrv, recovery.hrv)}` : confidenceNote(baseline.hrv, recovery.hrv)}
            </div>
          </article>
          <article className="glass-card">
            <div className="eyebrow">A next practice idea</div>
            <p style={{ marginTop: 14, lineHeight: 1.7 }}>{suggestion}</p>
            <p className="muted">Based on observable practice activity or your selected goal.</p>
          </article>
        </div>
        <div className="glass-card" style={{ marginTop: 16 }}>
          <div className="metric-label">Speaking activity timeline</div>
          <div className="timeline">
            {talkingIntervals.length === 0 ? (
              <span className="muted">No stable talking activity was available to show.</span>
            ) : (
              talkingIntervals.map((interval, index) => (
                <span
                  className="timeline-mark speaking"
                  key={`${interval.startedAt}-${index}`}
                  style={{
                    flex: Math.max(1, interval.endedAt - interval.startedAt),
                  }}
                />
              ))
            )}
          </div>
        </div>
        {sdkError && <div className="notice error" style={{ marginTop: 16 }}>{sdkError}</div>}
        <div className="button-row">
          <button
            className="button-primary"
            disabled={isBusy}
            onClick={() => void completeSession()}
          >
            {isBusy ? "Finishing…" : saveLocally ? "Save locally and finish" : "Finish without saving"}
            <Icon name="arrow" />
          </button>
        </div>
      </>
    );
  };

  const renderCompleted = () => (
    <>
      <div className="eyebrow">Practice complete</div>
      <h1 className="screen-title">You showed up for yourself.</h1>
      <p className="screen-intro">
        {completedSummary?.practiceCompleted
          ? `You completed ${formatDuration(completedSummary.durationMs)} of rehearsal practice.`
          : "Your session is complete. You can start another practice whenever you’re ready."}
      </p>
      {saveLocally && (
        <div className={`notice ${saveError ? "error" : "info"}`}>
          {saveError || "Your selected session summary is saved locally on this device."}
        </div>
      )}
      {!saveLocally && (
        <div className="notice info">
          This session was not saved. You can choose local saving the next time you practise.
        </div>
      )}
      <div className="button-row">
        <button className="button-primary" onClick={beginNewSession}>
          Prepare for another moment <Icon name="arrow" />
        </button>
        <button className="button-secondary" onClick={() => setScreen("home")}>
          Return home
        </button>
      </div>
    </>
  );

  const renderSession = () => (
    <div className="page-content">
      <div className="topbar-right" style={{ justifyContent: "flex-end", marginBottom: 24 }}>
        {isSensing && (
          <>
            <span className={`status-dot ${stream ? "live" : ""}`} />
            {stream ? "Camera active" : "Camera starting"}
            <button
              className="button-quiet"
              disabled={isStopping}
              onClick={() => void stopSensing()}
            >
              Stop sensing
            </button>
          </>
        )}
      </div>
      {sessionUsesCamera && phase !== "CONSENT" && (
        <details className="diagnostic-panel">
          <summary>SmartSpectra diagnostics · temporary, in memory only</summary>
          <p className="muted">
            Recent SDK lifecycle and decoded metric events. API keys and raw camera frames
            are never included or saved here.
          </p>
          <ol aria-label="Recent SmartSpectra events" className="diagnostic-list">
            {diagnostics.length === 0 ? (
              <li>No SDK events recorded for this session yet.</li>
            ) : (
              diagnostics.map((entry, index) => (
                <li key={`${entry.occurredAt}-${index}`}>
                  <time dateTime={new Date(entry.occurredAt).toISOString()}>
                    {new Date(entry.occurredAt).toLocaleTimeString()}
                  </time>
                  <strong>{entry.event}</strong>
                  <span>{entry.detail}</span>
                </li>
              ))
            )}
          </ol>
        </details>
      )}
      <AnimatePresence mode="wait">
        <motion.section
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          key={phase}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
        >
          {phase === "CONSENT" && renderConsent()}
          {phase === "CAMERA_SETUP" && renderCameraSetup()}
          {phase === "CHECK_IN" && renderCheckIn()}
          {phase === "WARMUP" && renderWarmup()}
          {phase === "REHEARSAL" && renderRehearsal()}
          {phase === "RECOVERY" && renderRecovery()}
          {phase === "REFLECTION" && renderReflection()}
          {phase === "COMPLETED" && renderCompleted()}
          {phase === "ERROR" && (
            <>
              <div className="eyebrow">Sensing paused</div>
              <h1 className="screen-title">Let’s take another look.</h1>
              <div className="notice error">{sdkError || "The sensing session could not start."}</div>
              <div className="button-row">
                <button
                  className="button-secondary"
                  onClick={() => void stopSensing()}
                >
                  Stop and return home
                </button>
                <button
                  className="button-primary"
                  onClick={() => {
                    setSessionPhase("CONSENT");
                    setSdkError("");
                  }}
                >
                  Review consent and retry
                </button>
              </div>
            </>
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );

  const renderHistory = () => {
    const selectedSession = history.find((item) => item.id === selectedHistoryId);
    if (selectedSession) {
      const renderSavedMetric = (
        label: string,
        metric: MetricName,
        unit: string,
      ) => {
        const baselineSample = selectedSession.details.baseline[metric];
        const recoverySample = selectedSession.details.recovery[metric];
        const comparison = compareMeasurements(baselineSample, recoverySample);
        const renderSavedReading = (
          caption: string,
          sample: SignalSample | undefined,
        ) => (
          <div className="saved-reading">
            <strong>{caption}</strong>
            <span>
              {sample
                ? `${sample.value.toFixed(metric === "hrv" ? 1 : 0)} ${unit}`
                : "Not available"}
            </span>
            {sample && (
              <small>
                {sample.stable === true ? "Stable" : "Stability unavailable"} · {sample.confidence === undefined
                  ? "confidence unavailable"
                  : `${sample.confidence.toFixed(0)}% confidence`}
              </small>
            )}
            {sample && (
              <small>
                Sampled {new Date(sample.timestampUs / 1_000).toLocaleString()}
              </small>
            )}
          </div>
        );
        return (
          <article className="glass-card" key={metric}>
            <h3>{label}</h3>
            {renderSavedReading("Baseline", baselineSample)}
            {renderSavedReading("Recovery", recoverySample)}
            <p className="muted">
              {comparison
                ? `Valid matching comparison: ${comparison.baseline.toFixed(metric === "hrv" ? 1 : 0)} → ${comparison.recovery.toFixed(metric === "hrv" ? 1 : 0)} ${unit}`
                : "No valid compatible baseline and recovery pair was saved."}
            </p>
          </article>
        );
      };

      return (
        <div className="page-content">
          <div className="eyebrow">Saved practice · {scenarioInfo[selectedSession.kind].label}</div>
          <h1 className="screen-title">A closer look at your session.</h1>
          <p className="screen-intro">
            {new Date(selectedSession.createdAt).toLocaleString()} ·{" "}
            {formatDuration(selectedSession.durationMs)} ·{" "}
            {selectedSession.practiceCompleted ? "Practice completed" : "Practice not completed"}
          </p>
          {selectedSession.objective && (
            <div className="glass-card">
              <div className="metric-label">Your objective</div>
              <p>{selectedSession.objective}</p>
            </div>
          )}
          {selectedSession.details.cameraSensingUsed === false && (
            <div className="notice info">
              Camera sensing was off; this session has no live measurements.
            </div>
          )}
          {selectedSession.details.cameraSensingUsed === true && (
            <div className="notice info">
              Camera sensing was enabled. Only valid measurements received
              during this session are shown below.
            </div>
          )}
          <div className="summary-grid">
            {renderSavedMetric("Pulse", "pulse", "bpm")}
            {renderSavedMetric("Breathing", "breathing", "breaths/min")}
            {renderSavedMetric("HRV · RMSSD", "hrv", "ms")}
            <article className="glass-card">
              <h3>Practice observations</h3>
              <p>{selectedSession.speakingIntervals} speaking intervals</p>
              <p>{selectedSession.pauses} candidate pauses</p>
              <p>{selectedSession.details.blinkCount} blink observations</p>
            </article>
            <article className="glass-card">
              <div className="eyebrow">A next practice idea</div>
              <p>{selectedSession.suggestion}</p>
              <p className="muted">
                Based on observable practice activity or your selected goal.
              </p>
            </article>
          </div>
          <div className="glass-card" style={{ marginTop: 16 }}>
            <div className="metric-label">Speaking activity timeline</div>
            <div aria-label="Saved speaking activity timeline" className="timeline">
              {selectedSession.details.talkingIntervals.length === 0
                ? <span className="muted">No stable talking activity was saved.</span>
                : selectedSession.details.talkingIntervals.map((interval, index) => (
                  <span
                    className="timeline-mark speaking"
                    key={`${interval.startedAt}-${index}`}
                    style={{
                      flex: Math.max(1, interval.endedAt - interval.startedAt),
                    }}
                  />
                ))}
            </div>
          </div>
          <div className="button-row">
            <button
              className="button-secondary"
              onClick={() => setSelectedHistoryId(null)}
            >
              Back to sessions
            </button>
            <button
              className="button-secondary"
              onClick={() => void deleteSession(selectedSession.id)}
            >
              Delete this session
            </button>
          </div>
        </div>
      );
    }

    return (
    <div className="page-content">
      <div className="eyebrow">My journey</div>
      <h1 className="screen-title">Your practice history.</h1>
      <p className="screen-intro">
        Session summaries are stored locally only when you choose to save them.
        You can remove individual sessions at any time.
      </p>
      {storageError && <div className="notice error">{storageError}</div>}
      <div className="glass-card">
        {history.length === 0 ? (
          <div className="empty-state">
            <div>
              <p>No saved sessions yet.</p>
              <button className="button-primary" onClick={beginNewSession}>
                Start your first practice
              </button>
            </div>
          </div>
        ) : (
          history.map((item) => (
            <div className="history-row" key={item.id}>
              <div>
                <div className="history-kind">{scenarioInfo[item.kind].label}</div>
                <div className="history-meta">
                  {new Date(item.createdAt).toLocaleString()} ·{" "}
                  {formatDuration(item.durationMs)} · {item.speakingIntervals} speaking intervals
                </div>
              </div>
              <button
                className="button-quiet"
                onClick={() => setSelectedHistoryId(item.id)}
              >
                Review
              </button>
              <button
                aria-label={`Delete ${scenarioInfo[item.kind].label} session from ${new Date(item.createdAt).toLocaleDateString()}`}
                className="button-quiet"
                onClick={() => void deleteSession(item.id)}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
      <div className="button-row">
        <button className="button-primary" onClick={beginNewSession}>
          New session
        </button>
      </div>
    </div>
    );
  };

  const renderProgress = () => (
    <div className="page-content">
      <div className="eyebrow">My journey</div>
      <h1 className="screen-title">Progress, at your own pace.</h1>
      <p className="screen-intro">
        These charts show valid saved session baselines only. They are personal
        observations—not medical or population comparisons.
      </p>
      {history.length < 2 ? (
        <div className="glass-card empty-state">
          <div>
            <p>Save at least two sessions to see how your practice patterns change.</p>
            <button className="button-primary" onClick={beginNewSession}>
              Start a practice
            </button>
          </div>
        </div>
      ) : (
        <div className="summary-grid">
          <article className="glass-card">
            <h3>Pulse · session baseline</h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,.07)" />
                  <XAxis dataKey="date" stroke="#938d9b" />
                  <YAxis stroke="#938d9b" />
                  <Tooltip />
                  <Line connectNulls={false} dataKey="pulse" dot stroke="#a78bfa" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
          <article className="glass-card">
            <h3>Breathing · session baseline</h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,.07)" />
                  <XAxis dataKey="date" stroke="#938d9b" />
                  <YAxis stroke="#938d9b" />
                  <Tooltip />
                  <Line connectNulls={false} dataKey="breathing" dot stroke="#82aaff" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="page-content">
      <div className="eyebrow">Settings</div>
      <h1 className="screen-title">Privacy, clearly.</h1>
      <p className="screen-intro">
        Your camera and physiological information deserve careful handling.
      </p>
      <div className="summary-grid">
        <article className="glass-card">
          <h3>Camera settings</h3>
          <p className="muted">
            Sensing starts only after you consent. The camera-active state stays
            visible during a session, and Stop sensing releases the camera.
            Poise does not record or upload camera video.
          </p>
          <p className="muted">
            Poise uses SmartSpectra’s default camera device. To change the
            selected device, change your operating system’s default camera
            before starting a session.
          </p>
        </article>
        <article className="glass-card">
          <h3>SmartSpectra telemetry</h3>
          <p className="muted">
            Poise configures SmartSpectra with <code>enableTelemetry: false</code>.
            Authentication and required SDK service communication still occur;
            disabling optional telemetry does not mean the SDK is fully offline.
          </p>
        </article>
        <article className="glass-card">
          <h3>Local data</h3>
          <p className="muted">
            Opted-in session summaries stay on this device.
            Poise has no account, cloud database, automatic upload, or third-party
            AI processing in this MVP.
          </p>
        </article>
        <article className="glass-card">
          <h3>Human-signal limitations</h3>
          <p className="muted">
            Measurements may be unavailable or invalid. A personal baseline is
            not a medical normal range. Face and talking signals do not reveal
            emotional state, honesty, confidence, or anxiety. Poise is not a
            medical device.
          </p>
        </article>
      </div>
      {storageError && <div className="notice error" style={{ marginTop: 16 }}>{storageError}</div>}
      {preferencesError && <div className="notice error" style={{ marginTop: 16 }}>{preferencesError}</div>}
      <div className="button-row">
        <button
          className="button-secondary"
          onClick={restoreDefaultPreferences}
        >
          Reset practice preferences
        </button>
        <button className="button-secondary" onClick={() => setScreen("history")}>
          Review saved sessions
        </button>
        <button className="button-secondary" onClick={() => void deleteAllData()}>
          Delete all local Poise data
        </button>
      </div>
      <p className="footer-note">
        See docs/PRIVACY.md and docs/CONSENT.md in the project for complete
        data handling and service communication disclosures.
      </p>
    </div>
  );

  const renderAbout = () => (
    <div className="page-content">
      <div className="eyebrow">About Poise</div>
      <h1 className="screen-title">Show up as yourself. At your best.</h1>
      <p className="screen-intro">
        Poise is a rehearsal companion for life’s important moments, with
        optional camera-based human sensing. It connects a personal check-in,
        an adaptive warm-up, practical speaking rehearsal, and a grounded
        reflection.
      </p>
      <div className="glass-card">
        <h3>Built with Presage SmartSpectra</h3>
        <p className="muted">
          SmartSpectra supplies live supported human-signal measurements.
          Poise uses valid readings to inform the experience, and keeps missing
          or unverified signals visibly unavailable.
        </p>
        <p className="muted">
          The goal isn’t to change who you are. It’s to help you prepare
          deliberately and find your own rhythm.
        </p>
      </div>
    </div>
  );

  const currentTitle: Record<Screen, string> = {
    home: "Home",
    setup: "New session",
    session: "Practice",
    history: "My sessions",
    progress: "My progress",
    settings: "Settings",
    about: "About Poise",
  };

  const content = {
    home: renderWelcome,
    setup: renderSetup,
    session: renderSession,
    history: renderHistory,
    progress: renderProgress,
    settings: renderSettings,
    about: renderAbout,
  }[screen]();

  return (
    <div className="app-shell">
      <aside aria-label="Main navigation" className="sidebar">
        <div className="brand">
          <span aria-hidden="true" className="brand-mark">P</span>
          <span className="brand-name">POISE</span>
        </div>
        <div className="nav-label">POISE</div>
        <nav className="nav-group">
          <button
            className={`nav-item ${screen === "home" ? "active" : ""}`}
            onClick={() => void navigate("home")}
          >
            <Icon name="home" /> <span>Home</span>
          </button>
          <button
            className="nav-item"
            onClick={() => {
              if (isSensing) {
                void stopSensing(false).then((stopped) => {
                  if (stopped) beginNewSession();
                });
              } else {
                beginNewSession();
              }
            }}
          >
            <Icon name="play" /> <span>New session</span>
          </button>
          <button
            className={`nav-item ${screen === "history" ? "active" : ""}`}
            onClick={() => void navigate("history")}
          >
            <Icon name="sessions" /> <span>My sessions</span>
          </button>
          <button
            className={`nav-item ${screen === "progress" ? "active" : ""}`}
            onClick={() => void navigate("progress")}
          >
            <Icon name="progress" /> <span>My progress</span>
          </button>
        </nav>
        <div className="nav-label">SETTINGS</div>
        <nav className="nav-group">
          <button
            className={`nav-item ${screen === "settings" ? "active" : ""}`}
            onClick={() => void navigate("settings")}
          >
            <Icon name="settings" /> <span>Privacy & data</span>
          </button>
          <button
            className={`nav-item ${screen === "about" ? "active" : ""}`}
            onClick={() => void navigate("about")}
          >
            <Icon name="shield" /> <span>About Poise</span>
          </button>
        </nav>
        <div className="sidebar-foot">
          A personal companion for the moments that matter.
          <br />
          Informational feedback, not medical advice.
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">POISE <span aria-hidden="true">/</span> {currentTitle[screen]}</div>
          <div aria-live="polite" className="topbar-right">
            <span className={`status-dot ${stream ? "live" : ""}`} />
            {stream
              ? "Camera active"
              : phase === "CAMERA_SETUP"
                ? "Starting camera sensing"
                : "Ready when you are"}
            {isSensing && (
              <button
                className="button-quiet"
                disabled={isStopping}
                onClick={() => void stopSensing()}
              >
                Stop sensing
              </button>
            )}
          </div>
        </header>
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1 }}
            initial={{ opacity: 0 }}
            key={screen}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
