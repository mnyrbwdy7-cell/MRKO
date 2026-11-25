import type { RecitationReport } from "./align";
import { normalizeArabic } from "./normalize";

export type TajweedRule = "harakat" | "madd" | "ghunnah" | "qalqalah" | "waqf" | "letters";
/** ASR cannot resolve phonemes, so tajweed output is always advisory. */
export type TajweedCertainty = "review";

export interface TajweedFinding {
  rule: TajweedRule;
  surah: number;
  ayah: number;
  word: string;
  detail: string;
  certainty: TajweedCertainty;
}

interface VerseInput {
  surah: number;
  ayah: number;
  text: string;
}

const CONFUSABLE_GROUPS = [
  new Set(["ض", "ظ"]),
  new Set(["س", "ص", "ث"]),
  new Set(["ح", "ه"]),
  new Set(["ذ", "ز", "ظ"]),
  new Set(["ق", "ك"]),
  new Set(["ع", "غ"]),
  new Set(["ب", "م"]),
];

function sameGroup(a: string, b: string): boolean {
  return CONFUSABLE_GROUPS.some((group) => group.has(a) && group.has(b));
}

function sample(words: string[]): string {
  return words.slice(0, 3).join(" ");
}

/**
 * Rule-based *review hints*. Speech recognition does not expose phonemes or
 * vowel marks, so no tajweed finding is presented as a confirmed error: every
 * item is explicitly labelled "يحتاج مراجعة" in the interface.
 */
export function analyzeTajweed(
  verses: VerseInput[],
  report: RecitationReport,
  pausesAtWordIndex: number[] = [],
): TajweedFinding[] {
  const findings: TajweedFinding[] = [];
  const pauseSet = new Set(pausesAtWordIndex);
  let globalIndex = 0;

  for (const verse of verses) {
    const wordsInVerse = verse.text.split(/\s+/).filter(Boolean);
    const buckets: Record<Exclude<TajweedRule, "letters">, string[]> = {
      harakat: [],
      madd: [],
      ghunnah: [],
      qalqalah: [],
      waqf: [],
    };

    wordsInVerse.forEach((word, index) => {
      if (/[َُِّْ]/.test(word)) buckets.harakat.push(word);
      if (/[ٓـٰ]/.test(word)) buckets.madd.push(word);
      if (/[من]ّ/.test(word)) buckets.ghunnah.push(word);
      if (/[قبطجد]ْ/.test(word)) buckets.qalqalah.push(word);
      if (pauseSet.has(globalIndex + index)) buckets.waqf.push(word);
    });
    globalIndex += wordsInVerse.length;

    const details: Record<Exclude<TajweedRule, "letters">, string> = {
      harakat: "راجع حركات التشكيل بالاستماع إلى التلاوة الصحيحة",
      madd: "راجع مقدار المدّ وصلة المد",
      ghunnah: "راجع الغنة في الحرف المشدد",
      qalqalah: "راجع القلقلة على الحرف الساكن",
      waqf: "راجع موضع الوقف؛ لا توقف في وسط الكلام",
    };
    (Object.keys(buckets) as Array<Exclude<TajweedRule, "letters">>).forEach((rule) => {
      if (!buckets[rule].length) return;
      findings.push({
        rule,
        surah: verse.surah,
        ayah: verse.ayah,
        word: sample(buckets[rule]),
        detail: details[rule],
        certainty: "review",
      });
    });
  }

  for (const mistake of report.mistakes) {
    if (mistake.status !== "substituted" || !mistake.actual) continue;
    const expectedWord = normalizeArabic(mistake.token.text);
    const actualWord = normalizeArabic(mistake.actual);
    for (let i = 0; i < Math.min(expectedWord.length, actualWord.length); i++) {
      if (expectedWord[i] !== actualWord[i] && sameGroup(expectedWord[i], actualWord[i])) {
        findings.push({
          rule: "letters",
          surah: mistake.token.surah,
          ayah: mistake.token.ayah,
          word: expectedWord,
          detail: `قد يكون نطق الحرف «${expectedWord[i]}» بدلاً من «${actualWord[i]}»؛ راجعه بالسمع`,
          certainty: "review",
        });
        break;
      }
    }
  }

  return findings;
}

export const TAJWEED_RULE_LABELS: Record<TajweedRule, { ar: string; en: string; id: string }> = {
  harakat: { ar: "الحركات والتشكيل", en: "Vowel marks", id: "Harakat" },
  madd: { ar: "المدود", en: "Long vowels", id: "Madd" },
  ghunnah: { ar: "الغنة", en: "Ghunnah", id: "Ghunnah" },
  qalqalah: { ar: "القلقلة", en: "Qalqalah", id: "Qalqalah" },
  waqf: { ar: "أحكام الوقف", en: "Stopping rules", id: "Waqf" },
  letters: { ar: "نطق الحروف", en: "Letter pronunciation", id: "Letter pronunciation" },
};
