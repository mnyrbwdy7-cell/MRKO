import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { countActiveMistakes, getDailyGoal, listRecitations, listReviewDays, getMemorization, dayKey } from "@/db";
import { computeStreak, weeklyBars } from "@/quiz/generator";
import { useApp } from "@/state/AppContext";
import { arabicDigits } from "@/recitation/normalize";
import { BarChart, Button, Card, FONTS, ProgressRing, Screen, SectionTitle, TextBody } from "@/components/ui";

export default function HomeScreen() {
  const router = useRouter();
  const { t, locale, colors, settings, refreshKey } = useApp();
  const [stats, setStats] = useState({ memorized: 0, mistakes: 0, recitations: 0, streak: 0, goal: 5, today: 0 });
  const [weekly, setWeekly] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  const load = useCallback(async () => {
    try {
      const [memorization, mistakes, recitations, reviewDays, goal] = await Promise.all([
        getMemorization(),
        countActiveMistakes(),
        listRecitations(1),
        listReviewDays(),
        getDailyGoal(),
      ]);
      setStats({
        memorized: Object.values(memorization).filter((status) => status !== "learning").length,
        mistakes,
        recitations: recitations.length,
        streak: computeStreak(reviewDays),
        goal,
        today: reviewDays.find((day) => day.day === dayKey())?.completed ?? 0,
      });
      setWeekly(weeklyBars(reviewDays));
    } catch {
      // The home screen still renders with zeroed stats if storage is unavailable.
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    void load();
  }, [load, refreshKey, settings.dailyGoal]);

  const actions: Array<{ key: string; label: string; icon: keyof typeof Ionicons.glyphMap; route: string; color: string }> = [
    { key: "follow", label: t("home.followMemorization"), icon: "trending-up-outline", route: "/map", color: colors.primary },
    { key: "recite", label: t("home.startRecitation"), icon: "mic-outline", route: "/recite", color: colors.primary },
    { key: "quiz", label: t("home.testMemory"), icon: "help-circle-outline", route: "/quiz", color: colors.gold },
    { key: "mistakes", label: t("home.myMistakes"), icon: "alert-circle-outline", route: "/mistakes", color: colors.danger },
    { key: "map", label: t("home.memorizedMap"), icon: "grid-outline", route: "/map", color: colors.primary },
    { key: "review", label: t("home.dailyReview"), icon: "calendar-outline", route: "/review", color: colors.gold },
    { key: "history", label: t("home.recitationLog"), icon: "time-outline", route: "/history", color: colors.muted },
    { key: "stats", label: t("home.progressStats"), icon: "bar-chart-outline", route: "/stats", color: colors.primary },
  ];

  return (
    <Screen>
      <View style={[styles.hero, { backgroundColor: colors.primaryDeep }]}>
        <View style={styles.heroTop}>
          <View style={styles.logoCircle}>
            <Ionicons name="moon" size={26} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.onPrimary }]}>{t("home.greeting")}</Text>
            <Text style={[styles.tagline, { color: colors.gold }]}>{t("home.tagline")}</Text>
          </View>
        </View>
        <View style={styles.heroBottom}>
          <ProgressRing value={stats.goal ? Math.min(1, stats.today / stats.goal) : 0} label={t("home.versesGoal")} size={96} />
          <View style={styles.heroStats}>
            <HeroStat icon="flame-outline" value={arabicDigits(stats.streak)} label={t("home.streak")} color={colors.gold} />
            <HeroStat icon="checkmark-circle-outline" value={arabicDigits(stats.memorized)} label={t("home.memorized")} color={colors.onPrimary} />
            <HeroStat icon="alert-circle-outline" value={arabicDigits(stats.mistakes)} label={t("home.reviewsDue")} color={colors.onPrimary} />
          </View>
        </View>
      </View>

      <SectionTitle title={t("home.quickActions")} />
      <View style={styles.actionsGrid}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => router.push(action.route as never)}
            android_ripple={{ color: colors.surfaceAlt }}
            style={[styles.action, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name={action.icon} size={24} color={action.color} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle title={t("stats.weeklyActivity")} action={t("common.more")} onAction={() => router.push("/stats")} />
      <Card>
        <BarChart values={weekly} labels={["1", "2", "3", "4", "5", "6", "7"]} color={colors.gold} />
        <TextBody muted style={styles.weeklyNote}>
          {locale === "ar" ? "آخر ٧ أيام" : locale === "id" ? "7 hari terakhir" : "Last 7 days"}
        </TextBody>
      </Card>

      <Button title={t("home.startRecitation")} icon="mic" onPress={() => router.push("/recite")} style={styles.cta} />
      <TextBody muted style={styles.footer}>{t("settings.dataLocal")}</TextBody>
    </Screen>
  );
}

function HeroStat({ icon, value, label, color }: { icon: keyof typeof Ionicons.glyphMap; value: string; label: string; color: string }) {
  return (
    <View style={styles.heroStat}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.heroStatValue, { color }]}>{value}</Text>
      <Text style={[styles.heroStatLabel, { color: "#CFE0D4" }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 22, padding: 18, marginBottom: 6 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.09)" },
  greeting: { fontFamily: FONTS.ui, fontSize: 16, fontWeight: "700" },
  tagline: { fontFamily: FONTS.ui, fontSize: 12, marginTop: 3 },
  heroBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, gap: 10 },
  heroStats: { flex: 1, gap: 8 },
  heroStat: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroStatValue: { fontFamily: FONTS.ui, fontWeight: "700", fontSize: 16, minWidth: 32 },
  heroStatLabel: { fontFamily: FONTS.ui, fontSize: 12, flex: 1 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  action: { width: "48%", borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 10, minHeight: 96, justifyContent: "center" },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  actionLabel: { fontFamily: FONTS.ui, fontSize: 13, fontWeight: "700" },
  weeklyNote: { textAlign: "center", marginTop: 8, fontSize: 11 },
  cta: { marginTop: 14 },
  footer: { textAlign: "center", marginTop: 16, fontSize: 11 },
});
