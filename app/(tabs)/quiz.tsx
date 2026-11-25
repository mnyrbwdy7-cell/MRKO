import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getMemorizedSurahs } from "@/db";
import { SURAHS } from "@/data/quran";
import { QUIZ_MODES, type QuizMode } from "@/quiz/generator";
import { useApp } from "@/state/AppContext";
import { arabicDigits } from "@/recitation/normalize";
import { Button, Card, Chip, FONTS, Screen, SectionTitle, TextBody } from "@/components/ui";

export default function QuizIndex() {
  const router = useRouter();
  const { t, locale, colors, settings, update } = useApp();
  const [available, setAvailable] = useState<number[]>([]);

  useFocusEffect(useCallback(() => { void getMemorizedSurahs().then(setAvailable); }, []));

  const selected = settings.quizSurahs;
  const toggle = (id: number) => {
    void update("quizSurahs", selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id].sort((a, b) => a - b));
  };
  const labelFor = (mode: (typeof QUIZ_MODES)[number]) => (locale === "id" ? mode.idn : locale === "en" ? mode.en : mode.ar);

  return (
    <Screen>
      <Card accent>
        <Text style={[styles.title, { color: colors.text }]}>{t("quiz.title")}</Text>
        <TextBody muted>{t("quiz.subtitle")}</TextBody>
      </Card>

      <SectionTitle
        title={t("quiz.chooseSurahs")}
        action={available.length ? `${selected.length}/${available.length}` : undefined}
      />
      {available.length ? (
        <View style={styles.chips}>
          {available.map((id) => (
            <Chip key={id} label={SURAHS[id - 1]?.name ?? String(id)} active={selected.includes(id)} onPress={() => toggle(id)} />
          ))}
        </View>
      ) : (
        <TextBody muted>{t("quiz.noSources")}</TextBody>
      )}

      <SectionTitle title={t("quiz.title")} />
      {QUIZ_MODES.map((mode) => {
        const enabled = selected.length > 0;
        return (
          <Pressable
            key={mode.id}
            onPress={() => enabled ? router.push({ pathname: "/quiz/[mode]", params: { mode: mode.id as QuizMode } }) : undefined}
            disabled={!enabled}
            android_ripple={{ color: colors.surfaceAlt }}
            style={[styles.modeCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: enabled ? 1 : 0.55 }]}
          >
            <View style={[styles.modeIcon, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name={(mode.icon === "mic" ? "mic-outline" : mode.icon === "list" ? "list-outline" : mode.icon === "book" ? "book-outline" : "help-circle-outline") as never} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modeTitle, { color: colors.text }]}>{labelFor(mode)}</Text>
              <Text style={[styles.modeMeta, { color: colors.muted }]}>{arabicDigits(10)} {t("quiz.question")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        );
      })}

      {!available.length ? (
        <Button title={t("quiz.chooseSources")} icon="grid-outline" onPress={() => router.push("/map")} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: FONTS.ui, fontSize: 20, fontWeight: "700", marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  modeCard: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 9 },
  modeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  modeTitle: { fontFamily: FONTS.ui, fontSize: 15, fontWeight: "700" },
  modeMeta: { fontFamily: FONTS.ui, fontSize: 11, marginTop: 3 },
});
