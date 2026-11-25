

import { getSurah, getVerses, getVerse, nextVerse, previousVerse, type Verse } from "@/data/quran";

export type QuizMode =
  | "complete"
  | "next"
  | "previous"
  | "surah"
  | "missingWord"
  | "order"
  | "similar"
  | "oral"
  | "multiple";

export interface Question {
  id: string;
  mode: QuizMode;
  verse: Verse;
  prompt: string;
  options: string[];
  answer: string;
  /** For order/arrange questions: the ordered verse keys. */
  orderedKeys?: string[];
  /** For oral questions: the unvocalised text used by the matcher. */
  oralText?: string;
  explanation?: string;
  context?: string;
}

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length) % items.length];
}

function withoutLastWords(text: string, count: number): string {
  const parts = text.split(/\s+/);
  return parts.slice(0, Math.max(1, parts.length - count)).join(" ");
}

function lastWords(text: string, count: number): string {
  return text.split(/\s+/).slice(-count).join(" ");
}

/** All ayat from the surahs the user selected as memorised. */
export function sourceVerses(surahs: number[]): Verse[] {
  return surahs.flatMap((surah) => getVerses(surah));
}

function distractors(correct: string, pool: string[], random: () => number, count = 3, keyOf?: (item: string) => string): string[] {
  const unique = [...new Set(pool.filter((item) => (keyOf ? keyOf(item) !== keyOf(correct) : item !== correct)))];
  return shuffle(unique, random).slice(0, count);
}

function makeOptions(correct: string, pool: string[], random: () => number): string[] {
  return shuffle([correct, ...distractors(correct, pool, random)], random);
}

/**
 * Generates every question type entirely from the bundled Quran text, filtered
 * by the surahs the learner marked as memorised. No network call is involved.
 */
export function generateQuestions(mode: QuizMode, surahs: number[], count = 10, seed = Date.now()): Question[] {
  const random = rng(seed);
  const verses = sourceVerses(surahs);
  if (!verses.length) return [];
  const texts = verses.map((verse) => verse.simple);
  const questions: Question[] = [];

  for (let n = 0; n < count; n++) {
    const verse = pick(verses, random);
    const id = `${mode}-${seed}-${n}`;
    const surahName = getSurah(verse.surah)?.name ?? "";

    switch (mode) {
      case "complete": {
        const answer = lastWords(verse.simple, 2);
        questions.push({
          id,
          mode,
          verse,
          prompt: `${surahName} ${verse.ayah}\n${withoutLastWords(verse.text, 2)} …`,
          options: makeOptions(answer, texts, random),
          answer,
          explanation: verse.text,
        });
        break;
      }
      case "next": {
        const following = nextVerse(verse);
        if (!following) continue;
        questions.push({
          id,
          mode,
          verse,
          prompt: `ما الآية التالية من: ${verse.text}؟`,
          options: makeOptions(following.text, verses.map((v) => v.text), random),
          answer: following.text,
        });
        break;
      }
      case "previous": {
        const prior = previousVerse(verse);
        if (!prior) continue;
        questions.push({
          id,
          mode,
          verse,
          prompt: `ما الآية السابقة من: ${verse.text}؟`,
          options: makeOptions(prior.text, verses.map((v) => v.text), random),
          answer: prior.text,
        });
        break;
      }
      case "surah": {
        questions.push({
          id,
          mode,
          verse,
          prompt: verse.text,
          options: makeOptions(surahName, SURAHS_NAMES, random),
          answer: surahName,
        });
        break;
      }
      case "missingWord": {
        const tokens = verse.simple.split(/\s+/);
        const index = Math.floor(random() * tokens.length);
        const answer = tokens[index];
        const shown = verse.text.split(/\s+/);
        shown[index] = "______";
        questions.push({
          id,
          mode,
          verse,
          prompt: `${surahName} ${verse.ayah}\n${shown.join(" ")}`,
          options: makeOptions(answer, texts.flatMap((text) => text.split(/\s+/)), random),
          answer,
          explanation: verse.text,
        });
        break;
      }
      case "order": {
        const start = Math.max(1, Math.min(verse.ayah, getSurah(verse.surah)?.verses ?? 1));
        const selected = [start, start + 1, start + 2]
          .map((ayah) => getVerse(verse.surah, ayah))
          .filter((item): item is Verse => Boolean(item));
        if (selected.length < 2) continue;
        const orderedKeys = selected.map((item) => `${item.surah}:${item.ayah}`);
        questions.push({
          id,
          mode,
          verse: selected[0],
          prompt: `رتّب آيات ${surahName} من الآية ${selected[0].ayah}`,
          orderedKeys,
          options: shuffle(
            selected.map((item) => item.text),
            random,
          ),
          answer: orderedKeys.join("|"),
        });
        break;
      }
      case "similar": {
        const prefix = verse.simple.split(/\s+/).slice(0, 3).join(" ");
        const candidates = verses.filter(
          (candidate) => candidate.ayah !== verse.ayah || candidate.surah !== verse.surah,
        );
        const similar = candidates
          .map((candidate) => ({ candidate, score: sharedPrefix(candidate.simple, prefix) }))
          .filter((item) => item.score >= 2)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map((item) => item.candidate.simple);
        const pool = similar.length >= 3 ? similar : shuffle(texts, random).slice(0, 8);
        questions.push({
          id,
          mode,
          verse,
          prompt: `أكمل: ${prefix} …`,
          options: makeOptions(verse.simple, pool, random),
          answer: verse.simple,
          explanation: verse.text,
        });
        break;
      }
      case "oral": {
        questions.push({
          id,
          mode,
          verse,
          prompt: `${surahName} ${verse.ayah}\n${verse.text}`,
          options: [],
          answer: verse.simple,
          oralText: verse.simple,
        });
        break;
      }
      case "multiple": {
        questions.push({
          id,
          mode,
          verse,
          prompt: `اختر الآية التي من ${surahName} (الآية ${verse.ayah})`,
          options: makeOptions(verse.text, verses.map((v) => v.text), random),
          answer: verse.text,
          explanation: verse.text,
        });
        break;
      }
    }
  }
  return shuffle(questions, random).slice(0, count);
}

const SURAHS_NAMES = Array.from({ length: 114 }, (_, index) => getSurah(index + 1)!.name);

function sharedPrefix(a: string, prefix: string): number {
  const aWords = a.split(/\s+/);
  const bWords = prefix.split(/\s+/);
  let matched = 0;
  for (let i = 0; i < Math.min(aWords.length, bWords.length); i++) {
    if (aWords[i] === bWords[i]) matched++;
    else break;
  }
  return matched;
}

/** Progress towards the daily memorisation/review goal, streak and weekly bars. */
export function computeStreak(days: Array<{ day: string; completed: number }>, today = new Date()): number {
  const active = new Set(days.filter((day) => day.completed > 0).map((day) => day.day));
  const cursor = new Date(today);
  if (!active.has(day(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(day(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function day(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function weeklyBars(days: Array<{ day: string; completed: number }>, today = new Date()): number[] {
  const byDay = new Map(days.map((item) => [item.day, item.completed]));
  const result: number[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    result.push(byDay.get(day(date)) ?? 0);
  }
  return result;
}

export function monthlyTotal(days: Array<{ day: string; completed: number }>, today = new Date()): number {
  const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return days.filter((item) => item.day.startsWith(prefix)).reduce((sum, item) => sum + item.completed, 0);
}

export const QUIZ_MODES: Array<{ id: QuizMode; ar: string; en: string; idn: string; icon: string }> = [
  { id: "complete", ar: "أكمل الآية", en: "Complete the verse", idn: "Lengkapi ayat", icon: "sparkles" },
  { id: "next", ar: "الآية التالية", en: "Next verse", idn: "Ayat berikutnya", icon: "arrow-forward" },
  { id: "previous", ar: "الآية السابقة", en: "Previous verse", idn: "Ayat sebelumnya", icon: "arrow-back" },
  { id: "surah", ar: "في أي سورة؟", en: "Which surah?", idn: "Surah apa?", icon: "book" },
  { id: "missingWord", ar: "الكلمة الناقصة", en: "Missing word", idn: "Kata yang hilang", icon: "help" },
  { id: "order", ar: "رتّب الآيات", en: "Arrange verses", idn: "Susun ayat", icon: "list" },
  { id: "similar", ar: "الآيات المتشابهة", en: "Similar verses", idn: "Ayat mirip", icon: "copy" },
  { id: "oral", ar: "اختبار شفهي", en: "Oral test", idn: "Tes lisan", icon: "mic" },
  { id: "multiple", ar: "اختيار من متعدد", en: "Multiple choice", idn: "Pilihan ganda", icon: "checkmark" },
];
