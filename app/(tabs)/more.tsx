import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "@/state/AppContext";
import { FONTS, Screen, TextBody } from "@/components/ui";

export default function MoreScreen() {
  const router = useRouter();
  const { t, colors } = useApp();
  const items: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; route: string }> = [
    { label: t("nav.mistakes"), icon: "alert-circle-outline", route: "/mistakes" },
    { label: t("nav.map"), icon: "grid-outline", route: "/map" },
    { label: t("nav.review"), icon: "calendar-outline", route: "/review" },
    { label: t("nav.history"), icon: "time-outline", route: "/history" },
    { label: t("nav.stats"), icon: "bar-chart-outline", route: "/stats" },
    { label: t("nav.tajweed"), icon: "sparkles-outline", route: "/tajweed" },
    { label: t("nav.recite"), icon: "mic-outline", route: "/recite" },
    { label: t("settings.privacy"), icon: "shield-outline", route: "/privacy" },
    { label: t("settings.about"), icon: "information-circle-outline", route: "/about" },
    { label: t("nav.settings"), icon: "settings-outline", route: "/settings" },
  ];
  return (
    <Screen>
      <View style={styles.header}>
        <View style={[styles.logo, { backgroundColor: colors.primary }]}>
          <Ionicons name="moon" size={28} color={colors.gold} />
        </View>
        <View>
          <Text style={[styles.appName, { color: colors.text }]}>{t("common.appName")}</Text>
          <TextBody muted>{t("home.tagline")}</TextBody>
        </View>
      </View>
      {items.map((item) => (
        <Pressable
          key={item.route}
          onPress={() => router.push(item.route as never)}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name={item.icon} size={21} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  logo: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  appName: { fontFamily: FONTS.ui, fontSize: 24, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 15, marginBottom: 9 },
  rowLabel: { fontFamily: FONTS.ui, fontSize: 15, flex: 1 },
});
