import { normalizeArabic, similarity, words } from "./normalize";

export type MistakeKind = "missing" | "substituted" | "extra" | "skipped_ayah";
export type Certainty = "confirmed" | "review";

export interface ExpectedToken {
  surah: number;
  ayah: number;
  index: number;
  text: string;
}

export interface AlignedWord {
  token: ExpectedToken;
  actual: string | null;
  status: "match" | MistakeKind;
  score: number;
  certainty: Certainty;
}

export interface AyahResult {
  surah: number;
  ayah: number;
  words: AlignedWord[];
  status: "clean" | "errors" | "skipped";
  accuracy: number;
}

export interface RecitationReport {
  ayat: AyahResult[];
  mistakes: AlignedWord[];
  skipped: Array<{ surah: number; ayah: number }>;
  transcript: string[];
  totalWords: number;
  matchedWords: number;
  accuracy: number;
}

export function buildExpected(input: Array<{ surah: number; ayah: number; text: string }>): ExpectedToken[] {
  const tokens: ExpectedToken[] = [];
  for (const verse of input) {
    normalizeArabic(verse.text)
      .split(" ")
      .filter(Boolean)
      .forEach((text, index) => tokens.push({ surah: verse.surah, ayah: verse.ayah, index, text }));
  }
  return tokens;
}

interface Operation {
  type: "match" | "missing" | "substituted" | "extra";
  expectedIndex: number;
  actualIndex: number;
}

/**
 * Global alignment (Needleman–Wunsch). A substitution is penalised more than a
 * single gap but less than a gap plus an insertion: a genuinely misread word
 * stays one substitution, while a missing word followed by a correct word is
 * reported as a deletion.
 */
export function alignTokens(expected: string[], actual: string[]): Operation[] {
  const n = expected.length;
  const m = actual.length;
  const gap = -1.6;
  const score = (i: number, j: number) => {
    const s = similarity(expected[i], actual[j]);
    return s >= 0.999 ? 2 : -(1.8 + (1 - s) * 0.4);
  };
  const dp = new Float64Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = 1; i <= n; i++) dp[at(i, 0)] = dp[at(i - 1, 0)] + gap;
  for (let j = 1; j <= m; j++) dp[at(0, j)] = dp[at(0, j - 1)] + gap;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[at(i, j)] = Math.max(
        dp[at(i - 1, j - 1)] + score(i - 1, j - 1),
        dp[at(i - 1, j)] + gap,
        dp[at(i, j - 1)] + gap,
      );
    }
  }
  const operations: Operation[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const current = dp[at(i, j)];
    const diagonal = i > 0 && j > 0 ? dp[at(i - 1, j - 1)] + score(i - 1, j - 1) : Number.NEGATIVE_INFINITY;
    const upwards = i > 0 ? dp[at(i - 1, j)] + gap : Number.NEGATIVE_INFINITY;
    if (current >= diagonal - 1e-9 && diagonal >= upwards - 1e-9) {
      const exact = similarity(expected[i - 1], actual[j - 1]) >= 0.999;
      operations.push({ type: exact ? "match" : "substituted", expectedIndex: i - 1, actualIndex: j - 1 });
      i--;
      j--;
    } else if (current >= upwards - 1e-9) {
      operations.push({ type: "missing", expectedIndex: i - 1, actualIndex: -1 });
      i--;
    } else {
      operations.push({ type: "extra", expectedIndex: -1, actualIndex: j - 1 });
      j--;
    }
  }
  return operations.reverse();
}

export function analyzeRecitation(
  verses: Array<{ surah: number; ayah: number; text: string }>,
  transcript: string,
): RecitationReport {
  const expected = buildExpected(verses);
  const actual = words(transcript);
  const operations = alignTokens(expected.map((token) => token.text), actual);

  const aligned: AlignedWord[] = operations
    .filter((op) => op.expectedIndex >= 0)
    .map((op) => {
      const token = expected[op.expectedIndex];
      const spoken = op.actualIndex >= 0 ? actual[op.actualIndex] : null;
      const score = spoken === null ? 0 : similarity(token.text, spoken);
      const certainty: Certainty =
        op.type === "missing" || (op.type === "substituted" && score >= 0.45 && token.text.length >= 2)
          ? "confirmed"
          : "review";
      return {
        token,
        actual: spoken,
        status: op.type === "match" ? "match" : op.type,
        score,
        certainty,
      };
    });

  // A whole ayah absent while later ayat were recognised is a skip, not a
  // collection of unrelated missing words.
  const skipped: Array<{ surah: number; ayah: number }> = [];
  const ayahWords = new Map<string, AlignedWord[]>();
  for (const word of aligned) {
    const key = `${word.token.surah}:${word.token.ayah}`;
    const list = ayahWords.get(key) ?? [];
    list.push(word);
    ayahWords.set(key, list);
  }
  for (const verse of verses) {
    const list = ayahWords.get(`${verse.surah}:${verse.ayah}`) ?? [];
    const hasRecognition = list.some((word) => word.status === "match" || word.status === "substituted");
    if (list.length >= 2 && !hasRecognition) {
      const laterRecognized = verses.some(
        (other) => other.ayah > verse.ayah && (ayahWords.get(`${other.surah}:${other.ayah}`) ?? []).some((w) => w.status === "match"),
      );
      if (laterRecognized) skipped.push({ surah: verse.surah, ayah: verse.ayah });
    }
  }
  const skippedKeys = new Set(skipped.map((item) => `${item.surah}:${item.ayah}`));
  for (const word of aligned) {
    if (skippedKeys.has(`${word.token.surah}:${word.token.ayah}`) && word.status === "missing") {
      word.status = "skipped_ayah";
    }
  }

  const ayat: AyahResult[] = verses.map((verse) => {
    const list = ayahWords.get(`${verse.surah}:${verse.ayah}`) ?? [];
    const matched = list.filter((word) => word.status === "match").length;
    return {
      surah: verse.surah,
      ayah: verse.ayah,
      words: list,
      status: skippedKeys.has(`${verse.surah}:${verse.ayah}`)
        ? "skipped"
        : list.some((word) => word.status === "match" || word.status === "substituted") && matched < list.length
          ? "errors"
          : matched === list.length && list.length > 0
            ? "clean"
            : "errors",
      accuracy: list.length ? matched / list.length : 0,
    };
  });

  const mistakes = aligned.filter((word) => word.status !== "match");
  const matchedWords = aligned.filter((word) => word.status === "match").length;
  return {
    ayat,
    mistakes,
    skipped,
    transcript: actual,
    totalWords: expected.length,
    matchedWords,
    accuracy: expected.length ? matchedWords / expected.length : 0,
  };
}

/**
 * Live progress: only words the reader has actually spoken are returned. The
 * UI never renders the following word until it appears in a recognition event.
 */
export function matchedPrefix(expected: string[], transcript: string, alreadyMatched = 0): number {
  const spoken = words(transcript);
  let pointer = Math.max(0, Math.min(alreadyMatched, expected.length));
  for (const token of spoken) {
    if (pointer >= expected.length) break;
    const current = similarity(token, expected[pointer]);
    if (current >= 0.75) {
      pointer++;
      continue;
    }
    // A clearly recognised next word means the current one was skipped; do not
    // reveal it as "read" — the final report will record the omission.
    if (pointer + 1 < expected.length && similarity(token, expected[pointer + 1]) >= 0.88) pointer += 2;
  }
  return pointer;
}

export function hintFor(tokens: ExpectedToken[], position: number): string | null {
  return tokens[position]?.text ?? null;
}
