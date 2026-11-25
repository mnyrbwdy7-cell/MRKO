import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getSetting } from "@/db";
import { TAJWEED_RULE_LABELS, type TajweedFinding } from "@/recitation/tajweed";
import { useApp } from "@/state/AppContext";
import { Card, Chip, EmptyState, FONTS, Screen, TextBody } from "@/components/ui";

export default function TajweedScreen() {
  const { t, locale, colors } = useApp();
  const [findings, setFindings] = useState<TajweedFinding[]>([]);
  useEffect(() => {
    void getSetting<TajweedFinding[]>("lastTajweed", []).then(setFindings);
  }, []);

  return (
    <Screen>
      <Card accent>
        <Text style={[styles.title, { color: colors.text }]}>{t("tajweed.subtitle")}</Text>
        <TextBody muted>{t("tajweed.disclaimer")}</TextBody>
      </Card>
      {findings.length ? findings.map((finding, index) => {
        const label = TAJWEED_RULE_LABELS[finding.rule];
        return (
          <Card key={index}>
            <View style={styles.header}>
              <Text style={[styles.rule, { color: colors.primary }]}>{label[locale]}</Text>
              <Chip label={t("common.needsReview")} color={colors.warning} />
            </View>
            <Text style={[styles.word, { color: colors.text }]}>{finding.word}</Text>
            <Text style={[styles.ref, { color: colors.muted }]}>{finding.surah}:{finding.ayah}</Text>
            <TextBody muted>{finding.detail}</TextBody>
          </Card>
        );
      }) : <EmptyState title={t("tajweed.noFindings")} message={t("tajweed.disclaimer")} icon="sparkles-outline" />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: FONTS.ui, fontSize: 16, fontWeight: "700", marginBottom: 6 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rule: { fontFamily: FONTS.ui, fontWeight: "700", fontSize: 14 },
  word: { fontFamily: FONTS.quran, fontSize: 24, marginVertical: 6 },
  ref: { fontFamily: FONTS.ui, fontSize: 11 },
});
