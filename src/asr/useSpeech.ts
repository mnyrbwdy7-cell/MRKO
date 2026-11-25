import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionErrorCode,
} from "expo-speech-recognition";

export interface SpeechCapabilities {
  available: boolean;
  onDevice: boolean;
  installedLocales: string[];
  arabicInstalled: boolean;
  canPersistAudio: boolean;
  platform: string;
}

export async function checkSpeechCapabilities(): Promise<SpeechCapabilities> {
  let installedLocales: string[] = [];
  let available = false;
  let onDevice = false;
  let canPersistAudio = false;
  try {
    available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    onDevice = ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    canPersistAudio = ExpoSpeechRecognitionModule.supportsRecording();
  } catch {
    available = false;
  }
  try {
    const locales = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    installedLocales = locales.installedLocales ?? [];
  } catch {
    // Not supported on older Android / iOS: capability is inferred from onDevice.
  }
  return {
    available,
    onDevice,
    installedLocales,
    arabicInstalled: installedLocales.some((locale) => locale.toLowerCase().startsWith("ar")),
    canPersistAudio,
    platform: Platform.OS,
  };
}

export async function requestSpeechPermission(): Promise<boolean> {
  try {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}

export async function downloadArabicModel(): Promise<string> {
  if (Platform.OS !== "android") return "ينبغي تنزيل العربية في إعدادات التعرف على الكلام بنظام iOS.";
  try {
    const result = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: "ar-SA" });
    return result.message;
  } catch (error) {
    return error instanceof Error ? error.message : "تعذّر بدء تنزيل النموذج.";
  }
}

export interface SpeechHandlers {
  onTranscript: (text: string, final: boolean) => void;
  onVolume?: (value: number) => void;
  onError?: (code: ExpoSpeechRecognitionErrorCode, message: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onAudioUri?: (uri: string) => void;
}

export interface SpeechStartOptions {
  offlineOnly: boolean;
  saveAudio: boolean;
  language?: string;
  context?: string[];
}

export function useSpeech(handlers: SpeechHandlers) {
  const callbacks = useRef(handlers);
  callbacks.current = handlers;
  const finals = useRef<string[]>([]);
  const partial = useRef("");
  const [listening, setListening] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [usedOffline, setUsedOffline] = useState(false);

  useSpeechRecognitionEvent("start", () => {
    setListening(true);
    setLastError(null);
    callbacks.current.onStart?.();
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results.map((result) => result.transcript).join(" ").trim();
    if (event.isFinal) {
      if (transcript) finals.current.push(transcript);
      partial.current = "";
    } else {
      partial.current = transcript;
    }
    callbacks.current.onTranscript([...finals.current, partial.current].filter(Boolean).join(" "), event.isFinal);
  });

  useSpeechRecognitionEvent("volumechange", (event) => {
    callbacks.current.onVolume?.(event.value);
  });

  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    setLastError(`${event.error}: ${event.message}`);
    callbacks.current.onError?.(event.error, event.message);
  });

  useSpeechRecognitionEvent("nomatch", () => {
    callbacks.current.onTranscript("", true);
  });

  useSpeechRecognitionEvent("audioend", (event) => {
    if (event.uri) callbacks.current.onAudioUri?.(event.uri);
  });

  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    callbacks.current.onEnd?.();
  });

  const start = useCallback(
    async (options: SpeechStartOptions): Promise<boolean> => {
      const granted = await requestSpeechPermission();
      if (!granted) {
        setLastError("not-allowed: الإذن بالميكروفون مرفوض");
        return false;
      }
      finals.current = [];
      partial.current = "";
      setUsedOffline(options.offlineOnly);
      try {
        ExpoSpeechRecognitionModule.start({
          lang: options.language ?? "ar-SA",
          interimResults: true,
          continuous: Platform.OS !== "ios",
          requiresOnDeviceRecognition: options.offlineOnly,
          addsPunctuation: false,
          androidIntentOptions: options.offlineOnly ? { EXTRA_PREFER_OFFLINE: true } : undefined,
          contextualStrings: options.context?.slice(0, 20),
          recordingOptions: options.saveAudio ? { persist: true } : undefined,
        });
        return true;
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "تعذّر بدء التسميع");
        return false;
      }
    },
    [],
  );

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // Already stopped.
    }
  }, []);

  const abort = useCallback(() => {
    finals.current = [];
    partial.current = "";
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Already stopped.
    }
    setListening(false);
  }, []);

  return { listening, lastError, usedOffline, start, stop, abort };
}
