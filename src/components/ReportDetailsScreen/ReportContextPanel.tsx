import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "../../theme/colors";
import { createTypography } from "../../theme/typography";

export type ReportContextData = {
  reference: string;
  title: string;
  description: string;
  statusLabel: string;
  statusColor?: string;
  statusBackgroundColor?: string;
  incidentDate?: string;
  incidentTime?: string;
  location?: string;
  reportedPerson?: string;
  witnessName?: string;
  witnessType?: string;
  evidenceCount?: number;
};

type DetailRowProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value?: string;
  styles: ReturnType<typeof makeStyles>;
  iconColor: string;
};

function cleanValue(value?: string) {
  const cleaned = String(value || "").trim();
  return cleaned && cleaned !== "-" && cleaned !== "—" ? cleaned : "";
}

function DetailRow({
  icon,
  label,
  value,
  styles,
  iconColor,
}: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel} allowFontScaling={false}>
          {label}
        </Text>
        <Text style={styles.detailValue} allowFontScaling={false}>
          {cleanValue(value) || "Not provided"}
        </Text>
      </View>
    </View>
  );
}

export default function ReportContextPanel({
  context,
}: {
  context: ReportContextData;
}) {
  const colors = useColors();
  const { width, height } = useWindowDimensions();
  const compact = height < 700;
  const scale = Math.min(Math.max(width / 390, 0.92), 1.12);
  const styles = useMemo(
    () => makeStyles(colors, scale, compact),
    [colors, compact, scale]
  );

  const hasPeople = Boolean(
    cleanValue(context.reportedPerson) || cleanValue(context.witnessName)
  );
  const evidenceCount = Math.max(0, Number(context.evidenceCount) || 0);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="document-text-outline"
                size={24}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow} allowFontScaling={false}>
                REPORT CONTEXT
              </Text>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {cleanValue(context.title) || "Incident Report"}
              </Text>
              <Text style={styles.heroReference} allowFontScaling={false}>
                Reference {cleanValue(context.reference) || "unavailable"}
              </Text>
            </View>
          </View>

          <View style={styles.heroMetaRow}>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    context.statusBackgroundColor || "rgba(255,255,255,0.18)",
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: context.statusColor || "#FFFFFF" },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: context.statusColor || "#FFFFFF" },
                ]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {cleanValue(context.statusLabel) || "Submitted"}
              </Text>
            </View>

          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons
                name="reader-outline"
                size={18}
                color={colors.primary}
              />
            </View>
            <Text style={styles.sectionTitle}>Incident summary</Text>
          </View>

          <Text style={styles.fieldLabel} allowFontScaling={false}>
            DESCRIPTION
          </Text>
          <View style={styles.descriptionBox}>
            <Text style={styles.descriptionText}>
              {cleanValue(context.description) || "No description provided."}
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.primary}
              />
            </View>
            <Text style={styles.sectionTitle}>Incident details</Text>
          </View>

          <DetailRow
            icon="calendar-outline"
            label="Incident date"
            value={context.incidentDate}
            styles={styles}
            iconColor={colors.primary}
          />
          <View style={styles.rowDivider} />
          <DetailRow
            icon="time-outline"
            label="Incident time"
            value={context.incidentTime}
            styles={styles}
            iconColor={colors.primary}
          />
          <View style={styles.rowDivider} />
          <DetailRow
            icon="location-outline"
            label="Location"
            value={context.location}
            styles={styles}
            iconColor={colors.primary}
          />

          {evidenceCount > 0 ? (
            <>
              <View style={styles.rowDivider} />
              <DetailRow
                icon="attach-outline"
                label="Evidence"
                value={`${evidenceCount} attachment${
                  evidenceCount === 1 ? "" : "s"
                }`}
                styles={styles}
                iconColor={colors.primary}
              />
            </>
          ) : null}
        </View>

        {hasPeople ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.sectionTitle}>People involved</Text>
            </View>

            {cleanValue(context.reportedPerson) ? (
              <DetailRow
                icon="person-outline"
                label="Reported person"
                value={context.reportedPerson}
                styles={styles}
                iconColor={colors.primary}
              />
            ) : null}

            {cleanValue(context.reportedPerson) &&
            cleanValue(context.witnessName) ? (
              <View style={styles.rowDivider} />
            ) : null}

            {cleanValue(context.witnessName) ? (
              <DetailRow
                icon="eye-outline"
                label={
                  cleanValue(context.witnessType)
                    ? `Witness · ${context.witnessType}`
                    : "Witness"
                }
                value={context.witnessName}
                styles={styles}
                iconColor={colors.primary}
              />
            ) : null}
          </View>
        ) : null}

      </ScrollView>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useColors>,
  scale: number,
  compact: boolean
) {
  const size = (value: number) => Math.round(value * scale);
  const type = createTypography(size, size);
  const cardBorder = colors.isDark ? "#334155" : "#DFE9F3";
  const softSurface = colors.isDark ? "#172033" : "#F7FAFD";

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.screenBg,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: size(14),
      paddingTop: size(compact ? 12 : 16),
      paddingBottom: size(28),
      gap: size(12),
    },
    heroCard: {
      borderRadius: size(20),
      padding: size(16),
      gap: size(14),
      backgroundColor: colors.isDark ? "#0B2B45" : "#062B49",
      overflow: "hidden",
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: size(12),
    },
    heroIcon: {
      width: size(44),
      height: size(44),
      borderRadius: size(14),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.14)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
    },
    heroEyebrow: {
      ...type.overline,
      color: "#BBD5EB",
    },
    heroTitle: {
      ...type.modalTitle,
      marginTop: size(2),
      color: "#FFFFFF",
    },
    heroReference: {
      ...type.microStrong,
      marginTop: size(4),
      color: "#C8D8E8",
    },
    heroMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: size(8),
    },
    statusPill: {
      minHeight: size(27),
      maxWidth: "70%",
      borderRadius: size(14),
      paddingHorizontal: size(10),
      flexDirection: "row",
      alignItems: "center",
      gap: size(6),
    },
    statusDot: {
      width: size(6),
      height: size(6),
      borderRadius: size(3),
    },
    statusText: {
      ...type.badge,
      flexShrink: 1,
    },
    sectionCard: {
      borderRadius: size(18),
      padding: size(15),
      gap: size(11),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: size(9),
      marginBottom: size(1),
    },
    sectionIcon: {
      width: size(31),
      height: size(31),
      borderRadius: size(10),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.isDark ? "#1E3A5F" : "#EEF6FF",
    },
    sectionTitle: {
      ...type.cardTitle,
      flex: 1,
      color: colors.textDark,
    },
    fieldLabel: {
      ...type.overline,
      color: colors.muted,
    },
    descriptionBox: {
      borderRadius: size(13),
      paddingHorizontal: size(13),
      paddingVertical: size(12),
      backgroundColor: softSurface,
      borderWidth: 1,
      borderColor: cardBorder,
    },
    descriptionText: {
      ...type.captionStrong,
      color: colors.textDark,
    },
    detailRow: {
      minHeight: size(42),
      flexDirection: "row",
      alignItems: "center",
      gap: size(11),
    },
    detailIcon: {
      width: size(33),
      height: size(33),
      borderRadius: size(11),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: softSurface,
    },
    detailCopy: {
      flex: 1,
      minWidth: 0,
      gap: size(2),
    },
    detailLabel: {
      ...type.overline,
      textTransform: "uppercase",
      color: colors.muted,
    },
    detailValue: {
      ...type.captionStrong,
      color: colors.textDark,
    },
    rowDivider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: size(44),
      backgroundColor: colors.divider,
    },
  });
}
