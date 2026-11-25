import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { I18nManager } from "react-native";
import { useColorScheme } from "react-native";
import { getSetting, setSetting } from "@/db";
import { translate, type Locale } from "@/i18n";
import { scheduleDailyReminder, cancelDailyReminder } from "@/notifications/reminder";

export type ThemeMode = "light" | "dark" | "system";

export interface AppSettings {
  language: Locale;
  theme: ThemeMode;
  fontScale: number;
  offlineOnly: boolean;
  allowNetwork: boolean;
  saveAudio: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  dailyGoal: number;
  quizSurahs: number[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "ar",
  theme: "system",
  fontScale: 1,
  offlineOnly: true,
  allowNetwork: false,
  saveAudio: false,
  reminderEnabled: false,
  reminderTime: "21:00",
  dailyGoal: 5,
  quizSurahs: [],
};

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  primaryDeep: string;
  gold: string;
  text: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  onPrimary: string;
  overlay: string;
}

const light: ThemeColors = {
  bg: "#F6F7F3",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF4EE",
  primary: "#0B3D2E",
  primaryDeep: "#073226",
  gold: "#B8912F",
  text: "#16241D",
  muted: "#687A70",
  border: "#DDE6DD",
  success: "#2E7D5B",
  warning: "#C89322",
  danger: "#B4473D",
  onPrimary: "#FFFFFF",
  overlay: "rgba(7, 31, 23, 0.45)",
};

const dark: ThemeColors = {
  bg: "#071813",
  surface: "#102B22",
  surfaceAlt: "#173A2D",
  primary: "#1E7255",
  primaryDeep: "#0B3D2E",
  gold: "#D8B45A",
  text: "#EDF5EE",
  muted: "#9CB6A8",
  border: "#224A3A",
  success: "#55B98C",
  warning: "#E0B85F",
  danger: "#E47B70",
  onPrimary: "#FFFFFF",
  overlay: "rgba(0, 0, 0, 0.6)",
};

interface AppContextValue {
  settings: AppSettings;
  ready: boolean;
  isDark: boolean;
  colors: ThemeColors;
  fontScale: number;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: Locale;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  refreshKey: number;
  refresh: () => void;
  reset: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const stored = await getSetting<Partial<AppSettings>>("settings", {});
        const merged = { ...DEFAULT_SETTINGS, ...stored };
        setSettings(merged);
        I18nManager.forceRTL(merged.language === "ar");
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (settings.reminderEnabled) scheduleDailyReminder(settings.reminderTime);
    else cancelDailyReminder();
  }, [ready, settings.reminderEnabled, settings.reminderTime]);

  const update = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      void setSetting("settings", next);
      return next;
    });
    if (key === "language") I18nManager.forceRTL(value === "ar");
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => translate(settings.language, key, params), [settings.language]);
  const isDark = settings.theme === "dark" || (settings.theme === "system" && systemScheme === "dark");
  const colors = isDark ? dark : light;
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  const reset = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    await setSetting("settings", DEFAULT_SETTINGS);
    I18nManager.forceRTL(true);
    setRefreshKey((value) => value + 1);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({ settings, ready, isDark, colors, fontScale: settings.fontScale, t, locale: settings.language, update, refreshKey, refresh, reset }),
    [settings, ready, isDark, colors, t, update, refreshKey, refresh, reset],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
