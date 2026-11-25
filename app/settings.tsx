import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import {
  clearAllAudioUris,
  deleteAllUserData,
  exportBackup,
  importBackup,
  listRecitations,
  type BackupPayload,
} from "@/db";
import { useApp } from "@/state/AppContext";
import type { Locale } from "@/i18n";
import { Button, Card, Chip, FONTS, Screen, SectionTitle, SettingRow, TextBody, ToggleRow } from "@/components/ui";

const LANGUAGES: Array<{ id: Locale; label: string; native: string }> = [
  { id: "ar", label: "Arabic", native: "العربية" },
  { id: "en", label: "English", native: "English" },
  { id: "id", label: "Indonesian", native: "Bahasa Indonesia" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { t, locale, colors, settings, update, refresh, reset } = useApp();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const createBackup = async () => {
    try {
      const backup = await exportBackup();
      const file = new File(Paths.cache, `rattil-backup-${Date.now()}.json`);
      await file.write(JSON.stringify(backup), { encoding: "utf8" });
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: t("settings.backup") });
      setMessage(t("common.success"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    }
  };

  const restoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = new File(result.assets[0].uri);
      const payload = JSON.parse(await file.text()) as BackupPayload;
      await importBackup(payload);
      refresh();
      setMessage(t("common.success"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    }
  };

  const deleteRecordings = async () => {
    try {
      const rows = await listRecitations(1000);
      for (const row of rows) {
        if (!row.audio_uri) continue;
        try {
          const file = new File(row.audio_uri);
          if (file.exists) file.delete();
        } catch {
          // The clip may already have been removed by the OS cache cleaner.
        }
      }
      await clearAllAudioUris();
      refresh();
      setMessage(t("common.success"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("common.error"));
    }
  };

  const deleteData = () => {
    Alert.alert(t("settings.deleteData"), t("settings.confirmDelete"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: async () => {
          await deleteRecordings();
          await deleteAllUserData();
          await reset();
          setMessage(t("common.success"));
        },
      },
    ]);
  };

  return (
    <Screen>
      <SectionTitle title={t("settings.language")} />
      <Card>
        <SettingRow label={t("settings.language")} value={LANGUAGES.find((item) => item.id === locale)?.native} icon="language-outline" onPress={() => setLanguageOpen(true)} />
      </Card>

      <SectionTitle title={t("settings.darkMode")} />
      <Card>
        <View style={styles.chips}>
          {(["light", "dark", "system"] as const).map((mode) => (
            <Chip
              key={mode}
              label={mode === "light" ? (locale === "ar" ? "فاتح" : locale === "id" ? "Terang" : "Light") : mode === "dark" ? (locale === "ar" ? "داكن" : locale === "id" ? "Gelap" : "Dark") : (locale === "ar" ? "النظام" : "System")}
              active={settings.theme === mode}
              onPress={() => void update("theme", mode)}
            />
          ))}
        </View>
        <SectionTitle title={t("settings.fontSize")} />
        <View style={styles.chips}>
          {[
            { value: 0.9, label: t("settings.small") },
            { value: 1, label: t("settings.medium") },
            { value: 1.2, label: t("settings.large") },
          ].map((option) => (
            <Chip key={option.value} label={option.label} active={settings.fontScale === option.value} onPress={() => void update("fontScale", option.value)} />
          ))}
        </View>
      </Card>

      <SectionTitle title={t("settings.microphone")} />
      <Card>
        <ToggleRow
          label={t("settings.offlineOnly")}
          description={t("settings.offlineDescription")}
          value={settings.offlineOnly}
          onValueChange={(value) => {
            void update("offlineOnly", value);
            if (value) void update("allowNetwork", false);
          }}
        />
        <ToggleRow
          label={t("settings.allowNetwork")}
          description={t("settings.networkWarning")}
          value={settings.allowNetwork}
          onValueChange={(value) => {
            void update("allowNetwork", value);
            if (value) void update("offlineOnly", false);
          }}
        />
        <ToggleRow
          label={t("settings.saveAudio")}
          description={t("settings.saveAudioDescription")}
          value={settings.saveAudio}
          onValueChange={(value) => void update("saveAudio", value)}
        />
      </Card>

      <SectionTitle title={t("settings.reminders")} />
      <Card>
        <SettingRow label={t("review.dailyGoal")} value={String(settings.dailyGoal)} icon="flag-outline" onPress={() => router.push("/review")} />
        <SettingRow label={t("review.reminderTime")} value={settings.reminderTime} icon="time-outline" onPress={() => router.push("/review")} last />
      </Card>

      <SectionTitle title={t("settings.privacy")} />
      <Card>
        <SettingRow label={t("privacy.title")} icon="shield-outline" onPress={() => router.push("/privacy")} />
        <SettingRow label={t("settings.backup")} icon="cloud-upload-outline" onPress={createBackup} />
        <SettingRow label={t("settings.restore")} icon="cloud-download-outline" onPress={restoreBackup} />
        <SettingRow label={t("settings.deleteRecordings")} icon="trash-outline" onPress={deleteRecordings} />
        <SettingRow label={t("settings.deleteData")} icon="warning-outline" onPress={deleteData} last />
      </Card>

      <SettingRow label={t("settings.about")} icon="information-circle-outline" onPress={() => router.push("/about")} />
      {message ? <TextBody style={{ color: colors.gold, textAlign: "center", marginBottom: 16 }}>{message}</TextBody> : null}

      <Modal visible={languageOpen} transparent animationType="slide" onRequestClose={() => setLanguageOpen(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setLanguageOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            {LANGUAGES.map((language) => (
              <Pressable
                key={language.id}
                onPress={() => {
                  void update("language", language.id);
                  setLanguageOpen(false);
                  Alert.alert(t("settings.language"), t("settings.restartRequired"));
                }}
                style={styles.languageRow}
              >
                <Text style={[styles.languageText, { color: colors.text }]}>{language.native}</Text>
                {locale === language.id ? <Text style={{ color: colors.gold }}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap" },
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  languageRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 16 },
  languageText: { fontFamily: FONTS.ui, fontSize: 16 },
});
