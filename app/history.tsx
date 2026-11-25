import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { listRecitations, type RecitationRow } from "@/db";
import { arabicDigits } from "@/recitation/normalize";
import { useApp } from "@/state/AppContext";
import { AudioPreview } from "@/components/AudioPreview";
import { Card, EmptyState, FONTS, Screen, TextBody } from "@/components/ui";

export default function HistoryScreen() {
  const { t, locale, colors, settings } = useApp();
  const digits = locale === "ar" ? arabicDigits : (value: number) => String(value);
  const [rows, setRows] = useState<RecitationRow[]>([]);
  const load = useCallback(async () => setRows(await listRecitations(100)), []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  return (
    <Screen>
      {!rows.length ? <EmptyState title={t("history.empty")} icon="time-outline" /> : rows.map((row) => (
        <Card key={row.id}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{row.start_key} → {row.end_key}</Text>
            <Text style={[styles.date, { color: colors.muted }]}>{new Date(row.started_at).toLocaleDateString()}</Text>
          </View>
          <View style={styles.details}>
            <Text style={[styles.detail, { color: colors.primary }]}>{t("history.accuracy")}: {digits(Math.round(row.accuracy * 100))}%</Text>
            <Text style={[styles.detail, { color: colors.danger }]}>{t("history.errors")}: {digits(row.errors)}</Text>
            <Text style={[styles.detail, { color: colors.muted }]}>{t("history.words")}: {digits(row.words)}</Text>
          </View>
          <Text style={[styles.mode, { color: colors.gold }]}>{row.offline ? t("history.offline") : t("common.online")}</Text>
          {settings.saveAudio && row.audio_uri ? <AudioPreview uri={row.audio_uri} /> : null}
        </Card>
      ))}
      <TextBody muted style={styles.footer}>{rows.length ? `${digits(rows.length)} ${t("nav.history")}` : ""}</TextBody>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: FONTS.ui, fontWeight: "700", fontSize: 15 },
  date: { fontFamily: FONTS.ui, fontSize: 11 },
  details: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  detail: { fontFamily: FONTS.ui, fontSize: 12 },
  mode: { fontFamily: FONTS.ui, fontSize: 11, marginTop: 10 },
  footer: { textAlign: "center", marginTop: 10 },
});
