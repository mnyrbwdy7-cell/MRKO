import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { addQuizResult, completeReview } from "@/db";
import { getVerseByKey } from "@/data/quran";
import { arabicDigits } from "@/recitation/normalize";
import { analyzeRecitation } from "@/recitation/align";
import { checkSpeechCapabilities, useSpeech, type SpeechCapabilities } from "@/asr/useSpeech";
import { generateQuestions, type QuizMode, type Question } from "@/quiz/generator";
import { useApp } from "@/state/AppContext";
import { Button, Card, EmptyState, FONTS, ProgressRing, Screen, TextBody } from "@/components/ui";

export default function QuizSession() {
  const { mode } = useLocalSearchParams<{ mode: QuizMode }>();
  const { t, locale, colors, settings, refresh } = useApp();
  const digits = locale === "ar" ? arabicDigits : (value: number) => String(value);
  const [seed, setSeed] = useState(() => Date.now());
  const questions = useMemo(
    () => generateQuestions((mode ?? "complete") as QuizMode, settings.quizSurahs, 10, seed),
    [mode, settings.quizSurahs, seed],
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [oralTranscript, setOralTranscript] = useState("");
  const [caps, setCaps] = useState<SpeechCapabilities | null>(null);
  const [oralError, setOralError] = useState<string | null>(null);

  const speech = useSpeech({
    onTranscript: (text) => setOralTranscript(text),
    onError: (code, message) => setOralError(`${code}: ${message}`),
  });

  useEffect(() => {
    void checkSpeechCapabilities().then(setCaps);
  }, []);

  const question: Question | undefined = questions[index];
  useEffect(() => {
    if (question?.orderedKeys) setOrder([...question.orderedKeys].reverse());
    setSelected(null);
    setOralTranscript("");
    setOralError(null);
  }, [question]);

  const submit = useCallback((correct: boolean, choice?: string) => {
    if (selected !== null) return;
    if (choice) setSelected(choice);
    setAnswers((current) => [...current, correct]);
  }, [selected]);

  const next = async () => {
    if (index + 1 >= questions.length) {
      await addQuizResult(String(mode), answers.filter(Boolean).length, questions.length);
      await completeReview(answers.filter(Boolean).length);
      refresh();
      setDone(true);
      return;
    }
    setIndex((value) => value + 1);
  };

  const evaluateOral = () => {
    if (!question) return;
    speech.stop();
    const result = analyzeRecitation(
      [{ surah: question.verse.surah, ayah: question.verse.ayah, text: question.verse.simple }],
      oralTranscript,
    );
    submit(result.accuracy >= 0.8);
  };

  if (!questions.length) return <Screen><EmptyState title={t("quiz.noSources")} icon="alert-circle-outline" /></Screen>;

  if (done || index >= questions.length) {
    const score = answers.filter(Boolean).length;
    return (
      <Screen>
        <Card style={{ alignItems: "center", padding: 24 }}>
          <ProgressRing value={score / questions.length} size={130} label={t("quiz.score")} />
          <Text style={[styles.resultTitle, { color: colors.text }]}>{t("quiz.resultTitle")}</Text>
          <Text style={[styles.resultScore, { color: colors.primary }]}>
            {digits(score)} / {digits(questions.length)}
          </Text>
        </Card>
        <Button title={t("quiz.repeat")} icon="refresh-outline" onPress={() => {
          setSeed(Date.now());
          setIndex(0);
          setAnswers([]);
          setDone(false);
        }} />
      </Screen>
    );
  }

  const isOrder = question.mode === "order";
  const isOral = question.mode === "oral";
  const hasOptions = question.options.length > 0 && !isOrder && !isOral;
  const answered = answers.length > index;

  return (
    <Screen>
      <View style={styles.progressRow}>
        <Text style={[styles.progressText, { color: colors.muted }]}>{t("quiz.question")} {digits(index + 1)} {t("quiz.of")} {digits(questions.length)}</Text>
        <Text style={[styles.progressText, { color: colors.primary }]}>{t("quiz.score")}: {digits(answers.filter(Boolean).length)}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.gold, width: `${((index + 1) / questions.length) * 100}%` }]} />
      </View>

      <Card>
        <Text style={[styles.prompt, { color: colors.text }]}>{question.prompt}</Text>
      </Card>

      {hasOptions ? (
        <View>
          {question.options.map((option, optionIndex) => {
            const isAnswer = option === question.answer;
            const isChosen = selected === option;
            const state = answered ? (isAnswer ? styles.correct : isChosen ? styles.incorrect : styles.neutral) : styles.neutral;
            return (
              <Pressable
                key={`${optionIndex}-${option.slice(0, 8)}`}
                onPress={() => submit(isAnswer, option)}
                disabled={answered}
                style={[styles.option, state, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                {answered && isAnswer ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {isOrder ? (
        <Card>
          <TextBody muted>{t("quiz.arrangePrompt")}</TextBody>
          {order.map((key, position) => {
            const verse = getVerseByKey(key);
            return (
              <View key={key} style={[styles.orderRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.orderText, { color: colors.text, flex: 1 }]}>{verse?.text ?? key}</Text>
                <Pressable onPress={() => move(order, setOrder, position, -1)} disabled={answered} hitSlop={8}><Ionicons name="arrow-up" size={20} color={colors.primary} /></Pressable>
                <Pressable onPress={() => move(order, setOrder, position, 1)} disabled={answered} hitSlop={8}><Ionicons name="arrow-down" size={20} color={colors.primary} /></Pressable>
              </View>
            );
          })}
          {!answered ? (
            <Button title={t("common.confirm")} onPress={() => submit(order.join("|") === question.answer)} />
          ) : null}
        </Card>
      ) : null}

      {isOral ? (
        <Card>
          <TextBody muted>{t("quiz.oralPrompt")}</TextBody>
          {caps && (settings.offlineOnly ? caps.onDevice || caps.arabicInstalled : caps.available) ? (
            <>
              <Button
                title={speech.listening ? t("common.stop") : t("recite.start")}
                icon="mic-outline"
                onPress={() => {
                  if (speech.listening) evaluateOral();
                  else {
                    setOralTranscript("");
                    void speech.start({
                      offlineOnly: settings.offlineOnly,
                      saveAudio: false,
                      context: [question.verse.simple.split(/\s+/).slice(0, 5).join(" ")],
                    });
                  }
                }}
              />
              {oralTranscript ? <TextBody muted style={styles.transcript}>{oralTranscript}</TextBody> : null}
              {oralError ? <TextBody style={{ color: colors.danger }}>{oralError}</TextBody> : null}
              {!answered ? (
                <Button title={t("common.confirm")} variant="secondary" onPress={evaluateOral} />
              ) : null}
            </>
          ) : (
            <TextBody style={{ color: colors.warning }}>{t("recite.offlineBlocked")}</TextBody>
          )}
        </Card>
      ) : null}

      {answered ? (
        <View>
          <Text style={{ color: answers[index] ? colors.success : colors.danger, fontFamily: FONTS.ui, fontWeight: "700", textAlign: "center", marginBottom: 10 }}>
            {answers[index] ? t("quiz.correct") : t("quiz.incorrect")}
          </Text>
          {!answers[index] ? <TextBody muted style={styles.answerLine}>{t("quiz.correctAnswer")}: {question.answer}</TextBody> : null}
          {question.explanation ? <Text style={[styles.explanation, { color: colors.text }]}>{question.explanation}</Text> : null}
          <Button title={t("common.next")} onPress={next} />
        </View>
      ) : null}
    </Screen>
  );
}

function move(order: string[], setOrder: (value: string[]) => void, position: number, delta: number) {
  const target = position + delta;
  if (target < 0 || target >= order.length) return;
  const next = [...order];
  [next[position], next[target]] = [next[target], next[position]];
  setOrder(next);
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressText: { fontFamily: FONTS.ui, fontSize: 12 },
  progressTrack: { height: 6, borderRadius: 3, marginBottom: 16 },
  progressFill: { height: 6, borderRadius: 3 },
  prompt: { fontFamily: FONTS.quran, fontSize: 22, lineHeight: 38 },
  option: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  optionText: { fontFamily: FONTS.quran, fontSize: 19, flex: 1, lineHeight: 30 },
  correct: { borderColor: "#2E7D5B" },
  incorrect: { borderColor: "#B4473D" },
  neutral: {},
  orderRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  orderText: { fontFamily: FONTS.quran, fontSize: 18, lineHeight: 30 },
  transcript: { fontSize: 12, marginTop: 10 },
  answerLine: { textAlign: "center", marginBottom: 8 },
  explanation: { fontFamily: FONTS.quran, fontSize: 20, textAlign: "center", marginBottom: 14, lineHeight: 34 },
  resultTitle: { fontFamily: FONTS.ui, fontSize: 20, fontWeight: "700", textAlign: "center", marginTop: 14 },
  resultScore: { fontFamily: FONTS.ui, fontSize: 26, fontWeight: "700", marginBottom: 10 },
});
