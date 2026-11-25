import assert from "node:assert/strict";
import test from "node:test";
import { computeStreak, day, generateQuestions, monthlyTotal, weeklyBars, type QuizMode } from "./generator";

const modes: QuizMode[] = ["complete", "next", "previous", "surah", "missingWord", "order", "similar", "oral", "multiple"];

test("every quiz mode generates answerable questions from memorised surahs only", () => {
  for (const mode of modes) {
    const questions = generateQuestions(mode, [1, 2], 5, 42);
    assert.equal(questions.length, 5, mode);
    for (const question of questions) {
      assert.ok(question.prompt.length > 0, mode);
      assert.ok(question.answer.length > 0, mode);
      assert.ok([1, 2].includes(question.verse.surah), mode);
      if (mode !== "oral" && mode !== "order") {
        assert.ok(question.options.includes(question.answer), `${mode}: correct answer must be among options`);
      }
      if (mode === "order") assert.equal(question.orderedKeys?.length, 3);
    }
  }
});

test("no questions when no surah was memorised", () => {
  assert.deepEqual(generateQuestions("complete", [], 5, 1), []);
});

test("streak, weekly and monthly stats count only days with activity", () => {
  const today = new Date("2026-11-24T12:00:00Z");
  const days = [
    { day: day(today), completed: 3 },
    { day: "2026-11-23", completed: 2 },
    { day: "2026-11-22", completed: 1 },
    { day: "2026-11-20", completed: 4 },
    { day: "2026-10-31", completed: 7 },
  ];
  assert.equal(computeStreak(days, today), 3);
  assert.deepEqual(weeklyBars(days, today), [0, 0, 4, 0, 1, 2, 3]);
  assert.equal(monthlyTotal(days, today), 10);
});
