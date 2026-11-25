import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { addMistakes, addRecitation, completeReview, getSetting, setMemorization, setSetting } from "@/db";
import { SURAHS, getVerses, type Verse } from "@/data/quran";
import { arabicDigits } from "@/recitation/normalize";
import { analyzeRecitation, buildExpected, matchedPrefix, type RecitationReport } from "@/recitation/align";
import { analyzeTajweed, type TajweedFinding } from "@/recitation/tajweed";
import { checkSpeechCapabilities, downloadArabicModel, useSpeech, type SpeechCapabilities } from "@/asr/useSpeech";
import { useApp } from "@/state/AppContext";
import { AudioPreview } from "@/components/AudioPreview";
import { Button, Card, Chip, EmptyState, FONTS, Screen, SectionTitle, StatTile, TextBody } from "@/components/ui";

type Phase = "setup" | "session" | "report";

export default function ReciteScreen() {
  const params = useLocalSearchParams<{ surah?: string; from?: string; to?: string }>();
  const router = useRouter();
  const { t, locale, colors, settings, refresh } = useApp();
  const digits = locale === "ar" ? arabicDigits : (value: number) => String(value);

  const [phase, setPhase] = useState<Phase>("setup");
  const [surahId, setSurahId] = useState(Number(params.surah) || 1);
  const [from, setFrom] = useState(Number(params.from) || 1);
  const [to, setTo] = useState(Number(params.to) || 0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [caps, setCaps] = useState<SpeechCapabilities | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [report, setReport] = useState<RecitationReport | null>(null);
  const [findings, setFindings] = useState<TajweedFinding[]>([]);
  const [reportTab, setReportTab] = useState<"words" | "tajweed">("words");
  const [modelMessage, setModelMessage] = useState<string | null>(null);

  const matchedRef = useRef(0);
  const transcriptRef = useRef("");
  const transcriptPrefixRef = useRef("");
  const phaseRef = useRef<Phase>("setup");
  const finalizingRef = useRef(false);
  const audioUriRef = useRef<string | null>(null);
  const startTimeRef = useRef(0);
  const pausesRef = useRef<number[]>([]);
  const lastLoudRef = useRef(0);
  const lastPausePositionRef = useRef(-1);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const surah = SURAHS[surahId - 1];
  const endAyah = to || surah?.verses || 1;
  const verses = useMemo(
    () => getVerses(surahId, Math.max(1, from), Math.max(from, Math.min(endAyah, surah?.verses ?? 1))),
    [surahId, from, endAyah, surah?.verses],
  );
  const versesRef = useRef<Verse[]>(verses);
  versesRef.current = verses;
  phaseRef.current = phase;

  const expectedTokens = useMemo(
    () => buildExpected(verses.map((verse) => ({ surah: verse.surah, ayah: verse.ayah, text: verse.simple }))),
    [verses],
  );
  const tokensRef = useRef(expectedTokens);
  tokensRef.current = expectedTokens;

  useEffect(() => {
    void checkSpeechCapabilities().then(setCaps);
    void getSetting<TajweedFinding[]>("lastTajweed", []).then(setFindings);
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  const resetSession = useCallback(() => {
    matchedRef.current = 0;
    transcriptRef.current = "";
    transcriptPrefixRef.current = "";
    pausesRef.current = [];
    lastLoudRef.current = 0;
    lastPausePositionRef.current = -1;
    audioUriRef.current = null;
    finalizingRef.current = false;
    setMatched(0);
    setTranscript("");
    setHintsUsed(0);
    setHintVisible(false);
    setReport(null);
    setError(null);
  }, []);

  const finalize = useCallback(async () => {
    if (finalizingRef.current || phaseRef.current !== "session") return;
    finalizingRef.current = true;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    const currentVerses = versesRef.current;
    const spoken = transcriptRef.current.trim();
    const result = analyzeRecitation(
      currentVerses.map((verse) => ({ surah: verse.surah, ayah: verse.ayah, text: verse.simple })),
      spoken,
    );
    const tajweed = analyzeTajweed(currentVerses, result, pausesRef.current);
    const recitationId = await addRecitation({
      startKey: `${currentVerses[0]?.surah ?? surahId}:${currentVerses[0]?.ayah ?? from}`,
      endKey: `${currentVerses.at(-1)?.surah ?? surahId}:${currentVerses.at(-1)?.ayah ?? endAyah}`,
      startedAt: startTimeRef.current || Date.now(),
      durationMs: Date.now() - (startTimeRef.current || Date.now()),
      accuracy: result.accuracy,
      words: result.totalWords,
      errors: result.mistakes.length,
      transcript: spoken,
      audioUri: audioUriRef.current,
      offline: settings.offlineOnly,
    });
    await addMistakes(
      result.mistakes.map((mistake) => ({
        recitationId,
        surah: mistake.token.surah,
        ayah: mistake.token.ayah,
        expected: mistake.token.text,
        actual: mistake.actual ?? "",
        type: mistake.status === "match" ? "missing" : mistake.status,
        confidence: mistake.certainty === "confirmed" ? 0.95 : 0.55,
      })),
    );
    for (const verse of currentVerses) {
      const ayahResult = result.ayat.find((item) => item.surah === verse.surah && item.ayah === verse.ayah);
      const accuracy = ayahResult?.accuracy ?? 0;
      await setMemorization(verse.surah, verse.ayah, accuracy >= 0.9 ? "mastered" : accuracy >= 0.5 ? "review" : "learning");
    }
    await completeReview(currentVerses.length);
    await setSetting("lastTajweed", tajweed);
    setReport(result);
    setFindings(tajweed);
    setPhase("report");
    refresh();
  }, [surahId, from, endAyah, settings.offlineOnly, refresh]);

  const speech = useSpeech({
    onTranscript: (text) => {
      const fullText = [transcriptPrefixRef.current, text].filter(Boolean).join(" ");
      transcriptRef.current = fullText;
      setTranscript(fullText);
      const tokens = tokensRef.current.map((token) => token.text);
      const next = matchedPrefix(tokens, text, matchedRef.current);
      if (next !== matchedRef.current) {
        matchedRef.current = next;
        setMatched(next);
        setHintVisible(false);
      }
    },
    onVolume: (value) => {
      const now = Date.now();
      if (value > 0.2) lastLoudRef.current = now;
      else if (now - lastLoudRef.current > 1200 && matchedRef.current > 0 && lastPausePositionRef.current !== matchedRef.current) {
        lastPausePositionRef.current = matchedRef.current;
        pausesRef.current = [...pausesRef.current, matchedRef.current - 1];
      }
    },
    onError: (code, message) => {
      if (code === "aborted") return;
      setError(`${code}: ${message}`);
    },
    onAudioUri: (uri) => {
      audioUriRef.current = uri;
    },
    onEnd: () => {
      void finalize();
    },
  });

  const start = async () => {
    if (!caps || !caps.available) {
      setError(t("recite.notSupported"));
      return;
    }
    if (settings.offlineOnly && !caps.onDevice && !caps.arabicInstalled) {
      setError(t("recite.offlineBlocked"));
      return;
    }
    resetSession();
    startTimeRef.current = Date.now();
    setPhase("session");
    const context = Array.from(new Set(expectedTokens.map((token) => token.text))).slice(0, 20);
    const ok = await speech.start({
      offlineOnly: settings.offlineOnly,
      saveAudio: settings.saveAudio && caps.canPersistAudio,
      context,
    });
    if (!ok) {
      setPhase("setup");
      setError(t("recite.saveError"));
    }
  };

  const finish = () => {
    speech.stop();
    // The native `end` event normally finalises; this is a safety net for
    // platforms that do not emit it after `stop()`.
    stopTimerRef.current = setTimeout(() => void finalize(), 2500);
  };

  const abort = () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    finalizingRef.current = true;
    speech.abort();
    resetSession();
    setPhase("setup");
  };

  const repeatAyah = async () => {
    const token = expectedTokens[Math.min(matched, expectedTokens.length - 1)];
    if (!token) return;
    const startIndex = expectedTokens.findIndex((item) => item.surah === token.surah && item.ayah === token.ayah);
    speech.abort();
    transcriptPrefixRef.current = expectedTokens.slice(0, Math.max(0, startIndex)).map((item) => item.text).join(" ");
    transcriptRef.current = transcriptPrefixRef.current;
    setTranscript(transcriptRef.current);
    matchedRef.current = Math.max(0, startIndex);
    setMatched(Math.max(0, startIndex));
    pausesRef.current = [];
    finalizingRef.current = false;
    startTimeRef.current = Date.now();
    await speech.start({
      offlineOnly: settings.offlineOnly,
      saveAudio: settings.saveAudio && Boolean(caps?.canPersistAudio),
      context: Array.from(new Set(expectedTokens.map((item) => item.text))).slice(0, 20),
    });
  };

  const currentToken = expectedTokens[matched];
  const filteredSurahs = SURAHS.filter((item) =>
    item.name.includes(pickerQuery) || item.en.toLowerCase().includes(pickerQuery.toLowerCase()),
  );

  return (
    <Screen>
      {phase === "setup" && (
        <>
          <Card accent>
            <Text style={[styles.title, { color: colors.text }]}>{t("recite.title")}</Text>
            <TextBody muted>{t("recite.subtitle")}</TextBody>
          </Card>

          <CapabilityCard caps={caps} settings={settings} onDownload={async () => {
            setModelMessage(await downloadArabicModel());
            setCaps(await checkSpeechCapabilities());
          }} onSettings={() => router.push("/settings")} />

          <SectionTitle title={t("recite.chooseRange")} />
          <Card>
            <Pressable onPress={() => setPickerOpen(true)} style={[styles.surahPick, { backgroundColor: colors.surfaceAlt }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickLabel, { color: colors.muted }]}>{t("recite.surah")}</Text>
                <Text style={[styles.pickValue, { color: colors.text }]}>{digits(surahId)} — {surah?.name ?? ""}</Text>
              </View>
              <Ionicons name="chevron-down" size={22} color={colors.primary} />
            </Pressable>
            <View style={styles.rangeRow}>
              <NumberField label={t("recite.fromAyah")} value={from} max={surah?.verses ?? 1} onChange={(value) => setFrom(Math.max(1, Math.min(value, endAyah)))} digits={digits} />
              <NumberField label={t("recite.toAyah")} value={endAyah} max={surah?.verses ?? 1} onChange={(value) => setTo(Math.max(from, Math.min(value, surah?.verses ?? 1)))} digits={digits} />
            </View>
            <TextBody muted style={styles.rangeNote}>{verses.length} {t("common.verse")}</TextBody>
          </Card>

          {error ? <TextBody style={[styles.error, { color: colors.danger }]}>{error}</TextBody> : null}
          {modelMessage ? <TextBody muted style={styles.modelMessage}>{t("recite.modelMessage")}: {modelMessage}</TextBody> : null}

          <Button title={t("recite.start")} icon="mic" onPress={start} disabled={!caps?.available} />
          <Button title={t("mushaf.title")} variant="ghost" icon="book-outline" onPress={() => router.push({ pathname: "/mushaf/reader", params: { surah: surahId } })} />
        </>
      )}

      {phase === "session" && (
        <>
          <View style={[styles.liveHeader, { backgroundColor: colors.primaryDeep }]}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { color: colors.onPrimary }]}>{t("recite.listening")}</Text>
            <Text style={[styles.liveMeta, { color: colors.gold }]}>{digits(matched)} / {digits(expectedTokens.length)}</Text>
          </View>
          <TextBody muted style={styles.hideNote}>{t("recite.hideWords")}</TextBody>
          {error ? <TextBody style={[styles.error, { color: colors.danger }]}>{error}</TextBody> : null}

          <Card>
            {verses.map((verse) => {
              const firstIndex = expectedTokens.findIndex((item) => item.surah === verse.surah && item.ayah === verse.ayah);
              const tokens = expectedTokens.slice(firstIndex, firstIndex + verse.simple.split(/\s+/).filter(Boolean).length);
              const ayahStarted = matched > firstIndex;
              return (
                <View key={`${verse.surah}:${verse.ayah}`} style={styles.ayahBlock}>
                  <View style={styles.ayahLabelRow}>
                    <Text style={[styles.ayahLabel, { color: colors.muted }]}>{t("common.verse")} {digits(verse.ayah)}</Text>
                    {ayahStarted && matched < firstIndex + tokens.length ? (
                      <Pressable onPress={() => { setHintVisible(true); setHintsUsed((value) => value + 1); setTimeout(() => setHintVisible(false), 2500); }}>
                        <Ionicons name="bulb-outline" size={18} color={colors.gold} />
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.words}>
                    {tokens.map((token, index) => {
                      const globalIndex = firstIndex + index;
                      const revealed = globalIndex < matched;
                      const hint = hintVisible && globalIndex === matched;
                      return (
                        <Text
                          key={globalIndex}
                          style={[
                            styles.liveWord,
                            { color: revealed ? colors.text : colors.muted },
                            hint && { color: colors.gold, backgroundColor: colors.surfaceAlt },
                          ]}
                        >
                          {revealed || hint ? token.text : "•"}
                        </Text>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </Card>

          {matched >= expectedTokens.length ? (
            <TextBody style={{ color: colors.success, textAlign: "center" }}>{t("recite.recorded")}</TextBody>
          ) : null}
          {transcript ? <TextBody muted style={styles.transcript}>{t("recite.partialResult")}: {transcript}</TextBody> : null}

          <View style={styles.sessionButtons}>
            <Button title={t("recite.stop")} icon="checkmark" onPress={finish} />
            <View style={styles.rowButtons}>
              <Button title={t("recite.repeatAyah")} icon="refresh-outline" variant="secondary" onPress={repeatAyah} style={styles.rowButton} />
              <Button title={t("common.cancel")} icon="close-outline" variant="ghost" onPress={abort} style={styles.rowButton} />
            </View>
          </View>
        </>
      )}

      {phase === "report" && report && (
        <>
          <View style={[styles.reportHeader, { backgroundColor: colors.primaryDeep }]}>
            <Text style={[styles.reportTitle, { color: colors.onPrimary }]}>{t("recite.report")}</Text>
            <Text style={{ color: colors.gold, fontFamily: FONTS.ui, fontSize: 30, fontWeight: "700" }}>
              {digits(Math.round(report.accuracy * 100))}%
            </Text>
          </View>
          <View style={styles.statsRow}>
            <StatTile label={t("recite.errorsCount")} value={digits(report.mistakes.length)} icon="alert-circle-outline" />
            <StatTile label={t("recite.skipped")} value={digits(report.skipped.length)} icon="arrow-forward-outline" />
            <StatTile label={t("common.verse")} value={digits(report.ayat.length)} icon="book-outline" />
          </View>
          {audioUriRef.current && settings.saveAudio ? <AudioPreview uri={audioUriRef.current} /> : null}
          {hintsUsed > 0 ? <TextBody muted>{t("recite.hint")}: {digits(hintsUsed)}</TextBody> : null}

          <View style={styles.reportTabs}>
            <Chip label={t("recite.wordsTab")} active={reportTab === "words"} onPress={() => setReportTab("words")} />
            <Chip label={t("recite.tajweedTab")} active={reportTab === "tajweed"} onPress={() => setReportTab("tajweed")} />
          </View>
          {reportTab === "words" ? (
            report.mistakes.length ? (
              report.mistakes.map((mistake, index) => (
                <Card key={index}>
                  <Text style={[styles.mistakeRef, { color: colors.primary }]}>
                    {SURAHS[mistake.token.surah - 1]?.name} · {digits(mistake.token.ayah)} · {digits(mistake.token.index + 1)}
                  </Text>
                  <Text style={[styles.mistakeWord, { color: colors.text }]}>{mistake.token.text}</Text>
                  <TextBody muted>{t("mistakes.spoken")}: {mistake.actual || "—"} · {mistake.status}</TextBody>
                  <Chip label={mistake.certainty === "confirmed" ? t("common.confirmed") : t("common.needsReview")} color={mistake.certainty === "confirmed" ? colors.danger : colors.warning} />
                </Card>
              ))
            ) : (
              <EmptyState title={t("mushaf.khatm")} message={t("mistakes.empty")} icon="checkmark-circle-outline" />
            )
          ) : (
            <>
              <TextBody muted>{t("tajweed.disclaimer")}</TextBody>
              {findings.length ? (
                findings.map((finding, index) => (
                  <Card key={index}>
                    <Text style={[styles.mistakeRef, { color: colors.primary }]}>
                      {finding.surah}:{finding.ayah} · {finding.rule}
                    </Text>
                    <Text style={[styles.mistakeWord, { color: colors.text }]}>{finding.word}</Text>
                    <TextBody muted>{finding.detail}</TextBody>
                    <Chip label={t("common.needsReview")} color={colors.warning} />
                  </Card>
                ))
              ) : (
                <EmptyState title={t("tajweed.noFindings")} icon="sparkles-outline" />
              )}
            </>
          )}

          <View style={styles.sessionButtons}>
            <Button title={t("quiz.repeat")} icon="refresh-outline" onPress={() => { resetSession(); setPhase("setup"); }} />
            <Button title={t("home.testMemory")} variant="secondary" icon="help-circle-outline" onPress={() => router.push("/quiz")} />
          </View>
        </>
      )}

      <Modal visible={pickerOpen} animationType="slide" transparent>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <TextInput
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder={t("mushaf.searchPlaceholder")}
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <ScrollView style={styles.pickerList}>
              {filteredSurahs.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setSurahId(item.id);
                    setFrom(1);
                    setTo(0);
                    setPickerOpen(false);
                    setPickerQuery("");
                  }}
                  style={styles.pickerRow}
                >
                  <Text style={{ color: colors.muted, fontFamily: FONTS.ui }}>{digits(item.id)}</Text>
                  <Text style={{ color: colors.text, fontFamily: FONTS.ui, fontSize: 16, flex: 1 }}>{item.name}</Text>
                  {item.id === surahId ? <Ionicons name="checkmark" color={colors.gold} size={18} /> : null}
                </Pressable>
              ))}
            </ScrollView>
            <Button title={t("common.close")} variant="ghost" onPress={() => setPickerOpen(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function NumberField({ label, value, max, onChange, digits }: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
  digits: (value: number) => string;
}) {
  const { colors } = useApp();
  return (
    <View style={styles.numberField}>
      <Text style={[styles.pickLabel, { color: colors.muted }]}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => onChange(Math.max(1, value - 1))} hitSlop={10}><Ionicons name="remove-circle-outline" size={26} color={colors.primary} /></Pressable>
        <Text style={[styles.stepperValue, { color: colors.text }]}>{digits(value)}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + 1))} hitSlop={10}><Ionicons name="add-circle-outline" size={26} color={colors.primary} /></Pressable>
      </View>
    </View>
  );
}

function CapabilityCard({ caps, settings, onDownload, onSettings }: {
  caps: SpeechCapabilities | null;
  settings: { offlineOnly: boolean };
  onDownload: () => void;
  onSettings: () => void;
}) {
  const { t, colors } = useApp();
  if (!caps) return null;
  const blocked = settings.offlineOnly && !caps.onDevice && !caps.arabicInstalled;
  return (
    <Card style={blocked ? { borderColor: colors.warning } : undefined}>
      <View style={styles.capRow}>
        <Ionicons name={caps.available ? "checkmark-circle" : "alert-circle"} size={20} color={caps.available ? colors.success : colors.danger} />
        <Text style={[styles.capText, { color: colors.text }]}>
          {caps.available ? t("capability.available") : t("capability.unavailable")}
        </Text>
      </View>
      <View style={styles.capRow}>
        <Ionicons name={caps.onDevice ? "checkmark-circle" : "alert-circle"} size={20} color={caps.onDevice ? colors.success : colors.warning} />
        <Text style={[styles.capText, { color: colors.text }]}>
          {caps.onDevice ? t("capability.onDevice") : t("capability.noOnDevice")}
        </Text>
      </View>
      {blocked ? (
        <>
          <TextBody muted style={styles.capNote}>{t("recite.offlineHint")}</TextBody>
          <View style={styles.rowButtons}>
            <Button title={t("recite.downloadModel")} onPress={onDownload} variant="secondary" style={styles.rowButton} />
            <Button title={t("nav.settings")} onPress={onSettings} variant="ghost" style={styles.rowButton} />
          </View>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: FONTS.ui, fontSize: 20, fontWeight: "700", marginBottom: 6 },
  surahPick: { borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  pickLabel: { fontFamily: FONTS.ui, fontSize: 11 },
  pickValue: { fontFamily: FONTS.ui, fontSize: 17, fontWeight: "700", marginTop: 3 },
  rangeRow: { flexDirection: "row", gap: 10 },
  numberField: { flex: 1 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  stepperValue: { fontFamily: FONTS.ui, fontSize: 20, fontWeight: "700" },
  rangeNote: { textAlign: "center", marginTop: 12, fontSize: 12 },
  error: { fontFamily: FONTS.ui, marginVertical: 10, textAlign: "center" },
  modelMessage: { fontSize: 11, marginBottom: 8 },
  liveHeader: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, marginBottom: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#E46B5B", marginEnd: 10 },
  liveText: { fontFamily: FONTS.ui, fontWeight: "700", flex: 1 },
  liveMeta: { fontFamily: FONTS.ui },
  hideNote: { textAlign: "center", fontSize: 12, marginBottom: 10 },
  ayahBlock: { marginBottom: 14 },
  ayahLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ayahLabel: { fontFamily: FONTS.ui, fontSize: 12, marginBottom: 4 },
  words: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end" },
  liveWord: { fontFamily: FONTS.quran, fontSize: 27, lineHeight: 46, marginHorizontal: 4, minWidth: 18, textAlign: "center" },
  transcript: { fontSize: 11, marginTop: 8 },
  sessionButtons: { gap: 8, marginTop: 14 },
  rowButtons: { flexDirection: "row", gap: 8 },
  rowButton: { flex: 1 },
  reportHeader: { borderRadius: 18, padding: 18, alignItems: "center", marginBottom: 12 },
  reportTitle: { fontFamily: FONTS.ui, fontSize: 18, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  reportTabs: { flexDirection: "row", marginTop: 8, marginBottom: 6 },
  mistakeRef: { fontFamily: FONTS.ui, fontSize: 12, fontWeight: "700" },
  mistakeWord: { fontFamily: FONTS.quran, fontSize: 25, marginVertical: 6 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: "80%" },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontFamily: FONTS.ui, marginBottom: 10 },
  pickerList: { maxHeight: 420 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  capRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  capText: { fontFamily: FONTS.ui, fontSize: 13 },
  capNote: { fontSize: 11, marginTop: 4, marginBottom: 8 },
});
