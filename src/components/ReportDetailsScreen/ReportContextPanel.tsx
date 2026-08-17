import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

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
  label: string;
  value?: string;
  styles: ReturnType<typeof makeStyles>;
};

function cleanValue(value?: string) {
  const cleaned = String(value || "").trim();

  return cleaned && cleaned !== "-" && cleaned !== "—"
    ? cleaned
    : "";
}

function DetailRow({
  label,
  value,
  styles,
}: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <Text
        style={styles.detailLabel}
        allowFontScaling={false}
      >
        {label}
      </Text>

      <Text
        style={styles.detailValue}
        allowFontScaling={false}
      >
        {cleanValue(value) || "Not provided"}
      </Text>
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

  const scale = Math.min(
    Math.max(width / 390, 0.92),
    1.12
  );

  const styles = useMemo(
    () => makeStyles(colors, scale, compact),
    [colors, compact, scale]
  );

  const hasPeople = Boolean(
    cleanValue(context.reportedPerson) ||
      cleanValue(context.witnessName)
  );

  const evidenceCount = Math.max(
    0,
    Number(context.evidenceCount) || 0
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* SINGLE REPORT CONTEXT CARD */}
        <View style={styles.contextCard}>
          {/* REPORT HEADER */}
          <View style={styles.contextHeader}>
            <Text
              style={styles.contextEyebrow}
              allowFontScaling={false}
            >
              REPORT CONTEXT
            </Text>

            <Text
              style={styles.contextTitle}
              numberOfLines={2}
            >
              {cleanValue(context.title) ||
                "Incident Report"}
            </Text>

            <Text
              style={styles.contextReference}
              allowFontScaling={false}
            >
              Reference{" "}
              {cleanValue(context.reference) ||
                "unavailable"}
            </Text>

            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      context.statusBackgroundColor ||
                      (colors.isDark
                        ? "#173B5C"
                        : "#EEF6FF"),
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        context.statusColor ||
                        colors.primary,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        context.statusColor ||
                        colors.primary,
                    },
                  ]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {cleanValue(
                    context.statusLabel
                  ) || "Submitted"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          {/* INCIDENT SUMMARY */}
          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
              allowFontScaling={false}
            >
              Incident summary
            </Text>

            <View style={styles.fieldGroup}>
              <Text
                style={styles.fieldLabel}
                allowFontScaling={false}
              >
                DESCRIPTION
              </Text>

              <View style={styles.descriptionBox}>
                <Text style={styles.descriptionText}>
                  {cleanValue(context.description) ||
                    "No description provided."}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          {/* INCIDENT DETAILS */}
          <View style={styles.section}>
            <Text
              style={styles.sectionTitle}
              allowFontScaling={false}
            >
              Incident details
            </Text>

            <View style={styles.detailsContainer}>
              <DetailRow
                label="Incident date"
                value={context.incidentDate}
                styles={styles}
              />

              <View style={styles.rowDivider} />

              <DetailRow
                label="Incident time"
                value={context.incidentTime}
                styles={styles}
              />

              <View style={styles.rowDivider} />

              <DetailRow
                label="Location"
                value={context.location}
                styles={styles}
              />

              {evidenceCount > 0 ? (
                <>
                  <View style={styles.rowDivider} />

                  <DetailRow
                    label="Evidence"
                    value={`${evidenceCount} attachment${
                      evidenceCount === 1
                        ? ""
                        : "s"
                    }`}
                    styles={styles}
                  />
                </>
              ) : null}
            </View>
          </View>

          {/* PEOPLE INVOLVED */}
          {hasPeople ? (
            <>
              <View style={styles.sectionDivider} />

              <View style={styles.section}>
                <Text
                  style={styles.sectionTitle}
                  allowFontScaling={false}
                >
                  People involved
                </Text>

                <View style={styles.detailsContainer}>
                  {cleanValue(
                    context.reportedPerson
                  ) ? (
                    <DetailRow
                      label="Reported person"
                      value={
                        context.reportedPerson
                      }
                      styles={styles}
                    />
                  ) : null}

                  {cleanValue(
                    context.reportedPerson
                  ) &&
                  cleanValue(
                    context.witnessName
                  ) ? (
                    <View
                      style={styles.rowDivider}
                    />
                  ) : null}

                  {cleanValue(
                    context.witnessName
                  ) ? (
                    <DetailRow
                      label={
                        cleanValue(
                          context.witnessType
                        )
                          ? `Witness · ${context.witnessType}`
                          : "Witness"
                      }
                      value={context.witnessName}
                      styles={styles}
                    />
                  ) : null}
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useColors>,
  scale: number,
  compact: boolean
) {
  const size = (value: number) =>
    Math.round(value * scale);

  const type = createTypography(size, size);

  const cardBorder = colors.isDark
    ? "#334155"
    : "#DFE9F3";

  const softSurface = colors.isDark
    ? "#172033"
    : "#F7FAFD";

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
    },

    /* SINGLE CARD */
    contextCard: {
      borderRadius: size(20),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: cardBorder,
      overflow: "hidden",

      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: {
        width: 0,
        height: 0,
      },

      elevation: 0,
    },

    /* HEADER */
    contextHeader: {
      paddingHorizontal: size(17),
      paddingTop: size(18),
      paddingBottom: size(17),
    },

    contextEyebrow: {
      ...type.overline,
      color: colors.primary,
      marginBottom: size(5),
    },

    contextTitle: {
      ...type.modalTitle,
      color: colors.textDark,
    },

    contextReference: {
      ...type.microStrong,
      color: colors.muted,
      marginTop: size(4),
    },

    statusRow: {
      marginTop: size(14),
      flexDirection: "row",
      alignItems: "center",
    },

    statusPill: {
      minHeight: size(28),
      maxWidth: "75%",
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

    /* SECTIONS */
    section: {
      paddingHorizontal: size(17),
      paddingVertical: size(17),
      gap: size(14),
    },

    sectionTitle: {
      ...type.cardTitle,
      color: colors.textDark,
    },

    sectionDivider: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: size(17),
      backgroundColor: colors.divider,
    },

    /* DESCRIPTION */
    fieldGroup: {
      gap: size(8),
    },

    fieldLabel: {
      ...type.overline,
      color: colors.muted,
    },

    descriptionBox: {
      minHeight: size(48),
      borderRadius: size(13),

      paddingHorizontal: size(13),
      paddingVertical: size(12),

      justifyContent: "center",

      backgroundColor: softSurface,

      borderWidth: 1,
      borderColor: cardBorder,
    },

    descriptionText: {
      ...type.captionStrong,
      color: colors.textDark,
      lineHeight: size(20),
    },

    /* DETAILS */
    detailsContainer: {
      gap: 0,
    },

    detailRow: {
      minHeight: size(55),
      justifyContent: "center",
      gap: size(4),
      paddingVertical: size(8),
    },

    detailLabel: {
      ...type.overline,
      textTransform: "uppercase",
      color: colors.muted,
    },

    detailValue: {
      ...type.captionStrong,
      color: colors.textDark,
      lineHeight: size(20),
    },

    rowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.divider,
    },
  });
}