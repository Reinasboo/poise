import { describe, expect, it } from "vitest";
import {
  canTransition,
  compareMeasurements,
  isStationaryMetricUsable,
  minimumWindowsMs,
  nextPracticeSuggestion,
  transition,
  type SignalSample,
} from "./session";

describe("session state machine", () => {
  it("allows only explicitly defined transitions", () => {
    expect(canTransition("IDLE", "CONSENT")).toBe(true);
    expect(canTransition("IDLE", "REHEARSAL")).toBe(false);
    expect(() => transition("IDLE", "REHEARSAL")).toThrow(
      "Invalid session transition: IDLE -> REHEARSAL",
    );
  });
});

describe("signal quality", () => {
  const sample: SignalSample = {
    metric: "breathing",
    value: 14,
    timestampUs: 1_000_000,
    confidence: 72,
    stable: true,
  };

  it("requires the documented window, stable data, and a stationary phase", () => {
    expect(
      isStationaryMetricUsable(sample, "preparation", 0, 29_999),
    ).toBe(false);
    expect(
      isStationaryMetricUsable(sample, "preparation", 0, 30_000),
    ).toBe(true);
    expect(
      isStationaryMetricUsable(sample, "rehearsal", 0, 60_000),
    ).toBe(false);
    expect(minimumWindowsMs).toEqual({
      pulse: 12_000,
      breathing: 30_000,
      hrv: 60_000,
    });
  });

  it("rejects unstable, missing, or invalid measurements instead of treating them as zero", () => {
    expect(
      isStationaryMetricUsable(
        { ...sample, stable: false },
        "preparation",
        0,
        60_000,
      ),
    ).toBe(false);
    expect(
      isStationaryMetricUsable(
        { ...sample, value: Number.NaN },
        "preparation",
        0,
        60_000,
      ),
    ).toBe(false);
    expect(
      isStationaryMetricUsable(
        { ...sample, confidence: 0 },
        "preparation",
        0,
        60_000,
      ),
    ).toBe(false);
  });
});

describe("session reflection", () => {
  it("compares only matching, stable measurements", () => {
    const recovery: SignalSample = {
      metric: "breathing",
      value: 13,
      stable: true,
      timestampUs: 2,
    };
    expect(compareMeasurements(
      { metric: "breathing", value: 15, stable: true, timestampUs: 1 },
      recovery,
    )).toEqual({ baseline: 15, recovery: 13, delta: -2 });
    expect(
      compareMeasurements(
        { metric: "pulse", value: 75, stable: true, timestampUs: 1 },
        recovery,
      ),
    ).toBeNull();
    expect(
      compareMeasurements(
        { metric: "breathing", value: 15, stable: false, timestampUs: 1 },
        recovery,
      ),
    ).toBeNull();
  });

  it("grounds suggestions in observable practice or the selected objective", () => {
    expect(nextPracticeSuggestion([], "")).toBe(
      "Try a short opening when you feel ready to begin.",
    );
    expect(
      nextPracticeSuggestion(
        [{ startedAt: 0, endedAt: 15_000 }],
        "Explain my project clearly",
      ),
    ).toContain("Explain my project clearly");
  });
});
