/**
 * Arabic text utilities shared by the mushaf search and the recitation matcher.
 * These functions are deliberately free of React Native imports so they can be
 * unit-tested with plain Node.
 */

const TASHKEEL = /[\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08E1]/g;
const TATWEEL = /\u0640/g;
const PUNCTUATION = /[.,!?؟؛:،؛"'`()\[\]{}«»‹›\/\\|_\-–—*#&%$^~=+<>]/g;

/** Aggressive normalization used only for speech matching / search, never for display. */
export function normalizeArabic(input: string): string {
  return input
    .replace(TASHKEEL, "")
    .replace(TATWEEL, "")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0622\u0623\u0625\u0671\u0649]/g, "ا")
    .replace(/ٰ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lighter normalization: keeps hamza distinctions for dictionary-style search. */
export function normalizeForSearch(input: string): string {
  return input
    .replace(TASHKEEL, "")
    .replace(TATWEEL, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "ا")
    .replace(/ٰ/g, "ا")
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function words(text: string): string[] {
  const normalized = normalizeArabic(text);
  return normalized ? normalized.split(" ") : [];
}

/** Character-level Levenshtein distance. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Similarity in [0, 1]; 1 means an exact match after normalization. */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}

/** Strip diacritics while keeping the Uthmani rasm for tajweed rules. */
export function stripTashkeel(input: string): string {
  return input.replace(TASHKEEL, "").replace(TATWEEL, "");
}

/** Format a number using Arabic-Indic digits. */
export function arabicDigits(value: number): string {
  return String(value).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}
