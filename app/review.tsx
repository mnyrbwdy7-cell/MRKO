import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  completeReview,
  dayKey,
  getDailyGoal,
  getDueMistakes,
  listReviewDays,
  reviewMistake,
  setDailyGoal,
  type MistakeRow,
  type ReviewDayRow,
} from "@/db";
import { computeStreak, monthlyTotal, weeklyBars } from "@/quiz/generator";
import { arabicDigits } from "@/recitation/normalize";
import { requestReminderPermission } from "@/notifications/reminder";
import { useApp } from "@/state/AppContext";
import { BarChart, Button, Card, EmptyState, FONTS, Screen, SectionTitle, StatTile, TextBody, ToggleRow } from "@/components/ui";

export default function ReviewScreen() {
  const router = useRouter();
  const { t, locale, colors, settings, update, refresh } = useApp();
  const digits = locale === "ar" ? arabicDigits : (value: number) => String(value);
  const [goal, setGoal] = useState(settings.dailyGoal);
  const [days, setDays] = useState<ReviewDayRow[]>([]);
  const [due, setDue] = useState<MistakeRow[]>([]);
  const [reviewed, setReviewed] = useState(0);
  const [permission, setPermission] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const [goalValue, reviewDays, dueRows] = await Promise.all([getDailyGoal(), listReviewDays(), getDueMistakes()]);
    setGoal(goalValue);
    setDays(reviewDays);
    setDue(dueRows);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  const streak = computeStreak(days);
  const today = days.find((day) => day.day === dayKey())?.completed ?? 0;

  const submitReview = async (row: MistakeRow, correct: boolean) => {
    await reviewMistake(row.id, correct);
    await completeReview(1);
    setReviewed((value) => value + 1);
    refresh();
    void load();
  };

  return (
    <Screen>
      <View style={styles.statsRow}>
        <StatTile label={t("review.streak")} value={digits(streak)} icon="flame-outline" />
        <StatTile label={t("home.versesGoal")} value={`${digits(today)}/${digits(goal)}`} icon="checkmark-circle-outline" />
        <StatTile label={t("review.due")} value={digits(due.length)} icon="alert-circle-outline" />
      </View>

      <SectionTitle title={t("review.dailyGoal")} />
      <Card>
        <View style={styles.goalRow}>
          <Text style={[styles.goalValue, { color: colors.primary }]}>{digits(goal)}</Text>
          <View style={styles.stepper}>
            <Button title="−" variant="secondary" onPress={() => {
              const value = Math.max(1, goal - 1);
              setGoal(value);
              void setDailyGoal(value);
              void update("dailyGoal", value);
            }} style={styles.stepButton} />
            <Button title="+" variant="secondary" onPress={() => {
              const value = Math.min(100, goal + 1);
              setGoal(value);
              void setDailyGoal(value);
              void update("dailyGoal", value);
            }} style={styles.stepButton} />
          </View>
        </View>
      </Card>

      <SectionTitle title={t("review.reminder")} />
      <Card>
        <ToggleRow
          label={t("review.reminder")}
          value={settings.reminderEnabled}
          onValueChange={async (value) => {
            if (value) {
              const granted = await requestReminderPermission();
              setPermission(granted);
              if (!granted) return;
            }
            await update("reminderEnabled", value);
          }}
        />
        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, { color: colors.muted }]}>{t("review.reminderTime")}</Text>
          <TextInput
            value={settings.reminderTime}
            onChangeText={(value) => void update("reminderTime", value)}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            style={[styles.timeInput, { color: colors.text, borderColor: colors.border }]}
            accessibilityLabel={t("review.reminderTime")}
          />
        </View>
        {permission === false ? <TextBody style={{ color: colors.warning }}>{t("review.denied")}</TextBody> : null}
        <TextBody muted style={styles.hint}>{t("review.goalHint")}</TextBody>
      </Card>

      <SectionTitle title={t("review.reviewQueue")} />
      {due.length ? (
        due.map((row) => (
          <Card key={row.id}>
            <Text style={[styles.ref, { color: colors.primary }]}>{row.surah}:{digits(row.ayah)}</Text>
            <Text style={[styles.word, { color: colors.text }]}>{row.expected}</Text>
            <TextBody muted>{t("mistakes.spoken")}: {row.actual || "—"}</TextBody>
            <View style={styles.reviewButtons}>
              <Button title={t("mistakes.correct")} icon="checkmark" onPress={() => submitReview(row, true)} style={styles.reviewButton} />
              <Button title={t("mistakes.wrong")} icon="close" variant="danger" onPress={() => submitReview(row, false)} style={styles.reviewButton} />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState title={t("review.emptyQueue")} icon="sparkles-outline" />
      )}
      {reviewed > 0 ? <TextBody style={{ color: colors.success, textAlign: "center" }}>{t("review.done")}: {digits(reviewed)}</TextBody> : null}
      <Button title={t("quiz.title")} variant="secondary" icon="help-circle-outline" onPress={() => router.push("/quiz")} />

      <SectionTitle title={t("review.weekly")} />
      <Card>
        <BarChart values={weeklyBars(days)} labels={["1", "2", "3", "4", "5", "6", "7"]} color={colors.primary} />
      </Card>
      <SectionTitle title={t("review.monthly")} />
      <Card>
        <Text style={[styles.monthly, { color: colors.primary }]}>{digits(monthlyTotal(days))}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: "row", gap: 8 },
  goalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalValue: { fontFamily: FONTS.ui, fontSize: 32, fontWeight: "700" },
  stepper: { flexDirection: "row", gap: 8 },
  stepButton: { minWidth: 52, minHeight: 44, paddingHorizontal: 0 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  timeLabel: { fontFamily: FONTS.ui, fontSize: 14 },
  timeInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontFamily: FONTS.ui, width: 90, textAlign: "center" },
  hint: { fontSize: 11, marginTop: 10 },
  ref: { fontFamily: FONTS.ui, fontSize: 12, fontWeight: "700" },
  word: { fontFamily: FONTS.quran, fontSize: 23, marginVertical: 6 },
  reviewButtons: { flexDirection: "row", gap: 8, marginTop: 8 },
  reviewButton: { flex: 1, minHeight: 44 },
  monthly: { fontFamily: FONTS.ui, fontSize: 28, fontWeight: "700", textAlign: "center" },
});
