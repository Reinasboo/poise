import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  instances: [] as Array<{
    emit(event: string, ...args: unknown[]): void;
    stopCalls: number;
    destroyCalls: number;
  }>,
  decodeMetrics: vi.fn(),
}));

vi.mock("@smartspectra/node-sdk/renderer", () => {
  class MockSmartSpectraSDK {
    private readonly handlers = new Map<string, (...args: unknown[]) => void>();
    stopCalls = 0;
    destroyCalls = 0;

    constructor() {
      mocks.instances.push(this);
    }

    on(event: string, callback: (...args: unknown[]) => void) {
      this.handlers.set(event, callback);
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.(...args);
    }

    async start() {}

    async stop() {
      this.stopCalls += 1;
    }

    async destroy() {
      this.destroyCalls += 1;
    }
  }

  return {
    SmartSpectraSDK: MockSmartSpectraSDK,
    MetricType: {
      CHEST_BREATHING: 1,
      ABDOMEN_BREATHING: 2,
      BREATHING_RATE: 3,
      PULSE_RATE: 4,
      HRV: 5,
      FACE_LANDMARKS: 6,
      BLINKING: 7,
      TALKING: 8,
    },
    ProcessingStatus: {},
    ValidationCode: {},
  };
});

vi.mock("@smartspectra/node-sdk/messages", () => ({
  decodeMetrics: mocks.decodeMetrics,
}));

import { normalizeSmartSpectraMetrics, SmartSpectraClient } from "./client";

beforeEach(() => {
  mocks.instances.length = 0;
  mocks.decodeMetrics.mockReset().mockImplementation(() => {
    throw new Error("Malformed metrics payload.");
  });
});

describe("SmartSpectra payload normalization", () => {
  it("preserves supported sample metadata and observable detection state", () => {
    const metrics = normalizeSmartSpectraMetrics(
      {
        breathing: {
          rate: [
            {
              value: 14.5,
              confidence: 83,
              stable: true,
              timestamp: 1_800_000_000_000_000,
            },
          ],
          upperTrace: [
            { value: -0.2, timestamp: 1_800_000_000_000_000 },
            { value: 0.3, timestamp: 1_800_000_000_001_000 },
          ],
        },
        cardio: {
          pulseRate: [
            {
              value: 72,
              confidence: 91,
              stable: true,
              timestamp: 1_800_000_000_000_000,
            },
          ],
          hrv: [
            {
              rmssd: 38.2,
              confidence: 77,
              stable: true,
              timestamp: 1_800_000_000_002_000,
            },
          ],
        },
        face: {
          landmarks: [
            {
              value: [{ x: 0.5, y: 0.5 }],
              stable: true,
              timestamp: 1_800_000_000_000_000,
            },
          ],
          talking: [
            {
              detected: false,
              stable: true,
              timestamp: 1_800_000_000_003_000,
            },
          ],
          blinking: [
            {
              detected: true,
              stable: true,
              timestamp: 1_800_000_000_004_000,
            },
          ],
        },
      },
      1_800_000_000_005_000,
    );

    expect(metrics.samples).toEqual([
      {
        metric: "breathing",
        value: 14.5,
        confidence: 83,
        stable: true,
        timestampUs: 1_800_000_000_000_000,
      },
      {
        metric: "pulse",
        value: 72,
        confidence: 91,
        stable: true,
        timestampUs: 1_800_000_000_000_000,
      },
      {
        metric: "hrv",
        value: 38.2,
        confidence: 77,
        stable: true,
        timestampUs: 1_800_000_000_002_000,
      },
    ]);
    expect(metrics.breathingWaveform).toEqual([-0.2, 0.3]);
    expect(metrics.faceVisible).toBe(true);
    expect(metrics.talking).toEqual({
      detected: false,
      stable: true,
      timestampUs: 1_800_000_000_003_000,
    });
    expect(metrics.blinking?.detected).toBe(true);
    expect(metrics.sdkTimestampUs).toBe(1_800_000_000_005_000);
  });

  it("does not mistake an empty latest landmarks sample for a visible face", () => {
    expect(
      normalizeSmartSpectraMetrics(
        { face: { landmarks: [{ value: [], stable: false, timestamp: 10 }] } },
        11,
      ).faceVisible,
    ).toBe(false);
    expect(
      normalizeSmartSpectraMetrics({ face: {} }, 11).faceVisible,
    ).toBeNull();
  });

  it("rejects malformed payloads instead of returning success-shaped empty data", () => {
    expect(() => normalizeSmartSpectraMetrics(null, 1)).toThrow(
      "SmartSpectra returned an unreadable metrics payload.",
    );
  });

  it("recovers from a malformed metrics payload without stopping camera sensing", async () => {
    const client = new SmartSpectraClient();
    const onMetricsError = vi.fn();
    const onMetrics = vi.fn();
    const onError = vi.fn();
    mocks.decodeMetrics
      .mockImplementationOnce(() => {
        throw new Error("Malformed metrics payload.");
      })
      .mockImplementationOnce(() => ({
        breathing: {
          rate: [{
            value: 14.5,
            confidence: 83,
            stable: true,
            timestamp: 1_800_000_000_000_000,
          }],
        },
      }));

    await client.start("test-api-key", {
      onStream: vi.fn(),
      onMetrics,
      onMetricsError,
      onProcessingStatus: vi.fn(),
      onValidation: vi.fn(),
      onError,
    });

    const sdk = mocks.instances[0];
    sdk.emit("metrics", new Uint8Array(), 1);
    sdk.emit("metrics", new Uint8Array(), 1_800_000_000_001_000);

    expect(onMetricsError).toHaveBeenCalledWith(
      "Could not decode SmartSpectra measurements: Malformed metrics payload.",
    );
    expect(onMetrics).toHaveBeenCalledOnce();
    expect(onMetrics.mock.calls[0][0].samples[0].value).toBe(14.5);
    expect(onError).not.toHaveBeenCalled();
    expect(sdk.stopCalls).toBe(0);
    expect(sdk.destroyCalls).toBe(0);
  });
});
