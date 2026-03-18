// src/components/IncidentLogConfirmationScreen/IncidentPreviewCard.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  useWindowDimensions,
  Modal,
  Pressable,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../../theme/colors";

export type IncidentPreviewData = {
  incidentType: string;
  details: string;
  witnessName: string;
  witnessType: string;
  dateStr: string;
  timeStr: string;
  locationStr: string;

  photoCount?: number;
  photos?: string[];
  mode?: "complain" | "emergency";

  // AI analysis fields
  aiResult?: {
    confidence_score?: number;
    incident_tip?: string;
    submission_decision?: string; // "ALLOW" | "BLOCKED"
    allow_submission?: boolean;
    validation_reason?: string;
    risk_level?: string;
    risk_percentage?: number;
    [key: string]: any;
  } | null;
};

type Props = { data: IncidentPreviewData };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function IncidentPreviewCard({ data }: Props) {
  const TC = useColors();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const s = useMemo(() => clamp(screenWidth / 375, 0.9, 1.22), [screenWidth]);

  const [expandedUri, setExpandedUri] = useState<string | null>(null);

  const incidentType = data.incidentType?.trim() ? data.incidentType : "—";
  const details = data.details?.trim() ? data.details : "—";

  const witnessName = data.witnessName?.trim() ? data.witnessName : "—";
  const witnessType = data.witnessType?.trim() ? data.witnessType : "—";

  const photos = Array.isArray(data.photos) ? data.photos.filter(Boolean).slice(0, 3) : [];
  const fallbackCount = Math.min(Math.max(data.photoCount ?? 0, 0), 3);

  const PHOTO_H = Math.round(96 * s);
  const RADIUS = Math.round(18 * s);
  const ICON_SIZE = Math.round(32 * s);

  const TITLE = Math.round(16.5 * s);
  const TYPE_LINE = Math.round(15 * s);
  const DETAILS = Math.round(14.5 * s);
  const WITNESS_NAME = Math.round(15 * s);
  const WITNESS_TYPE = Math.round(14 * s);
  const META_LABEL = Math.round(14 * s);
  const META_VALUE = Math.round(14 * s);

  const CARD_PAD = Math.round(17 * s);
  const TITLE_MB = Math.round(10 * s);
  const DETAILS_LH = Math.round(22 * s);
  const SECTION_GAP = Math.round(16 * s);

  // ✅ Fixed card height (same behavior as before)
  const CARD_H = useMemo(() => {
    const target = screenHeight * 0.66;
    return Math.round(clamp(target, 460, 640));
  }, [screenHeight]);

  const closeExpanded = () => setExpandedUri(null);

  return (
    <>
      <View style={[styles.card, { padding: CARD_PAD, height: CARD_H, backgroundColor: TC.surface, borderColor: TC.divider }]}>
        {/* ✅ This wrapper uses flex so we can push meta down */}
        <View style={{ flex: 1 }}>
          {/* Top content (Incident details + photos + witness) */}
          <View>
            {/* Incident Detail */}
            <Text style={[styles.sectionTitle, { fontSize: TITLE, marginBottom: TITLE_MB, color: TC.textDark }]}>
              Incident Detail
            </Text>

            <Text
              style={[styles.smallLine, { fontSize: TYPE_LINE, marginBottom: Math.round(8 * s), color: TC.muted }]}
              numberOfLines={1}
            >
              {incidentType}
            </Text>

            <Text
              style={[styles.detailsItalic, { fontSize: DETAILS, lineHeight: DETAILS_LH, color: TC.textDark }]}
              numberOfLines={4}
            >
              {details}
            </Text>

            {/* Photos */}
            <View style={[styles.photoRow, { marginTop: Math.round(8 * s) }]}>
              {[0, 1, 2].map((i) => {
                const uri = photos[i];

                return (
                  <Pressable
                    key={i}
                    disabled={!uri}
                    onPress={() => uri && setExpandedUri(uri)}
                    style={[
                      styles.photoBox,
                      {
                        height: PHOTO_H,
                        borderRadius: RADIUS,
                        borderColor: TC.divider,
                        backgroundColor: TC.chipBg,
                      },
                    ]}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={styles.photoImg} />
                    ) : (
                      <Ionicons
                        name="image-outline"
                        size={ICON_SIZE}
                        color={
                          photos.length > 0
                            ? "#E1E7F0"
                            : i < fallbackCount
                              ? "#A7B3C2"
                              : "#E1E7F0"
                        }
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

           {/* Witness */}
        <View style={{ marginTop: Math.round(48 * s) }}>
          <Text
            style={[
              styles.sectionTitle,
              { fontSize: TITLE, marginBottom: TITLE_MB, color: TC.textDark },
            ]}>
          Witness
        </Text>
        <Text style={[styles.witnessName, { fontSize: WITNESS_NAME, color: TC.textDark }]} numberOfLines={1}>
          {witnessName}
        </Text>
        <Text style={[styles.witnessType, { fontSize: WITNESS_TYPE, color: TC.muted }]} numberOfLines={1}>
          {witnessType}
            </Text>
            </View>
          </View>

          {/* ✅ Meta block pushed DOWN */}
          <View style={{ marginTop: "auto", paddingTop: Math.round(18 * s) }}>
            {/* Date + Time */}
            <View style={[styles.metaRow, { marginTop: Math.round(14 * s) }]}>
              <View style={styles.metaPair}>
                <Text style={[styles.metaLabel, { fontSize: META_LABEL, color: TC.muted }]}>Date:</Text>
                <Text style={[styles.metaValue, { fontSize: META_VALUE, color: TC.textDark }]}>{data.dateStr || "—"}</Text>
              </View>

              <View style={styles.metaPair}>
                <Text style={[styles.metaLabel, { fontSize: META_LABEL, color: TC.muted }]}>Time:</Text>
                <Text style={[styles.metaValue, { fontSize: META_VALUE }]}>{data.timeStr || "—"}</Text>
              </View>
            </View>

            {/* Location */}
            <View style={[styles.locationRow, { marginTop: Math.round(10 * s) }]}>
              <Text style={[styles.metaLabel, { fontSize: META_LABEL }]}>Location:</Text>
              <Text
                style={[styles.metaValue, { fontSize: META_VALUE, flex: 1 }]}
                numberOfLines={3}
              >
                {data.locationStr || "—"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ✅ Fullscreen Image Modal */}
      <Modal
        visible={!!expandedUri}
        transparent
        animationType="fade"
        onRequestClose={closeExpanded}
        statusBarTranslucent={Platform.OS === "android"}
      >
        <StatusBar barStyle="light-content" />

        <Pressable style={styles.modalContainer} onPress={closeExpanded}>
          <Pressable
            onPress={closeExpanded}
            hitSlop={12}
            style={[
              styles.closeBtn,
              {
                top: Math.max(insets.top, 12),
                right: Math.max(insets.right, 12),
              },
            ]}
          >
            <Ionicons name="close" size={30} color="#FFF" />
          </Pressable>

          <Pressable onPress={() => {}} style={styles.imageWrap}>
            {expandedUri && (
              <Image
                source={{ uri: expandedUri }}
                style={{
                  width: screenWidth,
                  height: screenHeight,
                  resizeMode: "contain",
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const BORDER = "#E7EEF7";
const TEXT_DARK = "#0B2B45";
const TEXT_MUTED = "#6B7280";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
    overflow: "hidden",
  },

  sectionTitle: {
    fontWeight: "900",
    color: TEXT_DARK,
  },
  smallLine: {
    fontWeight: "900",
    color: TEXT_MUTED,
  },
  detailsItalic: {
    fontStyle: "italic",
    fontWeight: "700",
    color: TEXT_DARK,
    marginBottom: 10,
  },

  photoRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F2F6FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  witnessName: {
    fontWeight: "900",
    color: TEXT_DARK,
    marginBottom: 4,
  },
  witnessType: {
    fontWeight: "800",
    color: TEXT_MUTED,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaPair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaLabel: {
    fontWeight: "900",
    color: TEXT_MUTED,
  },
  metaValue: {
    fontWeight: "900",
    color: TEXT_DARK,
    flexShrink: 1,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },

  imageWrap: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  closeBtn: {
    position: "absolute",
    zIndex: 10,
    padding: 8,
  },
});