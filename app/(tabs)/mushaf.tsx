import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getMemorization } from "@/db";
import { SURAHS, TOTAL_JUZ, TOTAL_PAGES, searchQuran } from "@/data/quran";
import { arabicDigits } from "@/recitation/normalize";
import { useApp } from "@/state/AppContext";
import { Chip, EmptyState, FONTS, Screen, TextBody } from "@/components/ui";

type Tab = "surah" | "juz" | "page";

export default function MushafIndex() {
  const router = useRouter();
  const { t, locale, colors } = useApp();
  const [tab, setTab] = useState<Tab>("surah");
  const [query, setQuery] = useState("");
  const [memorized, setMemorized] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      void getMemorization().then((rows) => setMemorized(rows));
    }, []),
  );

  const results = useMemo(() => (query.trim() ? searchQuran(query, 60) : []), [query]);
  const digits = locale === "ar" ? arabicDigits : (value: number) => String(value);

  return (
    <Screen scroll={false} padded={false}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={19} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("mushaf.searchPlaceholder")}
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.text }]}
          accessibilityLabel={t("mushaf.searchPlaceholder")}
        />
        {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={20} color={colors.muted} /></Pressable> : null}
      </View>

      {!query ? (
        <View style={styles.tabs}>
          {(["surah", "juz", "page"] as Tab[]).map((item) => (
            <Chip key={item} label={t(`mushaf.${item === "surah" ? "surahs" : item}`)} active={tab === item} onPress={() => setTab(item)} />
          ))}
        </View>
      ) : null}

      {query ? (
        results.length ? (
          <FlatList
            data={results}
            keyExtractor={(item) => `${item.verse.surah}:${item.verse.ayah}`}
            renderItem={({ item }) => {
              const surah = SURAHS[item.verse.surah - 1];
              return (
                <Pressable
                  onPress={() => router.push({ pathname: "/mushaf/reader", params: { surah: item.verse.surah, from: item.verse.ayah } })}
                  style={[styles.row, { borderBottomColor: colors.border }]}
                >
                  <View style={[styles.number, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.numberText, { color: colors.primary }]}>{digits(item.verse.ayah)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.quranText, { color: colors.text }]}>{item.verse.text}</Text>
                    <Text style={[styles.meta, { color: colors.muted }]}>{surah.name} · {t("common.page")} {digits(item.verse.page)}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        ) : (
          <EmptyState title={t("mushaf.noResults")} icon="search-outline" />
        )
      ) : tab === "surah" ? (
        <FlatList
          data={SURAHS}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const status = memorized[`${item.id}:1`];
            return (
              <Pressable
                onPress={() => router.push({ pathname: "/mushaf/reader", params: { surah: item.id } })}
                style={[styles.row, { borderBottomColor: colors.border }]}
              >
                <View style={[styles.number, { backgroundColor: status ? colors.primary : colors.surfaceAlt }]}>
                  <Text style={[styles.numberText, { color: status ? colors.onPrimary : colors.primary }]}>{digits(item.id)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.surahName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.meta, { color: colors.muted }]}>
                    {locale === "ar" ? item.en : item.name} · {digits(item.verses)} {t("common.verse")} · {t(item.type === "meccan" ? "mushaf.meccan" : "mushaf.medinan")}
                  </Text>
                </View>
                {status ? <Ionicons name="checkmark-circle" size={20} color={colors.gold} /> : null}
                <Text style={[styles.pageNumber, { color: colors.muted }]}>{digits(item.page)}</Text>
              </Pressable>
            );
          }}
        />
      ) : tab === "juz" ? (
        <FlatList
          data={Array.from({ length: TOTAL_JUZ }, (_, index) => index + 1)}
          keyExtractor={(item) => String(item)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/mushaf/reader", params: { juz: item } })}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <View style={[styles.number, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.numberText, { color: colors.primary }]}>{digits(item)}</Text>
              </View>
              <TextBody>{t("mushaf.juz")} {digits(item)}</TextBody>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={Array.from({ length: TOTAL_PAGES }, (_, index) => index + 1)}
          keyExtractor={(item) => String(item)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/mushaf/reader", params: { page: item } })}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <View style={[styles.number, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.numberText, { color: colors.primary }]}>{digits(item)}</Text>
              </View>
              <TextBody>{t("mushaf.page")} {digits(item)}</TextBody>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, margin: 16, marginBottom: 8, minHeight: 48 },
  input: { flex: 1, fontFamily: FONTS.ui, fontSize: 14 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  number: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  numberText: { fontFamily: FONTS.ui, fontWeight: "700", fontSize: 15 },
  surahName: { fontFamily: FONTS.ui, fontSize: 17, fontWeight: "700" },
  meta: { fontFamily: FONTS.ui, fontSize: 11, marginTop: 3 },
  quranText: { fontFamily: FONTS.quran, fontSize: 18, lineHeight: 32 },
  pageNumber: { fontFamily: FONTS.ui, fontSize: 12 },
});
