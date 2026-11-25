import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { getSurah } from "@/data/quran";
import { DB_NAME, MIGRATIONS } from "./schema";

export type MemorizationStatus = "learning" | "review" | "mastered";
export type MistakeType = "missing" | "substituted" | "extra" | "skipped_ayah" | "tajweed";

export interface MemorizationRow {
  surah: number;
  ayah: number;
  status: MemorizationStatus;
  updated_at: number;
}

export interface RecitationRow {
  id: number;
  start_key: string;
  end_key: string;
  started_at: number;
  duration_ms: number;
  accuracy: number;
  words: number;
  errors: number;
  transcript: string;
  audio_uri: string | null;
  offline: number;
}

export interface MistakeRow {
  id: number;
  recitation_id: number | null;
  surah: number;
  ayah: number;
  expected: string;
  actual: string;
  type: MistakeType;
  confidence: number;
  mastered: number;
  streak: number;
  review_count: number;
  due_at: number;
  created_at: number;
  last_reviewed_at: number | null;
}

export interface QuizResultRow {
  id: number;
  mode: string;
  score: number;
  total: number;
  created_at: number;
}

export interface ReviewDayRow {
  day: string;
  goal: number;
  completed: number;
}

let database: SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLiteDatabase> {
  if (!database) {
    database = await openDatabaseAsync(DB_NAME);
    await database.execAsync(MIGRATIONS);
  }
  return database;
}

export async function closeDb(): Promise<void> {
  if (database) {
    await database.closeAsync();
    database = null;
  }
}

/* ------------------------------- settings ------------------------------- */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    JSON.stringify(value),
  );
}

/* ----------------------------- memorization ----------------------------- */

export async function setMemorization(surah: number, ayah: number, status: MemorizationStatus): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO memorization(surah, ayah, status, updated_at) VALUES(?, ?, ?, ?)
     ON CONFLICT(surah, ayah) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
    surah,
    ayah,
    status,
    Date.now(),
  );
}

export async function setSurahMemorization(surah: number, status: MemorizationStatus): Promise<void> {
  const db = await getDb();
  const count = getSurah(surah)?.verses ?? 0;
  if (!count) return;
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM memorization WHERE surah = ?", surah);
    for (let ayah = 1; ayah <= count; ayah++) {
      await db.runAsync(
        "INSERT INTO memorization(surah, ayah, status, updated_at) VALUES(?, ?, ?, ?)",
        surah,
        ayah,
        status,
        now,
      );
    }
  });
}

export async function clearSurahMemorization(surah: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM memorization WHERE surah = ?", surah);
}

export async function clearMemorization(surah: number, ayah: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM memorization WHERE surah = ? AND ayah = ?", surah, ayah);
}

export async function getMemorization(): Promise<Record<string, MemorizationStatus>> {
  const db = await getDb();
  const rows = await db.getAllAsync<MemorizationRow>("SELECT * FROM memorization");
  const result: Record<string, MemorizationStatus> = {};
  for (const row of rows) result[`${row.surah}:${row.ayah}`] = row.status;
  return result;
}

export async function getMemorizedSurahs(): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ surah: number }>(
    "SELECT DISTINCT surah FROM memorization WHERE status IN ('review','mastered') ORDER BY surah",
  );
  return rows.map((row) => row.surah);
}

/* ------------------------------ recitations ----------------------------- */

export interface NewRecitation {
  startKey: string;
  endKey: string;
  startedAt: number;
  durationMs: number;
  accuracy: number;
  words: number;
  errors: number;
  transcript: string;
  audioUri: string | null;
  offline: boolean;
}

export async function addRecitation(recitation: NewRecitation): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO recitations(start_key, end_key, started_at, duration_ms, accuracy, words, errors, transcript, audio_uri, offline)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    recitation.startKey,
    recitation.endKey,
    recitation.startedAt,
    recitation.durationMs,
    recitation.accuracy,
    recitation.words,
    recitation.errors,
    recitation.transcript,
    recitation.audioUri,
    recitation.offline ? 1 : 0,
  );
  return result.lastInsertRowId;
}

export async function getRecitation(id: number): Promise<RecitationRow | null> {
  const db = await getDb();
  return db.getFirstAsync<RecitationRow>("SELECT * FROM recitations WHERE id = ?", id);
}

export async function listRecitations(limit = 50): Promise<RecitationRow[]> {
  const db = await getDb();
  return db.getAllAsync<RecitationRow>("SELECT * FROM recitations ORDER BY started_at DESC LIMIT ?", limit);
}

/* -------------------------------- mistakes ------------------------------ */

export interface NewMistake {
  recitationId: number | null;
  surah: number;
  ayah: number;
  expected: string;
  actual: string;
  type: MistakeType;
  confidence: number;
}

export async function addMistakes(mistakes: NewMistake[]): Promise<void> {
  if (!mistakes.length) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const now = Date.now();
    for (const mistake of mistakes) {
      await db.runAsync(
        `INSERT INTO mistakes(recitation_id, surah, ayah, expected, actual, type, confidence, created_at, due_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        mistake.recitationId,
        mistake.surah,
        mistake.ayah,
        mistake.expected,
        mistake.actual,
        mistake.type,
        mistake.confidence,
        now,
        now,
      );
    }
  });
}

export async function listMistakes(options: { activeOnly?: boolean; limit?: number } = {}): Promise<MistakeRow[]> {
  const db = await getDb();
  const where = options.activeOnly ? "WHERE mastered = 0" : "";
  const limit = options.limit ? `LIMIT ${Math.max(1, Math.floor(options.limit))}` : "";
  return db.getAllAsync<MistakeRow>(`SELECT * FROM mistakes ${where} ORDER BY created_at DESC ${limit}`);
}

export async function getDueMistakes(now = Date.now()): Promise<MistakeRow[]> {
  const db = await getDb();
  return db.getAllAsync<MistakeRow>(
    "SELECT * FROM mistakes WHERE mastered = 0 AND due_at <= ? ORDER BY due_at ASC LIMIT 20",
    now,
  );
}

/** A mistake leaves the review queue only after two correct reviews in a row. */
export async function reviewMistake(id: number, correct: boolean): Promise<{ mastered: boolean; streak: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<MistakeRow>("SELECT * FROM mistakes WHERE id = ?", id);
  if (!row) return { mastered: false, streak: 0 };
  const streak = correct ? row.streak + 1 : 0;
  const mastered = streak >= 2 ? 1 : 0;
  const interval = correct ? Math.max(1, Math.min(30, 2 ** streak)) : 1;
  await db.runAsync(
    `UPDATE mistakes SET streak = ?, mastered = ?, review_count = review_count + 1,
     last_reviewed_at = ?, due_at = ? WHERE id = ?`,
    streak,
    mastered,
    Date.now(),
    Date.now() + interval * 24 * 60 * 60 * 1000,
    id,
  );
  return { mastered: Boolean(mastered), streak };
}

export async function countActiveMistakes(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM mistakes WHERE mastered = 0");
  return row?.count ?? 0;
}

/* -------------------------------- quizzes -------------------------------- */

export async function addQuizResult(mode: string, score: number, total: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("INSERT INTO quiz_results(mode, score, total, created_at) VALUES(?, ?, ?, ?)", mode, score, total, Date.now());
}

export async function listQuizResults(limit = 50): Promise<QuizResultRow[]> {
  const db = await getDb();
  return db.getAllAsync<QuizResultRow>("SELECT * FROM quiz_results ORDER BY created_at DESC LIMIT ?", limit);
}

/* ------------------------------- review days ----------------------------- */

export function dayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function setDailyGoal(goal: number, day = dayKey()): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO review_days(day, goal, completed) VALUES(?, ?, 0) ON CONFLICT(day) DO UPDATE SET goal = excluded.goal",
    day,
    goal,
  );
}

export async function getDailyGoal(day = dayKey()): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ goal: number }>("SELECT goal FROM review_days WHERE day = ?", day);
  return row?.goal ?? 5;
}

export async function completeReview(count = 1, day = dayKey()): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO review_days(day, goal, completed) VALUES(?, 5, ?)
     ON CONFLICT(day) DO UPDATE SET completed = completed + excluded.completed`,
    day,
    count,
  );
}

export async function listReviewDays(limit = 400): Promise<ReviewDayRow[]> {
  const db = await getDb();
  return db.getAllAsync<ReviewDayRow>("SELECT * FROM review_days ORDER BY day DESC LIMIT ?", limit);
}

/* ------------------------- backup / delete / restore --------------------- */

export interface BackupPayload {
  app: "rattil";
  version: 1;
  exportedAt: string;
  tables: {
    settings: Array<{ key: string; value: string }>;
    memorization: MemorizationRow[];
    recitations: RecitationRow[];
    mistakes: MistakeRow[];
    quiz_results: QuizResultRow[];
    review_days: ReviewDayRow[];
  };
}

export async function exportBackup(): Promise<BackupPayload> {
  const db = await getDb();
  const [settings, memorization, recitations, mistakes, quizResults, reviewDays] = await Promise.all([
    db.getAllAsync<{ key: string; value: string }>("SELECT * FROM settings"),
    db.getAllAsync<MemorizationRow>("SELECT * FROM memorization"),
    db.getAllAsync<RecitationRow>("SELECT * FROM recitations"),
    db.getAllAsync<MistakeRow>("SELECT * FROM mistakes"),
    db.getAllAsync<QuizResultRow>("SELECT * FROM quiz_results"),
    db.getAllAsync<ReviewDayRow>("SELECT * FROM review_days"),
  ]);
  return {
    app: "rattil",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      settings,
      memorization,
      recitations,
      mistakes,
      quiz_results: quizResults,
      review_days: reviewDays,
    },
  };
}

export async function importBackup(payload: BackupPayload): Promise<void> {
  if (payload?.app !== "rattil" || payload.version !== 1 || !payload.tables) {
    throw new Error("صيغة النسخة الاحتياطية غير صحيحة");
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of ["settings", "memorization", "recitations", "mistakes", "quiz_results", "review_days"]) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    const { settings, memorization, recitations, mistakes, quiz_results, review_days } = payload.tables;
    for (const row of settings) await db.runAsync("INSERT INTO settings(key, value) VALUES(?, ?)", row.key, row.value);
    for (const row of memorization)
      await db.runAsync("INSERT INTO memorization(surah, ayah, status, updated_at) VALUES(?, ?, ?, ?)", row.surah, row.ayah, row.status, row.updated_at);
    for (const row of recitations)
      await db.runAsync(
        `INSERT INTO recitations(id, start_key, end_key, started_at, duration_ms, accuracy, words, errors, transcript, audio_uri, offline)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.start_key, row.end_key, row.started_at, row.duration_ms, row.accuracy, row.words, row.errors,
        row.transcript, row.audio_uri, row.offline,
      );
    for (const row of mistakes)
      await db.runAsync(
        `INSERT INTO mistakes(id, recitation_id, surah, ayah, expected, actual, type, confidence, mastered, streak,
         review_count, due_at, created_at, last_reviewed_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.recitation_id, row.surah, row.ayah, row.expected, row.actual, row.type, row.confidence,
        row.mastered, row.streak, row.review_count, row.due_at, row.created_at, row.last_reviewed_at,
      );
    for (const row of quiz_results)
      await db.runAsync("INSERT INTO quiz_results(id, mode, score, total, created_at) VALUES(?, ?, ?, ?, ?)", row.id, row.mode, row.score, row.total, row.created_at);
    for (const row of review_days)
      await db.runAsync("INSERT INTO review_days(day, goal, completed) VALUES(?, ?, ?)", row.day, row.goal, row.completed);
  });
}

/** Clears references to local audio clips without touching recitation stats. */
export async function clearAllAudioUris(): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE recitations SET audio_uri = NULL WHERE audio_uri IS NOT NULL");
}

export async function deleteAllUserData(): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const table of ["settings", "memorization", "recitations", "mistakes", "quiz_results", "review_days"]) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
  });
}
