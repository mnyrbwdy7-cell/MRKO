import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { clearSurahMemorization, getMemorization, setSurahMemorization, type MemorizationStatus } from "@/db";
import { ALL_VERSES, SURAHS, TOTAL_JUZ, TOTAL_PAGES } from "@/data/quran";
import { useApp } from "@/state/AppContext";
import { arabicDigits as ad } from "@/recitation/normalize";
import { Card, Chip, FONTS, ProgressRing, Screen, TextBody } from "@/components/ui";

type Mode = "surah" | "juz" | "page";

export default function MapScreen() {
  const router = useRouter();
  const { t, locale, colors, settings, update, refresh } = useApp();
  const digits = locale === "ar" ? ad : (value: number) => String(value);
  const [mode, setMode] = useState<Mode>("surah");
  const [memorized, setMemorized] = useState<Record<string, MemorizationStatus>>({});

  const load = useCallback(async () => {
    const rows = await getMemorization();
    setMemorized(rows as Record<string, MemorizationStatus>);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const surahStatuses = useMemo(() => {
    const result: Record<number, "mastered" | "review" | "learning" | "unseen"> = {};
    for (const surah of SURAHS) {
      let masteredCount = 0;
      let reviewCount = 0;
      let learningCount = 0;
      for (let ayah = 1; ayah <= surah.verses; ayah++) {
        const status = memorized[`${surah.id}:${ayah}`];
        if (status === "mastered") masteredCount++;
        else if (status === "review") reviewCount++;
        else if (status === "learning") learningCount++;
      }
      result[surah.id] =
        masteredCount / surah.verses >= 0.8 ? "mastered" : reviewCount > 0 ? "review" : learningCount > 0 ? "learning" : "unseen";
    }
    return result;
  }, [memorized]);

  const aggregate = useMemo(() => {
    const juz: Record<number, { total: number; mastered: number; review: number }> = {};
    const page: Record<number, { total: number; mastered: number; review: number }> = {};
    for (const verse of ALL_VERSES) {
      const status = memorized[`${verse.surah}:${verse.ayah}`];
      for (const [index, bucket] of [[verse.juz, juz], [verse.page, page]] as const) {
        const entry = bucket[index] ?? { total: 0, mastered: 0, review: 0 };
        entry.total++;
        if (status === "mastered") entry.mastered++;
        if (status === "review") entry.review++;
        bucket[index] = entry;
      }
    }
    return { juz, page };
  }, [memorized]);

  const colorFor = (status: string) =>
    status === "mastered" ? colors.success : status === "review" ? colors.warning : status === "learning" ? colors.gold : colors.border;

  const percentage = Math.round((Object.values(surahStatuses).filter((status) => status === "mastered").length / SURAHS.length) * 100);

  const cycleSurah = async (id: number) => {
    const status = surahStatuses[id];
    if (status === "mastered") await clearSurahMemorization(id);
    else await setSurahMemorization(id, status === "review" ? "review" : "mastered");
    refresh();
    void load();
  };

  return (
    <Screen>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <ProgressRing value={percentage / 100} label={t("map.progress")} size={90} />
        <View style={{ flex: 1 }}>
          <TextBody>{t("map.subtitle")}</TextBody>
          <View style={styles.legend}>
            {(["mastered", "review", "unseen"] as const).map((status) => (
              <View key={status} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colorFor(status) }]} />
                <Text style={[styles.legendText, { color: colors.muted }]}>{t(`map.${status}`)}</Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      <View style={styles.tabs}>
        <Chip label={t("map.bySurah")} active={mode === "surah"} onPress={() => setMode("surah")} />
        <Chip label={t("map.byJuz")} active={mode === "juz"} onPress={() => setMode("juz")} />
        <Chip label={t("map.byPage")} active={mode === "page"} onPress={() => setMode("page")} />
      </View>

      {mode === "surah" ? (
        <View style={styles.grid}>
          {SURAHS.map((surah) => {
            const status = surahStatuses[surah.id];
            return (
              <Pressable
                key={surah.id}
                onPress={() => {
                  if (!settings.quizSurahs.includes(surah.id) && status !== "unseen") {
                    void update("quizSurahs", [...settings.quizSurahs, surah.id].sort((a, b) => a - b));
                  }
                  void cycleSurah(surah.id);
                }}
                onLongPress={() => router.push({ pathname: "/mushaf/reader", params: { surah: surah.id } })}
                style={[styles.tile, { backgroundColor: colorFor(status) }]}
              >
                <Text style={[styles.tileNumber, { color: status === "unseen" ? colors.text : "#FFFFFF" }]}>{digits(surah.id)}</Text>
                <Text style={[styles.tileName, { color: status === "unseen" ? colors.text : "#FFFFFF" }]} numberOfLines={1}>{surah.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : mode === "juz" ? (
        <View style={styles.grid}>
          {Array.from({ length: TOTAL_JUZ }, (_, index) => index + 1).map((juz) => {
            const data = aggregate.juz[juz];
            const ratio = data ? data.mastered / data.total : 0;
            const status = ratio >= 0.8 ? "mastered" : data?.review ? "review" : ratio > 0 ? "learning" : "unseen";
            return (
              <Pressable key={juz} onPress={() => router.push({ pathname: "/mushaf/reader", params: { juz } })} style={[styles.tile, { backgroundColor: colorFor(status) }]}>
                <Text style={[styles.tileNumber, { color: status === "unseen" ? colors.text : "#FFFFFF" }]}>{digits(juz)}</Text>
                <Text style={[styles.tileName, { color: status === "unseen" ? colors.text : "#FFFFFF" }]}>{t("map.juz")}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.gridPages}>
          {Array.from({ length: TOTAL_PAGES }, (_, index) => index + 1).map((page) => {
            const data = aggregate.page[page];
            const ratio = data ? data.mastered / data.total : 0;
            const status = ratio >= 0.8 ? "mastered" : data?.review ? "review" : ratio > 0 ? "learning" : "unseen";
            return (
              <Pressable key={page} onPress={() => router.push({ pathname: "/mushaf/reader", params: { page } })} style={[styles.pageTile, { backgroundColor: colorFor(status) }]}>
                <Text style={[styles.pageNumber, { color: status === "unseen" ? colors.text : "#FFFFFF" }]}>{digits(page)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { marginTop: 10, gap: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { fontFamily: FONTS.ui, fontSize: 11 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tabs: { flexDirection: "row", marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  tile: { width: "23%", minHeight: 74, borderRadius: 14, padding: 8, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  tileNumber: { fontFamily: FONTS.ui, fontSize: 18, fontWeight: "700" },
  tileName: { fontFamily: FONTS.ui, fontSize: 10, marginTop: 4 },
  gridPages: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  pageTile: { width: "15%", minHeight: 40, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  pageNumber: { fontFamily: FONTS.ui, fontSize: 12 },
});
