// src/components/HomeScreen/RecentLogCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "../../theme/colors";
import { getReportStatusMeta, type ReportStatus } from "../../utils/reportStatus";
import { FontFamily, FontSize, FontWeight } from "../../theme/typography";

export type LogItem = {
  id: string;
  title: string;
  detail: string;
  dateLeft: string;
  timeLeft: string;
  dateRight: string;
  timeRight: string;
  updatedAt?: string;
  status?: ReportStatus;
  alertNo?: string;
};

type Props = {
  item: LogItem;
  onPress?: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeScale(width: number, height: number) {
  const baseW = 375;
  const baseH = 812;
  const scaleW = width / baseW;
  const scaleH = height / baseH;
  const s = clamp(Math.min(scaleW, scaleH) * 1.04, 0.88, 1.28);
  const fs = clamp(s * 1.06, 0.92, 1.32);
  return { s, fs };
}

function compactDate(value?: string) {
  const d = new Date(String(value || ""));
  if (Number.isNaN(d.getTime())) return value || "-";
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${month} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function RecentLogCard({ item, onPress }: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();
  const { s, fs } = useMemo(() => makeScale(width, height), [width, height]);
  const styles = useMemo(() => makeStyles(s, fs, TC), [s, fs, TC]);
  const status = getReportStatusMeta(item.status);
  const dateLine = `${compactDate(item.dateLeft)}${item.timeLeft && item.timeLeft !== "-" ? ` • ${item.timeLeft}` : ""}`;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress ? { opacity: 0.92, transform: [{ scale: 0.995 }] } : null,
      ]}
      hitSlop={8}
    >
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.reportNo} numberOfLines={1} allowFontScaling={false}>
            REP {item.alertNo || `#${item.id.slice(-6).toUpperCase()}`}
          </Text>

          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]} numberOfLines={1} allowFontScaling={false}>
              {status.shortLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={1} allowFontScaling={false}>
          {item.title || "Other"}
        </Text>

        <Text style={styles.detail} numberOfLines={2} ellipsizeMode="tail" allowFontScaling={false}>
          {item.detail || "-"}
        </Text>

        <View style={styles.bottomRow}>
          <Text style={styles.dateText} numberOfLines={1} allowFontScaling={false}>
            {dateLine}
          </Text>

          <View style={styles.viewDetailsRow}>
            <Text style={styles.viewDetailsText} numberOfLines={1} allowFontScaling={false}>
              View Details
            </Text>
            <Ionicons name="chevron-forward" size={clamp(Math.round(18 * fs), 16, 20)} color={TC.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function makeStyles(s: number, fs: number, TC: ReturnType<typeof useColors>) {
  const R = clamp(Math.round(14 * s), 12, 16);
  const PAD_X = clamp(Math.round(16 * s), 14, 18);
  const PAD_Y = clamp(Math.round(12 * s), 10, 14);
  const detailFont = clamp(
    Math.round(FontSize.body * fs),
    FontSize.caption,
    FontSize.bodyLarge,
  );
  const detailLine = clamp(Math.round(21 * fs), 18, 23);

  return StyleSheet.create({
    card: {
      borderRadius: R,
      backgroundColor: TC.surface,
      borderWidth: 1,
      borderColor: TC.divider,
      minHeight: clamp(Math.round(136 * s), 126, 150),
      shadowColor: "#000",
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
      overflow: "hidden",
    },

    body: {
      flex: 1,
      paddingHorizontal: PAD_X,
      paddingVertical: PAD_Y,
    },

    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: clamp(Math.round(12 * s), 10, 14),
      marginBottom: clamp(Math.round(6 * s), 4, 8),
    },

    reportNo: {
      fontFamily: FontFamily,
      flex: 1,
      fontSize: clamp(Math.round(FontSize.micro * fs), FontSize.micro, FontSize.overline),
      fontWeight: FontWeight.regular,
      color: "#9CA3AF",
    },

    statusPill: {
      borderRadius: 999,
      paddingHorizontal: clamp(Math.round(12 * s), 10, 14),
      paddingVertical: clamp(Math.round(6 * s), 5, 7),
      maxWidth: clamp(Math.round(150 * s), 124, 170),
    },

    statusText: {
      fontFamily: FontFamily,
      fontSize: clamp(
        Math.round(FontSize.overline * fs),
        FontSize.micro,
        FontSize.caption,
      ),
      fontWeight: FontWeight.bold,
      color: "#374151",
    },

    title: {
      fontFamily: FontFamily,
      fontSize: clamp(
        Math.round(FontSize.modalTitle * fs),
        FontSize.sectionTitle,
        FontSize.numeric,
      ),
      fontWeight: FontWeight.bold,
      color: "#0B2B45",
      lineHeight: clamp(Math.round(22 * fs), 20, 24),
    },

    detail: {
      fontFamily: FontFamily,
      marginTop: clamp(Math.round(2 * s), 1, 4),
      fontSize: detailFont,
      lineHeight: detailLine,
      fontWeight: FontWeight.regular,
      fontStyle: "italic",
      color: "#8A8F98",
    },

    bottomRow: {
      marginTop: clamp(Math.round(12 * s), 10, 14),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: clamp(Math.round(12 * s), 10, 14),
    },

    dateText: {
      fontFamily: FontFamily,
      flex: 1,
      fontSize: clamp(
        Math.round(FontSize.caption * fs),
        FontSize.overline,
        FontSize.label,
      ),
      fontWeight: FontWeight.regular,
      color: "#9CA3AF",
    },

    viewDetailsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: clamp(Math.round(4 * s), 3, 5),
    },

    viewDetailsText: {
      fontFamily: FontFamily,
      fontSize: clamp(
        Math.round(FontSize.caption * fs),
        FontSize.overline,
        FontSize.body,
      ),
      fontWeight: FontWeight.bold,
      color: TC.primary,
    },
  });
}
