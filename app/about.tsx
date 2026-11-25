import React from "react";
import { Card, FONTS, Screen, TextBody } from "@/components/ui";
import { useApp } from "@/state/AppContext";
import { QURAN_META } from "@/data/quran";
import { Text, View } from "react-native";
import { useApp as useTheme } from "@/state/AppContext";

export default function AboutScreen() {
  const { t, colors } = useTheme();
  const { t: translate } = useApp();
  return (
    <Screen>
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Text style={{ fontFamily: FONTS.quran, fontSize: 52, color: colors.gold }}>رتل</Text>
        <Text style={{ fontFamily: FONTS.ui, color: colors.muted }}>{t("settings.version")} 1.0.0</Text>
      </View>
      <Card accent>
        <TextBody>{translate("about.body")}</TextBody>
      </Card>
      <Card>
        <TextBody>{String(QURAN_META.riwaya)} · {String(QURAN_META.mushaf)}</TextBody>
        <TextBody muted>{String(QURAN_META.textSource)}</TextBody>
      </Card>
    </Screen>
  );
}
