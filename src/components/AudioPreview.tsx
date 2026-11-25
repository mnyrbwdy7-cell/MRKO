import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useApp } from "@/state/AppContext";
import { Button } from "./ui";

export function AudioPreview({ uri, title }: { uri: string; title?: string }) {
  const { t } = useApp();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  return (
    <Button
      title={title ?? t("recite.playRecording")}
      icon={status.playing ? "pause" : "play"}
      variant="secondary"
      onPress={() => {
        if (status.playing) player.pause();
        else {
          player.seekTo(0);
          player.play();
        }
      }}
    />
  );
}

export function AudioIcon({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  return (
    <Ionicons
      name={status.playing ? "pause-circle" : "play-circle"}
      size={28}
      color="#D8B45A"
      onPress={() => (status.playing ? player.pause() : player.play())}
    />
  );
}
