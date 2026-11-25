import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRecitation, matchedPrefix, buildExpected } from "./align";
import { normalizeArabic, similarity } from "./normalize";
import { analyzeTajweed } from "./tajweed";

const verses = [
  { surah: 1, ayah: 1, text: "بسم الله الرحمن الرحيم" },
  { surah: 1, ayah: 2, text: "الحمد لله رب العالمين" },
  { surah: 1, ayah: 3, text: "الرحمن الرحيم" },
];

test("normalization unifies Quranic orthography for matching", () => {
  assert.equal(normalizeArabic("بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"), "بسم الله الرحمن الرحيم");
  assert.ok(similarity("الرحمن", "مدرسة") < 0.4);
  assert.equal(normalizeArabic("ٱلْحَمْدُ لِلَّهِ"), "الحمد لله");
});

test("perfect recitation produces no mistakes", () => {
  const report = analyzeRecitation(verses, "بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم");
  assert.equal(report.accuracy, 1);
  assert.equal(report.mistakes.length, 0);
  assert.equal(report.ayat.length, 3);
});

test("a missing word is reported with a precise position", () => {
  const report = analyzeRecitation([verses[0]], "بسم الله الرحيم");
  const missing = report.mistakes.find((item) => item.status === "missing");
  assert.ok(missing);
  assert.equal(missing.token.text, "الرحمن");
  assert.equal(missing.token.index, 2);
  assert.equal(missing.certainty, "confirmed");
});

test("a substituted word is reported with the spoken word", () => {
  const report = analyzeRecitation([verses[0]], "بسم الله الرحمن العظيم");
  const substitute = report.mistakes.find((item) => item.status === "substituted");
  assert.ok(substitute);
  assert.equal(substitute.token.text, "الرحيم");
  assert.equal(substitute.actual, "العظيم");
});

test("skipping a whole ayah is detected separately from single missing words", () => {
  const report = analyzeRecitation(verses, "بسم الله الرحمن الرحيم الرحمن الرحيم");
  assert.deepEqual(report.skipped, [{ surah: 1, ayah: 2 }]);
  assert.ok(!report.mistakes.some((item) => item.status === "missing" && item.token.ayah === 2));
  assert.ok(report.mistakes.some((item) => item.status === "skipped_ayah"));
});

test("live progress reveals only words that were actually spoken", () => {
  const expected = buildExpected([verses[0]]).map((token) => token.text);
  assert.equal(matchedPrefix(expected, "بسم"), 1);
  assert.equal(matchedPrefix(expected, "بسم الله الرحمن"), 3);
  assert.equal(matchedPrefix(expected, "بسم الله الرحمن", 3), 3);
  assert.equal(matchedPrefix(expected, "بسم الله الرحمن الرحيم"), 4);
});

test("tajweed findings are advisory only", () => {
  const report = analyzeRecitation([verses[1]], "الحمد لله رب العالمين");
  const findings = analyzeTajweed([{ surah: 2, ayah: 1, text: "لَقَدْ صَدَقَ اللَّهُ آمَنَّا" }], report, [0]);
  assert.ok(findings.some((finding) => finding.rule === "qalqalah"));
  assert.ok(findings.some((finding) => finding.rule === "ghunnah"));
  assert.ok(findings.some((finding) => finding.rule === "waqf"));
  assert.ok(findings.every((finding) => finding.certainty === "review"));
});
