import initSqlJs, { type Database } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { z } from "zod";
import type { MetricName, SignalSample, TalkingInterval } from "../engine/session";

export interface SessionDetails {
  baseline: Partial<Record<MetricName, SignalSample>>;
  recovery: Partial<Record<MetricName, SignalSample>>;
  talkingIntervals: TalkingInterval[];
  blinkCount: number;
  cameraSensingUsed?: boolean;
}

export interface StoredSession {
  id: string;
  kind: "interview" | "presentation" | "pitch" | "camera";
  createdAt: number;
  durationMs: number;
  objective: string;
  practiceCompleted: boolean;
  baselinePulse?: number;
  recoveryPulse?: number;
  baselineBreathing?: number;
  recoveryBreathing?: number;
  baselineHrv?: number;
  recoveryHrv?: number;
  details: SessionDetails;
  speakingIntervals: number;
  pauses: number;
  suggestion: string;
}

const metricNameSchema = z.enum(["pulse", "breathing", "hrv"]);
const signalSampleSchema = z.object({
  metric: metricNameSchema,
  value: z.number(),
  timestampUs: z.number(),
  confidence: z.number().optional(),
  stable: z.boolean().optional(),
});
const sessionDetailsSchema = z.object({
  baseline: z.partialRecord(metricNameSchema, signalSampleSchema),
  recovery: z.partialRecord(metricNameSchema, signalSampleSchema),
  talkingIntervals: z.array(
    z.object({ startedAt: z.number(), endedAt: z.number() }),
  ),
  blinkCount: z.number().int().nonnegative(),
  cameraSensingUsed: z.boolean().optional(),
});

const databaseName = "poise-local";
const databaseKey = "session-summaries.sqlite";

function openPersistence(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage."));
  });
}

async function readDatabaseBytes(): Promise<Uint8Array | undefined> {
  if (window.poiseStorage) {
    const bytes = await window.poiseStorage.readSessionDatabase();
    return bytes ?? undefined;
  }
  const persistence = await openPersistence();
  return new Promise((resolve, reject) => {
    const request = persistence
      .transaction("files", "readonly")
      .objectStore("files")
      .get(databaseKey);
    request.onsuccess = () => {
      const value = request.result as Uint8Array | ArrayBuffer | undefined;
      persistence.close();
      resolve(
        value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : value instanceof Uint8Array
            ? value
            : undefined,
      );
    };
    request.onerror = () => {
      persistence.close();
      reject(request.error ?? new Error("Could not read local sessions."));
    };
  });
}

async function writeDatabaseBytes(bytes: Uint8Array): Promise<void> {
  if (window.poiseStorage) {
    await window.poiseStorage.writeSessionDatabase(bytes);
    return;
  }
  const persistence = await openPersistence();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = persistence.transaction("files", "readwrite");
      transaction.objectStore("files").put(bytes, databaseKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not save local sessions."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Saving local sessions was aborted."));
    });
  } finally {
    persistence.close();
  }
}

async function removePersistedDatabase(): Promise<void> {
  if (window.poiseStorage) {
    await window.poiseStorage.deleteSessionDatabase();
    return;
  }
  const persistence = await openPersistence();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = persistence.transaction("files", "readwrite");
      transaction.objectStore("files").delete(databaseKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not delete local sessions."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Deleting local sessions was aborted."));
    });
  } finally {
    persistence.close();
  }
}

class SessionStore {
  private ready?: Promise<Database>;

  private getDatabase(): Promise<Database> {
    this.ready ??= this.initialize();
    return this.ready;
  }

  private async initialize(): Promise<Database> {
    const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
    const bytes = await readDatabaseBytes();
    const database = bytes ? new SQL.Database(bytes) : new SQL.Database();
    database.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        objective TEXT NOT NULL,
        practice_completed INTEGER NOT NULL,
        baseline_pulse REAL,
        recovery_pulse REAL,
        baseline_breathing REAL,
        recovery_breathing REAL,
        baseline_hrv REAL,
        recovery_hrv REAL,
        details_json TEXT NOT NULL DEFAULT '{"baseline":{},"recovery":{},"talkingIntervals":[],"blinkCount":0}',
        speaking_intervals INTEGER NOT NULL,
        pauses INTEGER NOT NULL,
        suggestion TEXT NOT NULL
      )
    `);
    const columns = database.exec("PRAGMA table_info(sessions)")[0]?.values ?? [];
    if (!columns.some((column) => column[1] === "details_json")) {
      database.run(
        `ALTER TABLE sessions ADD COLUMN details_json TEXT NOT NULL DEFAULT
          '{"baseline":{},"recovery":{},"talkingIntervals":[],"blinkCount":0}'`,
      );
    }
    return database;
  }

  private async persist(database: Database): Promise<void> {
    await writeDatabaseBytes(database.export());
  }

  async list(): Promise<StoredSession[]> {
    const database = await this.getDatabase();
    const result = database.exec(
      `SELECT id, kind, created_at, duration_ms, objective, practice_completed,
        baseline_pulse, recovery_pulse, baseline_breathing, recovery_breathing,
        baseline_hrv, recovery_hrv, details_json, speaking_intervals, pauses, suggestion
       FROM sessions ORDER BY created_at DESC`,
    )[0];
    if (!result) return [];
    return result.values.map((row) => ({
      id: String(row[0]),
      kind: row[1] as StoredSession["kind"],
      createdAt: Number(row[2]),
      durationMs: Number(row[3]),
      objective: String(row[4]),
      practiceCompleted: Number(row[5]) === 1,
      baselinePulse: nullableNumber(row[6]),
      recoveryPulse: nullableNumber(row[7]),
      baselineBreathing: nullableNumber(row[8]),
      recoveryBreathing: nullableNumber(row[9]),
      baselineHrv: nullableNumber(row[10]),
      recoveryHrv: nullableNumber(row[11]),
      details: sessionDetailsSchema.parse(JSON.parse(String(row[12]))),
      speakingIntervals: Number(row[13]),
      pauses: Number(row[14]),
      suggestion: String(row[15]),
    }));
  }

  async save(session: StoredSession): Promise<void> {
    const database = await this.getDatabase();
    database.run(
      `INSERT OR REPLACE INTO sessions
       (id, kind, created_at, duration_ms, objective, practice_completed,
        baseline_pulse, recovery_pulse, baseline_breathing, recovery_breathing,
        baseline_hrv, recovery_hrv, details_json, speaking_intervals, pauses, suggestion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.kind,
        session.createdAt,
        session.durationMs,
        session.objective,
        session.practiceCompleted ? 1 : 0,
        session.baselinePulse ?? null,
        session.recoveryPulse ?? null,
        session.baselineBreathing ?? null,
        session.recoveryBreathing ?? null,
        session.baselineHrv ?? null,
        session.recoveryHrv ?? null,
        JSON.stringify(session.details),
        session.speakingIntervals,
        session.pauses,
        session.suggestion,
      ],
    );
    await this.persist(database);
  }

  async delete(id: string): Promise<void> {
    const database = await this.getDatabase();
    database.run("DELETE FROM sessions WHERE id = ?", [id]);
    await this.persist(database);
  }

  async deleteAll(): Promise<void> {
    const database = await this.getDatabase();
    database.close();
    this.ready = undefined;
    await removePersistedDatabase();
  }
}

function nullableNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export const sessionStore = new SessionStore();
