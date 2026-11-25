import raw from "../../assets/data/quran.json";
import { normalizeArabic, normalizeForSearch } from "@/recitation/normalize";

export interface Surah {
  id: number;
  name: string;
  en: string;
  type: "meccan" | "medinan";
  verses: number;
  page: number;
  juz: number;
}

export interface Verse {
  surah: number;
  ayah: number;
  page: number;
  juz: number;
  /** Uthmani rasm exactly as published by api.quran.com — never modified. */
  text: string;
  /** Unvocalised Tanzil text, used only for speech matching and search. */
  simple: string;
  en: string;
  id: string;
}

type VerseRow = [number, number, string, string, string, string];

interface QuranFile {
  version: number;
  meta: Record<string, unknown> & {
    riwaya: string;
    mushaf: string;
    textSource: string;
    fetched: string;
    translations: Record<string, string>;
  };
  surahs: Surah[];
  verses: VerseRow[][];
}

const data = raw as unknown as QuranFile;

export const QURAN_META = data.meta;
export const SURAHS: Surah[] = data.surahs;

export const VERSES_BY_SURAH: Verse[][] = data.verses.map((rows, surahIndex) =>
  rows.map((row, index) => ({
    surah: surahIndex + 1,
    ayah: index + 1,
    page: row[0],
    juz: row[1],
    text: row[2],
    simple: row[3],
    en: row[4],
    id: row[5],
  })),
);

export const ALL_VERSES: Verse[] = VERSES_BY_SURAH.flat();
export const TOTAL_VERSES = ALL_VERSES.length;
export const TOTAL_PAGES = 604;
export const TOTAL_JUZ = 30;

const FLAT_INDEX = new Map<number, number>();
ALL_VERSES.forEach((verse, index) => FLAT_INDEX.set(verse.surah * 1000 + verse.ayah, index));

export function verseKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

export function getSurah(surah: number): Surah | undefined {
  return SURAHS[surah - 1];
}

export function getVerse(surah: number, ayah: number): Verse | undefined {
  const index = FLAT_INDEX.get(surah * 1000 + ayah);
  return index === undefined ? undefined : ALL_VERSES[index];
}

export function getVerseByKey(key: string): Verse | undefined {
  const [s, a] = key.split(":").map(Number);
  return getVerse(s, a);
}

export function getVerses(surah: number, from = 1, to?: number): Verse[] {
  const list = VERSES_BY_SURAH[surah - 1] ?? [];
  return list.slice(from - 1, to ?? list.length);
}

export function nextVerse(verse: Verse): Verse | undefined {
  const index = FLAT_INDEX.get(verse.surah * 1000 + verse.ayah);
  return index === undefined ? undefined : ALL_VERSES[index + 1];
}

export function previousVerse(verse: Verse): Verse | undefined {
  const index = FLAT_INDEX.get(verse.surah * 1000 + verse.ayah);
  return index === undefined ? undefined : ALL_VERSES[index - 1];
}

export function getVersesByPage(page: number): Verse[] {
  return ALL_VERSES.filter((verse) => verse.page === page);
}

export function getVersesByJuz(juz: number): Verse[] {
  return ALL_VERSES.filter((verse) => verse.juz === juz);
}

export interface SearchResult {
  verse: Verse;
  score: number;
}

/** Offline search across all 6,236 ayat and the 114 surah names. */
export function searchQuran(query: string, limit = 40): SearchResult[] {
  const q = normalizeForSearch(query);
  if (!q) return [];
  const terms = q.split(" ");
  const results: SearchResult[] = [];

  for (const verse of ALL_VERSES) {
    const text = normalizeForSearch(verse.simple);
    if (!terms.every((term) => text.includes(term))) continue;
    const score = text === q ? 0 : text.includes(q) ? 1 : 2 + text.length / 1000;
    results.push({ verse, score });
  }
  for (const surah of SURAHS) {
    if (normalizeForSearch(surah.name).includes(q) || surah.en.toLowerCase().includes(q.toLowerCase())) {
      results.push({ verse: getVerse(surah.id, 1)!, score: -1 });
    }
  }
  results.sort((a, b) => a.score - b.score);
  return results.slice(0, limit);
}

/** Normalized tokens of an ayah for the recitation matcher. */
export function verseWords(verse: Verse): string[] {
  return normalizeArabic(verse.simple).split(" ").filter(Boolean);
}
