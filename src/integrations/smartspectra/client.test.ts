import { describe, expect, it } from "vitest";
import { normalizeSmartSpectraMetrics } from "./client";

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
});
