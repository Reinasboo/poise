import { z } from "zod";
import type { SessionKind } from "../engine/session";

export interface UserPreferences {
  kind: SessionKind;
  durationMinutes: number;
  guidedRate: number;
}

export const defaultPreferences: UserPreferences = {
  kind: "interview",
  durationMinutes: 4,
  guidedRate: 10,
};

const preferencesKey = "poise-preferences";
const preferencesSchema = z.object({
  kind: z.enum(["interview", "presentation", "pitch", "camera"]),
  durationMinutes: z.union([
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(7),
    z.literal(10),
    z.literal(15),
  ]),
  guidedRate: z.number().int().min(4).max(16),
});

export function readPreferences(): UserPreferences {
  const saved = localStorage.getItem(preferencesKey);
  if (saved === null) return defaultPreferences;

  let decoded: unknown;
  try {
    decoded = JSON.parse(saved);
  } catch (error) {
    throw new Error("Saved Poise preferences are not valid JSON.", { cause: error });
  }

  const parsed = preferencesSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error("Saved Poise preferences contain invalid values.", {
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function writePreferences(preferences: UserPreferences): void {
  const parsed = preferencesSchema.safeParse(preferences);
  if (!parsed.success) {
    throw new Error("Poise refused to save invalid practice preferences.", {
      cause: parsed.error,
    });
  }
  localStorage.setItem(preferencesKey, JSON.stringify(parsed.data));
}

export function resetPreferences(): void {
  localStorage.removeItem(preferencesKey);
}
