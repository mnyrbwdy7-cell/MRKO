import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Font from "expo-font";
import { AppProvider, useApp } from "@/state/AppContext";
import { FONTS } from "@/components/ui";

function Navigator() {
  const { t, colors, isDark } = useApp();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: FONTS.ui, fontWeight: "700" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="recite" options={{ title: t("nav.recite") }} />
        <Stack.Screen name="mushaf/reader" options={{ title: t("mushaf.title") }} />
        <Stack.Screen name="quiz/[mode]" options={{ title: t("quiz.title") }} />
        <Stack.Screen name="mistakes" options={{ title: t("nav.mistakes") }} />
        <Stack.Screen name="map" options={{ title: t("nav.map") }} />
        <Stack.Screen name="review" options={{ title: t("nav.review") }} />
        <Stack.Screen name="history" options={{ title: t("nav.history") }} />
        <Stack.Screen name="stats" options={{ title: t("nav.stats") }} />
        <Stack.Screen name="tajweed" options={{ title: t("nav.tajweed") }} />
        <Stack.Screen name="settings" options={{ title: t("nav.settings") }} />
        <Stack.Screen name="privacy" options={{ title: t("settings.privacy") }} />
        <Stack.Screen name="about" options={{ title: t("settings.about") }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    Font.loadAsync({
      [FONTS.ui]: require("@expo-google-fonts/tajawal/400Regular/Tajawal_400Regular.ttf"),
      [FONTS.ui + "Bold"]: require("@expo-google-fonts/tajawal/700Bold/Tajawal_700Bold.ttf"),
      [FONTS.quran]: require("@expo-google-fonts/amiri-quran/400Regular/AmiriQuran_400Regular.ttf"),
    }).then(() => setFontsReady(true));
  }, []);

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B3D2E" }}>
        <ActivityIndicator color="#D8B45A" size="large" />
      </View>
    );
  }

  return (
    <AppProvider>
      <Navigator />
    </AppProvider>
  );
}
