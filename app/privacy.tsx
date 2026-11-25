import React from "react";
import { Card, Screen, TextBody } from "@/components/ui";
import { useApp } from "@/state/AppContext";

export default function PrivacyScreen() {
  const { t } = useApp();
  return (
    <Screen>
      <Card accent>
        <TextBody>{t("privacy.body")}</TextBody>
      </Card>
    </Screen>
  );
}
