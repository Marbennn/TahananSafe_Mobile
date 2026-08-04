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
import IncidentLocationMapModal, {
  hasValidLocationCoords,
  type IncidentMapCoords,
} from "../IncidentLocationMapModal";

export type IncidentPreviewData = {
  incidentType: string;
  details: string;
  offenderName?: string;
  witnessName: string;
  witnessType: string;
  dateStr: string;
  timeStr: string;
  locationStr: string;
  latitude?: number | null;
  longitude?: number | null;

  photoCount?: number;
  photos?: string[];
  videoCount?: number;
  videos?: string[];
  mode?: "complain" | "emergency";

  aiResult?: {
    confidence_score?: number;
    incident_tip?: string;
    submission_decision?: string;
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

function displayValue(value?: string, fallback = "None") {
  const clean = String(value || "").trim();
  return clean || fallback;
}

export default function IncidentPreviewCard({ data }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [expandedUri, setExpandedUri] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const contentWidth = Math.min(Math.max(screenWidth - 34, 0), 680);

  const photos = Array.isArray(data.photos) ? data.photos.filter(Boolean).slice(0, 3) : [];
  const videos = Array.isArray(data.videos) ? data.videos.filter(Boolean).slice(0, 1) : [];
  const declaredPhotoCount = Math.min(Math.max(data.photoCount ?? photos.length, 0), 3);
  const declaredVideoCount = Math.min(Math.max(data.videoCount ?? videos.length, 0), 1);
  const evidenceCount = declaredPhotoCount + declaredVideoCount;
  const mapCoords = useMemo<IncidentMapCoords | null>(() => {
    const coords = {
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
    };
    return hasValidLocationCoords(coords) ? coords : null;
  }, [data.latitude, data.longitude]);

  const thumbSize = useMemo(
    () => Math.round(clamp((contentWidth - 70) / 3, 64, 190)),
    [contentWidth]
  );

  const evidenceSlots = useMemo(() => {
    const imageSlots = photos.map((uri) => ({ type: "photo" as const, uri }));
    const videoSlots = videos.map((uri) => ({ type: "video" as const, uri }));
    const placeholders = Array.from({
      length: Math.max(evidenceCount - imageSlots.length - videoSlots.length, 0),
    }).map(() => ({ type: "placeholder" as const, uri: "" }));

    return [...imageSlots, ...videoSlots, ...placeholders].slice(0, 3);
  }, [evidenceCount, photos, videos]);

  const closeExpanded = () => setExpandedUri(null);

  return (
    <>
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle} allowFontScaling={false}>
          Incident Information
        </Text>

        <Text style={styles.label} allowFontScaling={false}>
          Description
        </Text>
        <View style={styles.descriptionBox}>
          <Text style={styles.descriptionText}>{displayValue(data.details)}</Text>
        </View>

        <Text style={styles.label} allowFontScaling={false}>
          Complaint
        </Text>
        <View style={styles.valueBox}>
          <Text style={styles.valueText} numberOfLines={2}>
            {displayValue(data.offenderName)}
          </Text>
        </View>

        <View style={styles.witnessRow}>
          <View style={styles.witnessCol}>
            <Text style={styles.label} allowFontScaling={false}>
              Witness
            </Text>
            <View style={styles.valueBox}>
              <Text style={styles.valueText} numberOfLines={2}>
                {displayValue(data.witnessName)}
              </Text>
            </View>
          </View>

          <View style={styles.witnessCol}>
            <Text style={styles.label} allowFontScaling={false}>
              Relationship
            </Text>
            <View style={styles.valueBox}>
              <Text style={styles.valueText} numberOfLines={2}>
                {displayValue(data.witnessType)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeCol}>
            <Text style={styles.label} allowFontScaling={false}>
              Date
            </Text>
            <Text style={styles.plainValue} numberOfLines={1}>
              {displayValue(data.dateStr)}
            </Text>
          </View>
          <View style={styles.dateTimeCol}>
            <Text style={styles.label} allowFontScaling={false}>
              Time
            </Text>
            <Text style={styles.plainValue} numberOfLines={1}>
              {displayValue(data.timeStr)}
            </Text>
          </View>
        </View>

        <View style={styles.locationHeaderRow}>
          <Text style={[styles.label, styles.locationLabel]} allowFontScaling={false}>
            Location
          </Text>
          <Pressable
            disabled={!mapCoords}
            onPress={() => setShowMap(true)}
            style={({ pressed }) => [
              styles.showMapBtn,
              pressed && { opacity: 0.78 },
              !mapCoords && styles.showMapBtnDisabled,
            ]}
          >
            <Ionicons
              name="map-outline"
              size={15}
              color={mapCoords ? "#00518D" : "#94A3B8"}
            />
            <Text
              style={[
                styles.showMapText,
                !mapCoords && styles.showMapTextDisabled,
              ]}
              allowFontScaling={false}
            >
              Show in Map
            </Text>
          </Pressable>
        </View>
        <Text style={styles.locationText}>
          {displayValue(data.locationStr, "Not shared")}
        </Text>
      </View>

      <View style={styles.evidenceCard}>
        <View style={styles.evidenceHeader}>
          <Text style={styles.cardTitle} allowFontScaling={false}>
            Evidence
          </Text>
          <Text style={styles.fileCount} allowFontScaling={false}>
            {evidenceCount} {evidenceCount === 1 ? "File" : "Files"}
          </Text>
        </View>

        {evidenceSlots.length > 0 ? (
          <View style={styles.evidenceRow}>
            {evidenceSlots.map((item, index) => {
              const isPhoto = item.type === "photo" && item.uri;
              const isVideo = item.type === "video" && item.uri;

              return (
                <Pressable
                  key={`${item.type}-${item.uri || index}`}
                  disabled={!isPhoto}
                  onPress={() => isPhoto && setExpandedUri(item.uri)}
                  style={[
                    styles.thumbBox,
                    { width: thumbSize, height: thumbSize },
                  ]}
                >
                  {isPhoto ? (
                    <Image source={{ uri: item.uri }} style={styles.thumbImage} />
                  ) : (
                    <View style={styles.emptyThumb}>
                      <Ionicons
                        name={isVideo ? "play-circle-outline" : "image-outline"}
                        size={28}
                        color="#344052"
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyEvidence}>No evidence attached</Text>
        )}
      </View>

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
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </Pressable>

          <Pressable onPress={() => {}} style={styles.imageWrap}>
            {expandedUri ? (
              <Image
                source={{ uri: expandedUri }}
                style={{
                  width: screenWidth,
                  height: screenHeight,
                  resizeMode: "contain",
                }}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <IncidentLocationMapModal
        visible={showMap}
        coords={mapCoords}
        label={data.locationStr || "Incident location"}
        onClose={() => setShowMap(false)}
      />
    </>
  );
}

const BORDER = "#D7D7D7";
const TEXT_DARK = "#344052";
const TEXT_VALUE = "#001F3F";
const TEXT_MUTED = "#818181";

const styles = StyleSheet.create({
  infoCard: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 24,
    paddingHorizontal: 23,
    paddingTop: 27,
    paddingBottom: 46,
  },
  evidenceCard: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 24,
    paddingHorizontal: 23,
    paddingTop: 23,
    paddingBottom: 14,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  label: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "800",
    color: TEXT_MUTED,
  },
  descriptionBox: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
    color: TEXT_VALUE,
  },
  valueBox: {
    minHeight: 43,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 9,
    paddingHorizontal: 13,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  valueText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500",
    color: TEXT_VALUE,
  },
  witnessRow: {
    flexDirection: "row",
    gap: 18,
  },
  witnessCol: {
    flex: 1,
    minWidth: 0,
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 18,
  },
  dateTimeCol: {
    flex: 1,
  },
  plainValue: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    color: TEXT_VALUE,
  },
  locationHeaderRow: {
    marginTop: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  locationLabel: {
    marginTop: 0,
    marginBottom: 0,
  },
  locationText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    color: TEXT_VALUE,
  },
  showMapBtn: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CFE0EF",
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  showMapBtnDisabled: {
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },
  showMapText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#00518D",
  },
  showMapTextDisabled: {
    color: "#94A3B8",
  },
  evidenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 15,
  },
  fileCount: {
    fontSize: 15,
    fontWeight: "500",
    color: TEXT_MUTED,
  },
  evidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  thumbBox: {
    borderWidth: 1,
    borderColor: "#B8B5FF",
    borderRadius: 4,
    padding: 3,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
    borderRadius: 3,
    resizeMode: "cover",
  },
  emptyThumb: {
    flex: 1,
    borderRadius: 3,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyEvidence: {
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_MUTED,
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
