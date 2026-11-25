import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getMemorization, listQuizResults, listRecitations, listReviewDays } from "@/db";
import { ALL_VERSES, SURAHS } from "@/data/quran";
import { computeStreak, monthlyTotal, weeklyBars } from "@/quiz/generator";
import { arabicDigits } from "@/recitation/normalize";
import { useApp } from "@/state/AppContext";
import { BarChart, Card, FONTS, Screen, SectionTitle, StatTile, TextBody } from "@/components/ui";

export default function StatsScreen() {
  const { t, locale, colors } = useApp();
  const digits = locale === "ar" ? arabicDigits : (value: number) => String(value);
  const [memorization, setMemorization] = useState<Record<string, string>>({});
  const [recitations, setRecitations] = useState<number>(0);
  const [average, setAverage] = useState(0);
  const [quizPoints, setQuizPoints] = useState(0);
  const [days, setDays] = useState<Array<{ day: string; completed: number }>>([]);

  const load = useCallback(async () => {
    const [mem, recs, quizzes, reviewDays] = await Promise.all([
      getMemorization(), listRecitations(500), listQuizResults(500), listReviewDays(),
    ]);
    setMemorization(mem as Record<string, string>);
    setRecitations(recs.length);
    setAverage(recs.length ? recs.reduce((sum, row) => sum + row.accuracy, 0) / recs.length : 0);
    setQuizPoints(quizzes.reduce((sum, row) => sum + row.score, 0));
    setDays(reviewDays);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  const memorizedCount = Object.values(memorization).filter((status) => status === "mastered").length;
  const topSurahs = SURAHS.map((surah) => {
    let count = 0;
    for (let ayah = 1; ayah <= surah.verses; ayah++) if (memorization[`${surah.id}:${ayah}`] === "mastered") count++;
    return { name: surah.name, ratio: count / surah.verses, count };
  }).filter((item) => item.count > 0).sort((a, b) => b.ratio - a.ratio).slice(0, 7);

  const juzBars = Array.from({ length: 10 }, (_, index) => {
    const start = index * 3 + 1;
    return ALL_VERSES.filter((verse) => verse.juz >= start && verse.juz <= start + 2 && memorization[`${verse.surah}:${verse.ayah}`] === "mastered").length;
  });

  return (
    <Screen>
      <View style={styles.statsRow}>
        <StatTile label={t("stats.memorizedVerses")} value={digits(memorizedCount)} icon="book-outline" />
        <StatTile label={t("stats.recitationSessions")} value={digits(recitations)} icon="mic-outline" />
      </View>
      <View style={styles.statsRow}>
        <StatTile label={t("stats.averageAccuracy")} value={`${digits(Math.round(average * 100))}%`} icon="trending-up-outline" />
        <StatTile label={t("stats.quizScore")} value={digits(quizPoints)} icon="star-outline" />
      </View>

      <SectionTitle title={t("review.streak")} />
      <Card><Text style={[styles.big, { color: colors.primary }]}>{digits(computeStreak(days))}</Text></Card>

      <SectionTitle title={t("stats.weeklyActivity")} />
      <Card><BarChart values={weeklyBars(days)} color={colors.gold} /></Card>

      <SectionTitle title={t("stats.memorizationBySurah")} />
      <Card>
        {topSurahs.length ? topSurahs.map((item) => (
          <View key={item.name} style={styles.barRow}>
            <Text style={[styles.barLabel, { color: colors.text }]}>{item.name}</Text>
            <View style={[styles.track, { backgroundColor: colors.border }]}>
              <View style={[styles.fill, { backgroundColor: colors.primary, width: `${item.ratio * 100}%` }]} />
            </View>
            <Text style={[styles.barValue, { color: colors.muted }]}>{digits(Math.round(item.ratio * 100))}%</Text>
          </View>
        )) : <Text style={{ color: colors.muted, fontFamily: FONTS.ui }}>{t("common.none")}</Text>}
      </Card>

      <SectionTitle title={t("stats.byJuz")} />
      <Card><BarChart values={juzBars} color={colors.primary} /></Card>
      <TextBody muted style={styles.monthly}>{t("stats.monthlyActivity")}: {digits(monthlyTotal(days))}</TextBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: "row", gap: 8 },
  big: { fontFamily: FONTS.ui, fontSize: 30, fontWeight: "700", textAlign: "center" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  barLabel: { fontFamily: FONTS.ui, fontSize: 12, width: 70 },
  track: { flex: 1, height: 8, borderRadius: 4 },
  fill: { height: 8, borderRadius: 4 },
  barValue: { fontFamily: FONTS.ui, fontSize: 11, width: 38, textAlign: "right" },
  monthly: { textAlign: "center", marginTop: 8 },
});
