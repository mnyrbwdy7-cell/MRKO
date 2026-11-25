import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { clearMemorization, clearSurahMemorization, getMemorization, setMemorization, setSurahMemorization } from "@/db";
import { getSurah, getVerses, getVersesByJuz, getVersesByPage, type Verse } from "@/data/quran";
import { arabicDigits } from "@/recitation/normalize";
import { useApp } from "@/state/AppContext";
import { Button, Card, EmptyState, FONTS, Screen, TextBody } from "@/components/ui";

export default function MushafReader() {
  const params = useLocalSearchParams<{ surah?: string; from?: string; page?: string; juz?: string }>();
  const router = useRouter();
  const { t, locale, colors, refresh } = useApp();
  const [memorized, setMemorized] = useState<Record<string, string>>({});
  const [showTranslation, setShowTranslation] = useState(locale !== "ar");

  const surahId = Number(params.surah);
  const page = Number(params.page);
  const juz = Number(params.juz);
  const highlightAyah = Number(params.from);

  const verses: Verse[] = surahId
    ? getVerses(surahId)
    : page
      ? getVersesByPage(page)
      : juz
        ? getVersesByJuz(juz)
        : [];
  const surah = surahId ? getSurah(surahId) : undefined;
  const digits = locale === "ar" ? arabicDigits : (value: number) => String(value);

  const load = useCallback(async () => {
    setMemorized(await getMemorization());
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  const toggleSurah = async () => {
    if (!surah) return;
    const already = Boolean(memorized[`${surah.id}:1`]);
    if (already) await clearSurahMemorization(surah.id);
    else await setSurahMemorization(surah.id, "mastered");
    refresh();
    void load();
  };

  const toggleVerse = async (verse: Verse) => {
    const key = `${verse.surah}:${verse.ayah}`;
    if (memorized[key]) await clearMemorization(verse.surah, verse.ayah);
    else await setMemorization(verse.surah, verse.ayah, "mastered");
    refresh();
    void load();
  };

  const translation = (verse: Verse) => (locale === "id" ? verse.id : verse.en);

  if (!verses.length) return <Screen><EmptyState title={t("mushaf.noResults")} icon="book-outline" /></Screen>;

  return (
    <Screen padded={false}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>
            {surah ? surah.name : page ? `${t("mushaf.page")} ${digits(page)}` : `${t("mushaf.juz")} ${digits(juz)}`}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {surah
              ? `${digits(surah.verses)} ${t("common.verse")} · ${t(surah.type === "meccan" ? "mushaf.meccan" : "mushaf.medinan")} · ${t("common.page")} ${digits(surah.page)}`
              : `${verses.length} ${t("common.verse")}`}
          </Text>
        </View>
        <Pressable onPress={() => setShowTranslation((value) => !value)} style={[styles.iconButton, { backgroundColor: colors.surfaceAlt }]} accessibilityLabel={t("mushaf.translation")}>
          <Ionicons name="language-outline" size={19} color={showTranslation ? colors.gold : colors.muted} />
        </Pressable>
        {surah ? (
          <Pressable onPress={toggleSurah} style={[styles.iconButton, { backgroundColor: colors.surfaceAlt }]} accessibilityLabel={t("mushaf.markSurah")}>
            <Ionicons name={memorized[`${surah.id}:1`] ? "checkmark-circle" : "checkmark-circle-outline"} size={19} color={memorized[`${surah.id}:1`] ? colors.gold : colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {surah && (
        <View style={styles.banner}>
          <Button
            title={t("recite.start")}
            icon="mic-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: "/recite", params: { surah: surah.id, from: 1, to: surah.verses } })}
            style={styles.bannerButton}
          />
        </View>
      )}

      <View style={styles.verses}>
        {verses.map((verse) => {
          const key = `${verse.surah}:${verse.ayah}`;
          const marked = Boolean(memorized[key]);
          const highlighted = Boolean(surahId && highlightAyah === verse.ayah);
          return (
            <Card key={key} accent={highlighted} style={highlighted ? styles.highlight : undefined}>
              <View style={styles.verseHeader}>
                <Text style={[styles.basmala, { color: colors.gold }]}>{digits(verse.ayah)}</Text>
                <Pressable onPress={() => toggleVerse(verse)} hitSlop={10} accessibilityLabel={t("mushaf.marking")}>
                  <Ionicons name={marked ? "bookmark" : "bookmark-outline"} size={19} color={marked ? colors.gold : colors.muted} />
                </Pressable>
              </View>
              <Text style={[styles.ayah, { color: colors.text }]}>{verse.text}</Text>
              {showTranslation && translation(verse) ? (
                <TextBody muted style={styles.translation}>{translation(verse)}</TextBody>
              ) : null}
              <Text style={[styles.verseMeta, { color: colors.muted }]}>
                {t("common.juz")} {digits(verse.juz)} · {t("common.page")} {digits(verse.page)}
              </Text>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16, borderBottomWidth: 1 },
  title: { fontFamily: FONTS.ui, fontSize: 20, fontWeight: "700" },
  subtitle: { fontFamily: FONTS.ui, fontSize: 12, marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  banner: { paddingHorizontal: 16, paddingTop: 12 },
  bannerButton: { minHeight: 44 },
  verses: { padding: 16 },
  verseHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  basmala: { fontFamily: FONTS.ui, fontWeight: "700", fontSize: 14 },
  ayah: { fontFamily: FONTS.quran, fontSize: 27, lineHeight: 50, textAlign: "right" },
  translation: { marginTop: 10, fontSize: 13 },
  verseMeta: { fontFamily: FONTS.ui, fontSize: 11, marginTop: 10 },
  highlight: { borderWidth: 2 },
});
