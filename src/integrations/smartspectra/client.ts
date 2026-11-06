import type { MetricName, SignalSample } from "../../engine/session";
type RendererSdk = import("@smartspectra/node-sdk/renderer").SmartSpectraSDK;

export interface DetectionSample {
  detected: boolean;
  stable: boolean;
  timestampUs: number;
}

export interface LiveMetrics {
  samples: SignalSample[];
  breathingWaveform: number[];
  breathingWaveformTimestampUs?: number;
  talking?: DetectionSample;
  blinking?: DetectionSample;
  faceVisible: boolean | null;
  sdkTimestampUs: number;
}

export interface SmartSpectraCallbacks {
  onStream(stream: MediaStream): void;
  onMetrics(metrics: LiveMetrics): void;
  onProcessingStatus(status: string): void;
  onValidation(hint: string, timestampUs: number): void;
  onError(message: string, retryable: boolean): void;
}

export interface SmartSpectraController {
  start(apiKey: string, callbacks: SmartSpectraCallbacks): Promise<void>;
  stop(): Promise<void>;
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") {
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : undefined;
  }
  if (typeof value === "object" && value !== null) {
    const toNumber = Reflect.get(value, "toNumber");
    if (typeof toNumber === "function") {
      const converted: unknown = Reflect.apply(toNumber, value, []);
      return typeof converted === "number" && Number.isFinite(converted)
        ? converted
        : undefined;
    }
    const low = Reflect.get(value, "low");
    const high = Reflect.get(value, "high");
    if (typeof low === "number" && typeof high === "number") {
      const converted = high * 0x1_0000_0000 + (low >>> 0);
      return Number.isFinite(converted) ? converted : undefined;
    }
  }
  return undefined;
}

function parseSamples(
  value: unknown,
  metric: MetricName,
  valueField = "value",
): SignalSample[] {
  if (!Array.isArray(value)) return [];
  const parsed: SignalSample[] = [];
  for (const entry of value) {
    const item = record(entry);
    if (!item) continue;
    const sampleValue = numberValue(item[valueField]);
    const timestampUs = numberValue(item.timestamp);
    if (sampleValue === undefined || timestampUs === undefined) continue;
    const confidence = numberValue(item.confidence);
    parsed.push({
      metric,
      value: sampleValue,
      timestampUs,
      ...(confidence === undefined ? {} : { confidence }),
      ...(typeof item.stable === "boolean" ? { stable: item.stable } : {}),
    });
  }
  return parsed;
}

function parseDetection(value: unknown): DetectionSample | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const item = record(value[value.length - 1]);
  if (!item || typeof item.detected !== "boolean") return undefined;
  const timestampUs = numberValue(item.timestamp);
  if (timestampUs === undefined) return undefined;
  return {
    detected: item.detected,
    stable: item.stable === true,
    timestampUs,
  };
}

export function normalizeSmartSpectraMetrics(
  decoded: unknown,
  sdkTimestampUs: number,
): LiveMetrics {
  const root = record(decoded);
  if (!root) throw new Error("SmartSpectra returned an unreadable metrics payload.");
  const breathing = record(root.breathing);
  const cardio = record(root.cardio);
  const face = record(root.face);
  const samples = [
    ...parseSamples(breathing?.rate, "breathing"),
    ...parseSamples(cardio?.pulseRate, "pulse"),
    ...parseSamples(cardio?.hrv, "hrv", "rmssd"),
  ];
  const upperTrace = parseSamples(breathing?.upperTrace, "breathing");
  const lowerTrace = parseSamples(breathing?.lowerTrace, "breathing");
  const landmarks = Array.isArray(face?.landmarks)
    ? record(face.landmarks.at(-1))
    : undefined;
  const landmarkPoints = landmarks?.value;

  return {
    samples,
    breathingWaveform: upperTrace.length > 0
      ? upperTrace.slice(-120).map((sample) => sample.value)
      : lowerTrace.slice(-120).map((sample) => sample.value),
    breathingWaveformTimestampUs: (upperTrace.at(-1) ?? lowerTrace.at(-1))?.timestampUs,
    talking: parseDetection(face?.talking),
    blinking: parseDetection(face?.blinking),
    faceVisible: Array.isArray(landmarkPoints) ? landmarkPoints.length > 0 : null,
    sdkTimestampUs,
  };
}

function enumName(values: Record<string, unknown>, value: unknown): string {
  const match = Object.entries(values).find(([, candidate]) => candidate === value);
  return match?.[0]?.replace(/^k/, "") ?? `Status ${String(value)}`;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export class SmartSpectraClient implements SmartSpectraController {
  private sdk?: RendererSdk;
  private generation = 0;

  async start(apiKey: string, callbacks: SmartSpectraCallbacks): Promise<void> {
    if (!apiKey.trim()) throw new Error("Enter a SmartSpectra API key to start sensing.");
    const generation = ++this.generation;
    await this.stopCurrent();

    const [rendererSdk, messageDecoder] = await Promise.all([
      import("@smartspectra/node-sdk/renderer"),
      import("@smartspectra/node-sdk/messages"),
    ]);
    if (generation !== this.generation) return;
    const {
      SmartSpectraSDK,
      MetricType,
      ProcessingStatus,
      ValidationCode,
    } = rendererSdk;
    const { decodeMetrics } = messageDecoder;
    const sdk = new SmartSpectraSDK({
      apiKey: apiKey.trim(),
      requestedMetrics: [
        MetricType.CHEST_BREATHING,
        MetricType.ABDOMEN_BREATHING,
        MetricType.BREATHING_RATE,
        MetricType.PULSE_RATE,
        MetricType.HRV,
        MetricType.FACE_LANDMARKS,
        MetricType.BLINKING,
        MetricType.TALKING,
      ],
      enableTelemetry: false,
    });
    this.sdk = sdk;
    const isCurrent = () => generation === this.generation;

    sdk.on("streamAvailable", (stream) => {
      if (isCurrent()) callbacks.onStream(stream);
    });
    sdk.on("processingStatus", (status) => {
      if (isCurrent()) {
        callbacks.onProcessingStatus(enumName(ProcessingStatus, status));
      }
    });
    sdk.on("validationStatus", (code, timestampUs, hint) => {
      if (!isCurrent()) return;
      const name = enumName(ValidationCode, code);
      callbacks.onValidation(hint || name, timestampUs);
    });
    sdk.on("metrics", (buffer, timestampUs) => {
      if (!isCurrent()) return;
      try {
        callbacks.onMetrics(
          normalizeSmartSpectraMetrics(decodeMetrics(buffer), timestampUs),
        );
      } catch (error) {
        callbacks.onError(
          `Could not decode SmartSpectra measurements: ${errorText(error)}`,
          false,
        );
      }
    });
    sdk.on("error", (code, message, retryable) => {
      if (isCurrent()) {
        callbacks.onError(`SmartSpectra error ${String(code)}: ${message}`, retryable);
      }
    });

    try {
      await sdk.start();
    } catch (error) {
      if (generation !== this.generation) return;
      callbacks.onError(errorText(error), false);
      throw new Error(`SmartSpectra could not start: ${errorText(error)}`, {
        cause: error,
      });
    }
  }

  async stop(): Promise<void> {
    this.generation += 1;
    await this.stopCurrent();
  }

  private async stopCurrent(): Promise<void> {
    const sdk = this.sdk;
    if (!sdk) return;
    this.sdk = undefined;
    try {
      await sdk.stop();
    } finally {
      await sdk.destroy();
    }
  }
}

export const smartSpectraClient = new SmartSpectraClient();
