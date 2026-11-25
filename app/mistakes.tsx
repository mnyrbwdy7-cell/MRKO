import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  getRecitation,
  listMistakes,
  reviewMistake,
  type MistakeRow,
} from "@/db";
import { SURAHS } from "@/data/quran";
import { arabicDigits } from "@/recitation/normalize";
import { useApp } from "@/state/AppContext";
import { AudioPreview } from "@/components/AudioPreview";
import { Button, Card, Chip, EmptyState, FONTS, Screen, TextBody } from "@/components/ui";

type Filter = "active" | "mastered";

export default function MistakesScreen() {
  const router = useRouter();
  const { t, locale, colors, settings, update, refresh } = useApp();
  const digits = locale === "ar" ? arabicDigits : (value: number) => String(value);
  const [filter, setFilter] = useState<Filter>("active");
  const [mistakes, setMistakes] = useState<MistakeRow[]>([]);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [audioUris, setAudioUris] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const rows = await listMistakes();
    setMistakes(rows);
    const ids = [...new Set(rows.map((row) => row.recitation_id).filter((id): id is number => Boolean(id)))];
    const uris: Record<number, string> = {};
    for (const id of ids) {
      const recitation = await getRecitation(id);
      if (recitation?.audio_uri) uris[id] = recitation.audio_uri;
    }
    setAudioUris(uris);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  const visible = mistakes.filter((row) => (filter === "active" ? !row.mastered : Boolean(row.mastered)));
  const mark = async (row: MistakeRow, correct: boolean) => {
    await reviewMistake(row.id, correct);
    setReviewing(null);
    refresh();
    void load();
  };

  return (
    <Screen>
      <TextBody muted>{t("mistakes.subtitle")}</TextBody>
      <View style={styles.filters}>
        <Chip label={t("mistakes.active")} active={filter === "active"} onPress={() => setFilter("active")} />
        <Chip label={t("mistakes.mastered")} active={filter === "mastered"} onPress={() => setFilter("mastered")} />
      </View>

      {!visible.length ? (
        <EmptyState title={t("mistakes.empty")} icon="checkmark-circle-outline" />
      ) : (
        visible.map((row) => {
          const uri = row.recitation_id ? audioUris[row.recitation_id] : undefined;
          return (
            <Card key={row.id}>
              <View style={styles.header}>
                <Text style={[styles.ref, { color: colors.primary }]}>
                  {SURAHS[row.surah - 1]?.name ?? row.surah} · {t("common.verse")} {digits(row.ayah)}
                </Text>
                <Chip
                  label={row.mastered ? t("mistakes.masteredBadge") : row.due_at <= Date.now() ? t("mistakes.dueToday") : t("mistakes.active")}
                  color={row.mastered ? colors.success : colors.warning}
                />
              </View>
              <View style={styles.words}>
                <View style={styles.wordColumn}>
                  <Text style={[styles.wordCaption, { color: colors.muted }]}>{t("mistakes.expected")}</Text>
                  <Text style={[styles.word, { color: colors.success }]}>{row.expected}</Text>
                </View>
                <View style={styles.wordColumn}>
                  <Text style={[styles.wordCaption, { color: colors.muted }]}>{t("mistakes.spoken")}</Text>
                  <Text style={[styles.word, { color: colors.danger }]}>{row.actual || "—"}</Text>
                </View>
              </View>
              <Text style={[styles.meta, { color: colors.muted }]}>
                {row.type} · {row.confidence >= 0.75 ? t("common.confirmed") : t("common.needsReview")} · {t("quiz.question")} {digits(row.review_count)}
              </Text>

              {reviewing === row.id ? (
                <View style={styles.reviewBox}>
                  <TextBody>{row.expected}</TextBody>
                  <View style={styles.rowButtons}>
                    <Button title={t("mistakes.correct")} icon="checkmark" onPress={() => mark(row, true)} style={styles.rowButton} />
                    <Button title={t("mistakes.wrong")} icon="close" variant="danger" onPress={() => mark(row, false)} style={styles.rowButton} />
                  </View>
                </View>
              ) : (
                <>
                  {!row.mastered ? (
                    <Pressable onPress={() => setReviewing(row.id)} style={styles.link}>
                      <Text style={[styles.linkText, { color: colors.primary }]}>{t("mistakes.reviewNow")}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={async () => {
                      if (!settings.quizSurahs.includes(row.surah)) {
                        await update("quizSurahs", [...settings.quizSurahs, row.surah]);
                      }
                      router.push({ pathname: "/quiz/[mode]", params: { mode: "missingWord" } });
                    }}
                    style={styles.link}
                  >
                    <Text style={[styles.linkText, { color: colors.primary }]}>{t("mistakes.toQuestion")}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push({ pathname: "/recite", params: { surah: row.surah, from: row.ayah, to: row.ayah } })}
                    style={styles.link}
                  >
                    <Text style={[styles.linkText, { color: colors.primary }]}>{t("mistakes.reciteAgain")}</Text>
                  </Pressable>
                  {uri ? <AudioPreview uri={uri} /> : null}
                </>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", marginBottom: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  ref: { fontFamily: FONTS.ui, fontWeight: "700", fontSize: 14 },
  words: { flexDirection: "row", gap: 10, marginVertical: 10 },
  wordColumn: { flex: 1 },
  wordCaption: { fontFamily: FONTS.ui, fontSize: 11 },
  word: { fontFamily: FONTS.quran, fontSize: 19, marginTop: 2 },
  meta: { fontFamily: FONTS.ui, fontSize: 11 },
  link: { paddingVertical: 9 },
  linkText: { fontFamily: FONTS.ui, fontSize: 13, textDecorationLine: "underline" },
  reviewBox: { marginTop: 10, padding: 10, borderRadius: 12 },
  rowButtons: { flexDirection: "row", gap: 8, marginTop: 8 },
  rowButton: { flex: 1, minHeight: 44 },
});
