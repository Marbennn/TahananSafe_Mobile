// src/screens/IncidentLogConfirmationScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import IncidentPreviewCard, {
  IncidentPreviewData,
} from "../components/IncidentLogConfirmationScreen/IncidentPreviewCard";

import IncidentLogConfirmedScreen from "./IncidentLogConfirmedScreen";

import IncidentProgressHeader from "../components/IncidentLogScreen/IncidentProgressHeader";

import { PRIMARY_ACTION_COLOR } from "../theme/colors";
import { Typography } from "../theme/typography";

type ConfirmResult = {
  incidentId: string;
  createdAt?: string;
};

type Props = {
  data: IncidentPreviewData;
  onBack?: () => void;
  onConfirm?: () => Promise<ConfirmResult>;
  submitting?: boolean;
  onGoHome?: () => void;
  embedded?: boolean;
};

function clamp(
  n: number,
  min: number,
  max: number
) {
  return Math.max(min, Math.min(max, n));
}

function formatDateLine(iso?: string) {
  try {
    const d = iso
      ? new Date(iso)
      : new Date();

    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso || new Date().toISOString();
  }
}

export default function IncidentLogConfirmationScreen({
  data,
  onBack,
  onConfirm,
  submitting = false,
  onGoHome,
  embedded = false,
}: Props) {
  const insets = useSafeAreaInsets();

  const { width: screenWidth } =
    useWindowDimensions();

  const s = useMemo(
    () =>
      clamp(
        screenWidth / 375,
        0.9,
        1.2
      ),
    [screenWidth]
  );

  const isCompact = screenWidth < 360;

  const [stage, setStage] =
    useState<"preview" | "confirmed">(
      "preview"
    );

  const [
    confirmedAlertNo,
    setConfirmedAlertNo,
  ] = useState("");

  const [
    confirmedDateLine,
    setConfirmedDateLine,
  ] = useState("");

  const FOOTER_H = 84 * s;

  const CONTENT_BOTTOM_PAD =
    Math.max(insets.bottom, 10) +
    FOOTER_H +
    16;

  const FOOTER_BOTTOM_PAD =
    Platform.OS === "android"
      ? Math.min(
          Math.max(insets.bottom, 24),
          48
        )
      : Math.max(insets.bottom, 12);

  const handleConfirm = async () => {
    if (submitting) {
      return;
    }

    try {
      const result =
        await onConfirm?.();

      if (!result?.incidentId) {
        return;
      }

      setConfirmedAlertNo(
        result.incidentId
      );

      setConfirmedDateLine(
        formatDateLine(
          result.createdAt
        )
      );

      setStage("confirmed");
    } catch {
      // Parent handles the submit alert.
      // Keep preview visible.
    }
  };

  if (stage === "confirmed") {
    return (
      <IncidentLogConfirmedScreen
        alertNo={confirmedAlertNo}
        dateLine={confirmedDateLine}
        data={data}
        onGoHome={
          onGoHome ?? onBack
        }
      />
    );
  }

  const previewContent = (
    <View style={styles.page}>
      <ScrollView
        style={styles.previewScroll}
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom:
              CONTENT_BOTTOM_PAD,
          },
        ]}
      >
        <Text
          style={styles.reviewCopy}
          allowFontScaling={false}
        >
          Please verify the information
          below before submitting
        </Text>

        <IncidentPreviewCard
          data={data}
        />
      </ScrollView>

      <View
        style={[
          styles.footerSurface,
          {
            paddingBottom:
              FOOTER_BOTTOM_PAD,
          },
        ]}
      >
        <View style={styles.footer}>
          {/* EDIT BUTTON */}
          <Pressable
            disabled={submitting}
            onPress={onBack}
            style={({ pressed }) => [
              styles.editBtn,
              isCompact &&
                styles.editBtnCompact,
              (pressed ||
                submitting) && {
                opacity: 0.72,
              },
            ]}
          >
            <Text
              style={styles.editText}
              allowFontScaling={false}
            >
              Edit
            </Text>
          </Pressable>

          {/* CONFIRM BUTTON */}
          <Pressable
            disabled={submitting}
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.confirmBtn,
              (pressed ||
                submitting) && {
                opacity: 0.9,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : null}

            <Text
              style={styles.confirmText}
              allowFontScaling={false}
            >
              {submitting
                ? "Submitting..."
                : "Confirm"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (embedded) {
    return previewContent;
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top"]}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={BG}
      />

      <IncidentProgressHeader
        screenTitle="Incident Log Preview"
        step={2}
        stepTitle="Details"
        navigationIcon="chevron-back"
        navigationDisabled={
          submitting
        }
        onNavigationPress={onBack}
        animateFromStep={1}
      />

      {previewContent}
    </SafeAreaView>
  );
}

const BG = "#F5F7FA";

const NAVY =
  PRIMARY_ACTION_COLOR;

const TEXT_DARK = "#344052";

const TEXT_MUTED = "#7B7F86";

const BORDER = "#D9DEE5";

const styles =
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: BG,
    },

    page: {
      flex: 1,
      backgroundColor: BG,
    },

    previewScroll: {
      flex: 1,
    },

    /*
     * Matches IncidentLogScreen:
     * paddingHorizontal: 16
     * paddingTop: 16
     * gap: 16
     */
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      gap: 16,
      alignItems: "center",
    },

    /*
     * Supporting/instructional copy.
     *
     * IncidentLogScreen uses
     * Typography.body for supporting
     * text such as the Drafted line.
     */
    reviewCopy: {
      ...Typography.body,
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
      paddingHorizontal: 1,
      color: TEXT_MUTED,
    },

    /*
     * Footer follows the same
     * sizing rhythm as IncidentLogScreen.
     */
    footerSurface: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 8,
      paddingHorizontal: 29,
      backgroundColor: BG,
      borderTopWidth: 0,
      borderTopColor:
        "rgba(227,232,239,0.9)",
    },

    footer: {
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    /*
     * Secondary action.
     * Same button typography as
     * IncidentLogScreen.
     */
    editBtn: {
      width: 97,
      minHeight: 56,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },

    editBtnCompact: {
      width: 82,
    },

    editText: {
      ...Typography.button,
      color: NAVY,
    },

    /*
     * Primary action.
     *
     * Matches IncidentLogScreen's
     * submitBtn dimensions.
     */
    confirmBtn: {
      flex: 1,
      minHeight: 56,
      borderRadius: 28,
      backgroundColor: NAVY,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
    },

    confirmText: {
      ...Typography.button,
      color: "#FFFFFF",
    },
  });