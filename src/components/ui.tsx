import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useApp } from "@/state/AppContext";

export const FONTS = { ui: "Tajawal", quran: "AmiriQuran" };

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useApp();
  const content = (
    <View style={[styles.screenContent, padded && styles.padded, style]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]} edges={["top", "left", "right"]}>
      {scroll ? <ScrollView contentContainerStyle={styles.scrollContent}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Card({
  children,
  onPress,
  style,
  accent,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
}) {
  const { colors } = useApp();
  const card = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: accent ? colors.gold : colors.border },
        accent && styles.accentBorder,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return card;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: colors.surfaceAlt }} style={styles.cardPress}>
      {card}
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, fontScale } = useApp();
  const backgrounds = {
    primary: colors.primary,
    secondary: colors.surfaceAlt,
    ghost: "transparent",
    danger: colors.danger,
  };
  const foregrounds = {
    primary: colors.onPrimary,
    secondary: colors.primary,
    ghost: colors.primary,
    danger: "#FFFFFF",
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: colors.gold }}
      style={[
        styles.button,
        { backgroundColor: backgrounds[variant] },
        variant !== "ghost" && { borderColor: colors.border },
        variant === "ghost" && { borderColor: "transparent" },
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={19} color={foregrounds[variant]} style={styles.buttonIcon} /> : null}
      <Text style={[styles.buttonText, { color: foregrounds[variant], fontSize: 15 * fontScale }]}>{title}</Text>
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors, fontScale } = useApp();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 18 * fontScale }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: colors.primary, fontSize: 13 * fontScale }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TextBody({ children, muted = false, style, quran = false }: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  quran?: boolean;
}) {
  const { colors, fontScale } = useApp();
  return (
    <Text
      style={[
        styles.body,
        { color: muted ? colors.muted : colors.text, fontSize: 14 * fontScale },
        quran && { fontFamily: FONTS.quran, fontSize: 24 * fontScale, lineHeight: 44 * fontScale },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Chip({ label, active, onPress, color }: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const { colors, fontScale } = useApp();
  const fill = active ? colors.primary : colors.surface;
  return (
    <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: fill, borderColor: color ?? colors.border }]}>
      <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.text, fontSize: 13 * fontScale }]}>{label}</Text>
    </Pressable>
  );
}

export function StatTile({ label, value, icon }: { label: string; value: string | number; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors, fontScale } = useApp();
  return (
    <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {icon ? <Ionicons name={icon} size={22} color={colors.gold} /> : null}
      <Text style={[styles.statValue, { color: colors.primary, fontSize: 23 * fontScale }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export function ProgressRing({ value, size = 110, label }: { value: number; size?: number; label?: string }) {
  const { colors } = useApp();
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={9} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.gold}
          strokeWidth={9}
          fill="none"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.ringValue, { color: colors.text }]}>{Math.round(clamped * 100)}%</Text>
      {label ? <Text style={[styles.ringLabel, { color: colors.muted }]}>{label}</Text> : null}
    </View>
  );
}

export function BarChart({ values, labels, color }: { values: number[]; labels?: string[]; color?: string }) {
  const { colors } = useApp();
  const max = Math.max(1, ...values);
  return (
    <View style={styles.chartRow}>
      {values.map((value, index) => (
        <View key={index} style={styles.chartColumn}>
          <View style={styles.chartTrack}>
            <View
              style={[
                styles.chartBar,
                {
                  height: `${Math.max(4, (value / max) * 100)}%`,
                  backgroundColor: color ?? colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.chartLabel, { color: colors.muted }]}>{labels?.[index] ?? index + 1}</Text>
        </View>
      ))}
    </View>
  );
}

export function EmptyState({ title, message, icon = "book-outline" }: { title: string; message?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useApp();
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={42} color={colors.gold} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {message ? <Text style={[styles.emptyMessage, { color: colors.muted }]}>{message}</Text> : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useApp();
  return <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />;
}

export function SettingRow({
  label,
  value,
  onPress,
  icon,
  last,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  last?: boolean;
}) {
  const { colors, fontScale } = useApp();
  return (
    <Pressable onPress={onPress} style={[styles.settingRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      {icon ? <Ionicons name={icon} size={21} color={colors.primary} style={styles.settingIcon} /> : null}
      <Text style={[styles.settingLabel, { color: colors.text, fontSize: 15 * fontScale }]}>{label}</Text>
      {value ? <Text style={[styles.settingValue, { color: colors.muted }]}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function ToggleRow({ label, description, value, onValueChange }: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useApp();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingEnd: 12 }}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        {description ? <Text style={[styles.toggleDescription, { color: colors.muted }]}>{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.surface} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screenContent: { flex: 1 },
  padded: { padding: 18 },
  scrollContent: { flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  accentBorder: { borderWidth: 1.5 },
  cardPress: { borderRadius: 18 },
  button: { minHeight: 52, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 18 },
  buttonText: { fontFamily: FONTS.ui, fontWeight: "700", fontSize: 15 },
  buttonIcon: { marginHorizontal: 7 },
  disabled: { opacity: 0.5 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 10 },
  sectionTitle: { fontFamily: FONTS.ui, fontSize: 18, fontWeight: "700" },
  sectionAction: { fontFamily: FONTS.ui, fontSize: 13, fontWeight: "600" },
  body: { fontFamily: FONTS.ui, lineHeight: 22 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 22, borderWidth: 1, marginEnd: 8, marginBottom: 8 },
  chipText: { fontFamily: FONTS.ui, fontSize: 13 },
  statTile: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, marginEnd: 8, alignItems: "flex-start", minHeight: 104 },
  statValue: { fontFamily: FONTS.ui, fontWeight: "700", marginTop: 6 },
  statLabel: { fontFamily: FONTS.ui, fontSize: 12 },
  ringValue: { fontFamily: FONTS.ui, fontSize: 22, fontWeight: "700" },
  ringLabel: { fontFamily: FONTS.ui, fontSize: 11 },
  chartRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 130 },
  chartColumn: { flex: 1, alignItems: "center", paddingHorizontal: 3 },
  chartTrack: { width: "70%", flex: 1, justifyContent: "flex-end" },
  chartBar: { width: "100%", borderRadius: 6, minHeight: 4 },
  chartLabel: { fontFamily: FONTS.ui, fontSize: 10, marginTop: 6 },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontFamily: FONTS.ui, fontSize: 17, fontWeight: "700", marginTop: 14 },
  emptyMessage: { fontFamily: FONTS.ui, fontSize: 13, textAlign: "center", marginTop: 6 },
  loading: { margin: 40 },
  settingRow: { flexDirection: "row", alignItems: "center", paddingVertical: 15 },
  settingIcon: { marginEnd: 12 },
  settingLabel: { fontFamily: FONTS.ui, fontSize: 15, flex: 1 },
  settingValue: { fontFamily: FONTS.ui, fontSize: 13, marginEnd: 8 },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  toggleDescription: { fontFamily: FONTS.ui, fontSize: 12, marginTop: 3 },
});
