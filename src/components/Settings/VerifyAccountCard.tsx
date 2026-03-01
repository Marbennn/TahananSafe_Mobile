// src/components/Settings/VerifyAccountCard.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getAccessToken } from "../../auth/session";
import {
  getVerificationStatusApi,
  submitVerificationApi,
  VerificationStatus,
} from "../../api/verification";

type Props = {
  // theme colors
  primary: string;
  divider: string;
  surface: string;

  // scaling helpers from screen
  scale: (n: number) => number;
  vscale: (n: number) => number;

  // user/account state
  user: any;
  userEmail: string;

  // kept in props (may be used elsewhere in SettingsScreen)
  bioEnabled: boolean;
  pinEnabled: boolean;

  // actions (kept in props for future use; not used since pill removed)
  onOpenAccount: () => void;
  onOpenPrivacySecurity: () => void;
  onOpenPinSetup: () => void;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function maskEmail(email: string) {
  const e = String(email || "").trim();
  if (!e.includes("@")) return e;
  const [name, domain] = e.split("@");
  if (name.length <= 2) return `${name[0] ?? ""}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

function displayNameFromEmail(email: string) {
  const e = String(email || "").trim();
  if (!e) return "Guest";
  if (!e.includes("@")) return e;
  const name = e.split("@")[0] || "User";
  const cleaned = name.replace(/[._-]+/g, " ").trim();
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type IdOption = {
  key: "passport" | "drivers_license" | "phil_id";
  label: string;
  sub: string;
};

const ID_OPTIONS: IdOption[] = [
  { key: "passport", label: "Passport", sub: "Valid passport photo" },
  { key: "drivers_license", label: "Driver’s License", sub: "Front side is required" },
  { key: "phil_id", label: "Philippine Valid ID", sub: "PhilSys, UMID, PRC, etc." },
];

// ✅ detect selfie verification from common backend fields (optional / future)
function isSelfieVerifiedFromUser(user: any) {
  const u = user ?? {};

  const directBool =
    u.selfieVerified === true ||
    u.isSelfieVerified === true ||
    u.selfieSubmitted === true ||
    u.hasSelfie === true ||
    u.has_selfie === true;

  const hasTimestamp =
    !!u.selfieVerifiedAt ||
    !!u.selfieSubmittedAt ||
    !!u.selfie_uploaded_at ||
    !!u.selfie_verified_at;

  const stringFlag =
    String(u.selfieVerified ?? "").toLowerCase() === "true" ||
    String(u.isSelfieVerified ?? "").toLowerCase() === "true" ||
    String(u.selfieSubmitted ?? "").toLowerCase() === "true" ||
    String(u.hasSelfie ?? "").toLowerCase() === "true";

  return !!(directBool || hasTimestamp || stringFlag);
}

// ✅ AsyncStorage keys (per account)
function selfieSubmittedKey(email: string) {
  return `tahanansafe_selfie_submitted_${String(email || "").trim().toLowerCase()}`;
}
function selfieUriKey(email: string) {
  return `tahanansafe_selfie_uri_${String(email || "").trim().toLowerCase()}`;
}

export default function VerifyAccountCard({
  primary,
  divider,
  surface,
  scale,
  vscale,
  user,
  userEmail,
  bioEnabled,
  pinEnabled,
}: Props) {
  const styles = useMemo(() => makeStyles(scale, vscale), [scale, vscale]);

  // ==========================
  // ✅ Backend verification status (FULL verification)
  // ==========================
  const [verStatus, setVerStatus] = useState<VerificationStatus>("none");
  const [verReason, setVerReason] = useState<string>("");
  const [verLoading, setVerLoading] = useState<boolean>(false);

  const refreshStatus = useCallback(async () => {
    if (!userEmail) {
      setVerStatus("none");
      setVerReason("");
      return;
    }

    try {
      setVerLoading(true);
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setVerStatus("none");
        setVerReason("");
        return;
      }
      const s = await getVerificationStatusApi({ accessToken });
      setVerStatus(s.status || "none");
      setVerReason(s.reason || "");
    } catch {
      setVerStatus("none");
      setVerReason("");
    } finally {
      setVerLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // ==========================
  // ✅ LOCAL selfie status (so stage=2 works now)
  // ==========================
  const [selfieLocalDone, setSelfieLocalDone] = useState(false);
  const [selfieLocalUri, setSelfieLocalUri] = useState<string>("");

  const loadSelfieLocal = useCallback(async () => {
    if (!userEmail) {
      setSelfieLocalDone(false);
      setSelfieLocalUri("");
      return;
    }
    try {
      const [flag, uri] = await Promise.all([
        AsyncStorage.getItem(selfieSubmittedKey(userEmail)),
        AsyncStorage.getItem(selfieUriKey(userEmail)),
      ]);
      setSelfieLocalDone(flag === "1");
      setSelfieLocalUri(uri ? String(uri) : "");
    } catch {
      setSelfieLocalDone(false);
      setSelfieLocalUri("");
    }
  }, [userEmail]);

  useEffect(() => {
    loadSelfieLocal();
  }, [loadSelfieLocal]);

  // ==========================
  // ✅ Verify progress logic
  // ==========================
  /**
   * RULES:
   * - Basic Level     = logged in
   * - Semi-verified   = Selfie submitted (local OR backend fields)
   * - Fully Verified  = ONLY if verStatus === "approved"
   */
  const hasLogin = !!userEmail;
  const selfieVerified = !!userEmail && (selfieLocalDone || isSelfieVerifiedFromUser(user));
  const isApproved = verStatus === "approved";

  // stage: 0..3
  let stage = 0;
  if (hasLogin) stage = 1;
  if (hasLogin && selfieVerified) stage = 2;
  if (isApproved) stage = 3;

  const verifyTitle =
    verStatus === "pending"
      ? "Under Review"
      : verStatus === "rejected"
        ? "Rejected"
        : stage === 3
          ? "Fully Verified"
          : stage === 2
            ? "Semi-verified"
            : stage === 1
              ? "Basic Level"
              : "Verify Account";

  const displayName = hasLogin ? displayNameFromEmail(userEmail) : "Guest";
  const displaySub = hasLogin ? maskEmail(userEmail) : "Not signed in";
  const displayPhoneLike = user?.phone ? String(user.phone) : "";

  const nodes = [
    { key: "basic", done: stage >= 1 },
    { key: "semi", done: stage >= 2 },
    { key: "full", done: stage >= 3 },
  ];

  const segmentsDone = clamp01((stage - 1) / (3 - 1)); // 0..1

  // ==========================
  // ✅ Selfie modal (Level 2 requirement)
  // ==========================
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string>("");
  const [selfieLoading, setSelfieLoading] = useState(false);

  const openSelfieModal = () => {
    if (!userEmail) {
      Alert.alert("Login required", "Please login first.");
      return;
    }
    setSelfieUri("");
    setSelfieModalVisible(true);
  };
  const closeSelfieModal = () => setSelfieModalVisible(false);

  // ==========================
  // ✅ ID modal (Full verification)
  // ==========================
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [idImageUri, setIdImageUri] = useState<string>("");
  const [idType, setIdType] = useState<IdOption["key"]>("phil_id");
  const [submitLoading, setSubmitLoading] = useState(false);

  const closeVerifyModal = () => setVerifyModalVisible(false);

  const canVerifyNow = !!userEmail && verStatus !== "pending" && verStatus !== "approved";

  // ✅ STEP-BY-STEP RULE: Verify Now opens different modal depending on stage
  const onPressVerifyNow = () => {
    if (!userEmail) {
      Alert.alert("Login required", "Please login first.");
      return;
    }

    // If user is still basic (stage 1) -> selfie first
    if (stage < 2) {
      openSelfieModal();
      return;
    }

    // If semi-verified (stage 2) -> open ID verification
    setVerifyModalVisible(true);
  };

  // ==========================
  // ✅ Permissions + Camera
  // ==========================
  const requestCameraPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required.");
      return false;
    }
    return true;
  }, []);

  const requestLibraryPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Media library permission is required.");
      return false;
    }
    return true;
  }, []);

  // ==========================
  // ✅ Selfie actions
  // ==========================
  const takeSelfie = useCallback(async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;

    const res = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
      cameraType: ImagePicker.CameraType.front,
    });

    if (!res.canceled && res.assets?.[0]?.uri) {
      setSelfieUri(res.assets[0].uri);
    }
  }, [requestCameraPermission]);

  const submitSelfie = useCallback(async () => {
    if (!userEmail) return;

    if (!selfieUri) {
      Alert.alert("Missing selfie", "Please take a selfie first.");
      return;
    }

    try {
      setSelfieLoading(true);

      await Promise.all([
        AsyncStorage.setItem(selfieSubmittedKey(userEmail), "1"),
        AsyncStorage.setItem(selfieUriKey(userEmail), selfieUri),
      ]);

      setSelfieLocalDone(true);
      setSelfieLocalUri(selfieUri);

      closeSelfieModal();
      Alert.alert("Selfie submitted", "You are now Semi-verified.");
    } catch {
      Alert.alert("Submit failed", "Unable to save selfie. Please try again.");
    } finally {
      setSelfieLoading(false);
    }
  }, [userEmail, selfieUri]);

  // ==========================
  // ✅ ID actions
  // ==========================
  const pickFromGallery = useCallback(async () => {
    const ok = await requestLibraryPermission();
    if (!ok) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!res.canceled && res.assets?.[0]?.uri) {
      setIdImageUri(res.assets[0].uri);
    }
  }, [requestLibraryPermission]);

  const takePhoto = useCallback(async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;

    const res = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
      cameraType: ImagePicker.CameraType.back,
    });

    if (!res.canceled && res.assets?.[0]?.uri) {
      setIdImageUri(res.assets[0].uri);
    }
  }, [requestCameraPermission]);

  const removeSelected = () => setIdImageUri("");

  const submitVerification = async () => {
    if (!userEmail) return;

    if (!idImageUri) {
      Alert.alert("Missing ID", "Please upload a valid ID photo before submitting.");
      return;
    }

    try {
      setSubmitLoading(true);

      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Session missing. Please login again.");

      const res = await submitVerificationApi({
        accessToken,
        idType,
        fileUri: idImageUri,
      });

      setVerStatus(res.status || "pending");
      setVerReason("");

      closeVerifyModal();
      Alert.alert("Submitted", "Your verification request was submitted for review.");
    } catch (e: any) {
      Alert.alert("Submit failed", e?.message || "Something went wrong.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // ==========================
  // ✅ Status chip display
  // ==========================
  const statusChip = (() => {
    if (!userEmail) return null;

    if (verLoading) {
      return (
        <View style={styles.statusPill}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.statusPillText}>Checking</Text>
        </View>
      );
    }

    if (verStatus === "pending") {
      return (
        <View style={styles.statusPill}>
          <Ionicons name="time-outline" size={scale(14)} color="#fff" />
          <Text style={styles.statusPillText}>Under review</Text>
        </View>
      );
    }

    if (verStatus === "approved") {
      return (
        <View style={styles.statusPill}>
          <Ionicons name="checkmark-circle-outline" size={scale(14)} color="#fff" />
          <Text style={styles.statusPillText}>Verified</Text>
        </View>
      );
    }

    if (verStatus === "rejected") {
      return (
        <View style={styles.statusPill}>
          <Ionicons name="close-circle-outline" size={scale(14)} color="#fff" />
          <Text style={styles.statusPillText}>Rejected</Text>
        </View>
      );
    }

    return null;
  })();

  /**
   * ✅ FIX:
   * Selfie should NOT replace the profile icon.
   * Only use real profile photo (user.photoURL). Otherwise show default icon.
   */
  const avatarUri = user?.photoURL ? String(user.photoURL) : "";

  return (
    <View style={[styles.verifyCard, { borderColor: divider, backgroundColor: surface }]}>
      <View style={[styles.verifyHeader, { backgroundColor: primary }]}>
        {/* Top row */}
        <View style={styles.verifyTopRow}>
          <View style={styles.verifyHeaderRow}>
            <View style={styles.verifyAvatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.verifyAvatarImg} />
              ) : (
                <View style={styles.verifyAvatarFallback}>
                  <Ionicons name="person" size={scale(22)} color="#fff" />
                </View>
              )}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.verifyName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.verifyContact} numberOfLines={1}>
                {displayPhoneLike ? displayPhoneLike : displaySub}
              </Text>
            </View>
          </View>

          <View style={styles.topRightWrap}>
            {!!statusChip && <View style={{ marginBottom: vscale(6) }}>{statusChip}</View>}

            <Pressable
              onPress={onPressVerifyNow}
              disabled={!canVerifyNow}
              android_ripple={{ color: "rgba(255,255,255,0.18)" }}
              style={({ pressed }) => [
                styles.verifyNowBtn,
                !canVerifyNow ? styles.verifyNowBtnDisabled : null,
                pressed ? { opacity: 0.92 } : null,
              ]}
              hitSlop={10}
            >
              <Text style={styles.verifyNowText}>
                {verStatus === "rejected" ? "Verify again" : "Verify now"}
              </Text>
              <Ionicons name="chevron-forward" size={scale(14)} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Progress stepper */}
        <View style={styles.stepperWrap}>
          <View style={styles.barOuter}>
            <View style={styles.barTrack} />
            <View style={[styles.barFill, { transform: [{ scaleX: segmentsDone }] }]} />

            <View style={styles.nodesRow}>
              {nodes.map((n) => (
                <View key={n.key} style={styles.nodeSlot}>
                  <View style={[styles.nodeCircle, n.done ? styles.nodeCircleDone : null]}>
                    {n.done ? (
                      <Ionicons name="checkmark" size={scale(14)} color={primary} />
                    ) : (
                      <View style={styles.nodeDot} />
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.labelsRow}>
            <View style={styles.labelCell}>
              <Text style={styles.stepLabel} numberOfLines={1}>
                Basic Level
              </Text>
            </View>
            <View style={styles.labelCell}>
              <Text style={styles.stepLabel} numberOfLines={1}>
                Semi-verified
              </Text>
            </View>
            <View style={styles.labelCell}>
              <Text style={styles.stepLabel} numberOfLines={1}>
                Fully Verified
              </Text>
            </View>
          </View>

          <Text style={styles.stepStatusText} numberOfLines={1}>
            Status: {verifyTitle}
          </Text>
          {verStatus === "rejected" && !!verReason ? (
            <Text style={styles.rejectedReason} numberOfLines={2}>
              Reason: {verReason}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ===================== */}
      {/* ✅ SELFIE MODAL (BASIC -> SEMI) */}
      {/* ===================== */}
      <Modal visible={selfieModalVisible} transparent animationType="fade" onRequestClose={closeSelfieModal}>
        <View style={styles.centerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSelfieModal} />

          <View style={[styles.centerCard, { backgroundColor: surface, borderColor: divider }]}>
            <View style={styles.centerHeader}>
              <View style={styles.centerHeaderLeft}>
                <View style={[styles.centerBadge, { backgroundColor: "rgba(30,99,208,0.10)" }]}>
                  <Ionicons name="camera-outline" size={scale(18)} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.centerTitle, { color: "#0F172A" }]}>Selfie verification</Text>
                  <Text style={[styles.centerSub, { color: "#64748B" }]}>
                    Take a clear selfie (front camera).
                  </Text>
                </View>
              </View>

              <Pressable onPress={closeSelfieModal} hitSlop={10} style={styles.centerCloseBtn}>
                <Ionicons name="close" size={scale(18)} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.previewWrap}>
              {selfieUri ? (
                <Image source={{ uri: selfieUri }} style={styles.previewImg} />
              ) : (
                <View style={[styles.previewPlaceholder, { borderColor: divider }]}>
                  <Ionicons name="person-circle-outline" size={scale(26)} color="#94A3B8" />
                  <Text style={[styles.previewText, { color: "#64748B" }]}>No selfie yet</Text>
                </View>
              )}
            </View>

            <View style={styles.uploadRow}>
              <Pressable
                onPress={takeSelfie}
                disabled={selfieLoading}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={[styles.uploadBtn, { borderColor: divider }]}
              >
                <Ionicons name="camera-outline" size={scale(16)} color={primary} />
                <Text style={[styles.uploadBtnText, { color: "#0F172A" }]}>Take selfie</Text>
              </Pressable>

              {!!selfieUri && (
                <Pressable
                  onPress={() => setSelfieUri("")}
                  disabled={selfieLoading}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  style={[styles.uploadBtn, { borderColor: divider }]}
                >
                  <Ionicons name="trash-outline" size={scale(16)} color="#DC2626" />
                  <Text style={[styles.uploadBtnText, { color: "#DC2626" }]}>Remove</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.centerActions}>
              <Pressable
                onPress={closeSelfieModal}
                disabled={selfieLoading}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={[styles.actionBtn, styles.actionGhost, { borderColor: divider }]}
              >
                <Text style={[styles.actionBtnText, { color: "#0F172A" }]}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={submitSelfie}
                disabled={selfieLoading}
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={[
                  styles.actionBtn,
                  { backgroundColor: primary, borderColor: primary },
                  selfieLoading ? { opacity: 0.85 } : null,
                ]}
              >
                {selfieLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Submit</Text>
                )}
              </Pressable>
            </View>

            <Text style={[styles.centerFoot, { color: "#64748B" }]}>
              Tip: Good lighting, no blur, face centered.
            </Text>

            {Platform.OS === "ios" ? <View style={{ height: vscale(2) }} /> : null}
          </View>
        </View>
      </Modal>

      {/* ===================== */}
      {/* ✅ ID MODAL (SEMI -> FULL) */}
      {/* ===================== */}
      <Modal visible={verifyModalVisible} transparent animationType="fade" onRequestClose={closeVerifyModal}>
        <View style={styles.centerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeVerifyModal} />

          <View style={[styles.centerCard, { backgroundColor: surface, borderColor: divider }]}>
            <View style={styles.centerHeader}>
              <View style={styles.centerHeaderLeft}>
                <View style={[styles.centerBadge, { backgroundColor: "rgba(30,99,208,0.10)" }]}>
                  <Ionicons name="id-card-outline" size={scale(18)} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.centerTitle, { color: "#0F172A" }]}>Verify your identity</Text>
                  <Text style={[styles.centerSub, { color: "#64748B" }]}>Upload a clear photo of a valid ID.</Text>
                </View>
              </View>

              <Pressable onPress={closeVerifyModal} hitSlop={10} style={styles.centerCloseBtn}>
                <Ionicons name="close" size={scale(18)} color="#64748B" />
              </Pressable>
            </View>

            <View style={[styles.typeBox, { borderColor: divider }]}>
              <Text style={[styles.typeTitle, { color: "#0F172A" }]}>Choose ID type</Text>

              <View style={styles.typeOptions}>
                {ID_OPTIONS.map((opt) => {
                  const active = idType === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setIdType(opt.key)}
                      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                      style={[
                        styles.typeOption,
                        { borderColor: divider },
                        active ? { borderColor: primary, backgroundColor: "rgba(30,99,208,0.06)" } : null,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.typeOptionLabel, { color: "#0F172A" }]}>{opt.label}</Text>
                        <Text style={[styles.typeOptionSub, { color: "#64748B" }]}>{opt.sub}</Text>
                      </View>
                      {active ? <Ionicons name="checkmark-circle" size={scale(18)} color={primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.previewWrap}>
              {idImageUri ? (
                <Image source={{ uri: idImageUri }} style={styles.previewImg} />
              ) : (
                <View style={[styles.previewPlaceholder, { borderColor: divider }]}>
                  <Ionicons name="image-outline" size={scale(22)} color="#94A3B8" />
                  <Text style={[styles.previewText, { color: "#64748B" }]}>No ID uploaded yet</Text>
                </View>
              )}
            </View>

            <View style={styles.uploadRow}>
              <Pressable
                onPress={pickFromGallery}
                disabled={submitLoading}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={[styles.uploadBtn, { borderColor: divider }]}
              >
                <Ionicons name="images-outline" size={scale(16)} color={primary} />
                <Text style={[styles.uploadBtnText, { color: "#0F172A" }]}>Gallery</Text>
              </Pressable>

              <Pressable
                onPress={takePhoto}
                disabled={submitLoading}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={[styles.uploadBtn, { borderColor: divider }]}
              >
                <Ionicons name="camera-outline" size={scale(16)} color={primary} />
                <Text style={[styles.uploadBtnText, { color: "#0F172A" }]}>Camera</Text>
              </Pressable>

              {!!idImageUri && (
                <Pressable
                  onPress={removeSelected}
                  disabled={submitLoading}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                  style={[styles.uploadBtn, { borderColor: divider }]}
                >
                  <Ionicons name="trash-outline" size={scale(16)} color="#DC2626" />
                  <Text style={[styles.uploadBtnText, { color: "#DC2626" }]}>Remove</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.centerActions}>
              <Pressable
                onPress={closeVerifyModal}
                disabled={submitLoading}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                style={[styles.actionBtn, styles.actionGhost, { borderColor: divider }]}
              >
                <Text style={[styles.actionBtnText, { color: "#0F172A" }]}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={submitVerification}
                disabled={submitLoading}
                android_ripple={{ color: "rgba(255,255,255,0.18)" }}
                style={[
                  styles.actionBtn,
                  { backgroundColor: primary, borderColor: primary },
                  submitLoading ? { opacity: 0.85 } : null,
                ]}
              >
                {submitLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Submit</Text>
                )}
              </Pressable>
            </View>

            <Text style={[styles.centerFoot, { color: "#64748B" }]}>
              Tip: Make sure the ID is readable and not blurry.
            </Text>

            {Platform.OS === "ios" ? <View style={{ height: vscale(2) }} /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const CARD_R = scale(18);
  const NODE = vscale(26);

  const ROW_PAD = scale(6);
  const TRACK_INSET = ROW_PAD + NODE / 2;

  return StyleSheet.create({
    verifyCard: {
      borderRadius: CARD_R,
      borderWidth: 1,
      overflow: "hidden",
      marginTop: vscale(10),
    },

    verifyHeader: {
      paddingHorizontal: scale(14),
      paddingTop: vscale(14),
      paddingBottom: vscale(12),
    },

    verifyTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: scale(10),
    },

    verifyHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(12),
      flex: 1,
      minWidth: 0,
    },

    topRightWrap: {
      alignItems: "flex-end",
      justifyContent: "flex-start",
      minWidth: scale(108),
    },

    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
      paddingHorizontal: scale(10),
      paddingVertical: vscale(6),
      borderRadius: vscale(14),
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.28)",
    },
    statusPillText: {
      color: "#fff",
      fontSize: scale(11),
      fontWeight: "900",
      letterSpacing: 0.2,
    },

    verifyNowBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(4),
      paddingHorizontal: scale(10),
      paddingVertical: vscale(6),
      borderRadius: vscale(14),
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.28)",
    },
    verifyNowBtnDisabled: {
      opacity: 0.55,
    },
    verifyNowText: {
      color: "#fff",
      fontSize: scale(11),
      fontWeight: "900",
      letterSpacing: 0.2,
    },

    verifyAvatarWrap: {
      width: vscale(52),
      height: vscale(52),
      borderRadius: vscale(26),
      overflow: "hidden",
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },
    verifyAvatarImg: { width: "100%", height: "100%" },
    verifyAvatarFallback: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },

    verifyName: {
      color: "#FFFFFF",
      fontSize: scale(16),
      fontWeight: "900",
      letterSpacing: 0.2,
    },
    verifyContact: {
      marginTop: vscale(2),
      color: "rgba(255,255,255,0.82)",
      fontSize: scale(12),
      fontWeight: "800",
      letterSpacing: 0.2,
    },

    stepperWrap: {
      marginTop: vscale(14),
      paddingBottom: vscale(2),
    },

    barOuter: {
      marginTop: vscale(4),
      paddingHorizontal: scale(6),
      paddingVertical: vscale(10),
    },

    barTrack: {
      position: "absolute",
      left: TRACK_INSET,
      right: TRACK_INSET,
      top: vscale(22),
      height: vscale(4),
      borderRadius: vscale(4),
      backgroundColor: "rgba(255,255,255,0.28)",
    },

    barFill: {
      position: "absolute",
      left: TRACK_INSET,
      right: TRACK_INSET,
      top: vscale(22),
      height: vscale(4),
      borderRadius: vscale(4),
      backgroundColor: "rgba(255,255,255,0.92)",
      transformOrigin: "left" as any,
    },

    nodesRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: ROW_PAD,
    },

    nodeSlot: {
      width: NODE,
      height: NODE,
      alignItems: "center",
      justifyContent: "center",
    },

    nodeCircle: {
      width: NODE,
      height: NODE,
      borderRadius: NODE / 2,
      backgroundColor: "rgba(255,255,255,0.25)",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },

    nodeCircleDone: {
      backgroundColor: "#FFFFFF",
      borderColor: "#FFFFFF",
    },

    nodeDot: {
      width: vscale(6),
      height: vscale(6),
      borderRadius: vscale(3),
      backgroundColor: "rgba(255,255,255,0.75)",
    },

    labelsRow: {
      marginTop: vscale(8),
      flexDirection: "row",
      alignItems: "flex-start",
    },
    labelCell: {
      flex: 1,
      alignItems: "center",
    },
    stepLabel: {
      textAlign: "center",
      color: "rgba(255,255,255,0.85)",
      fontSize: scale(10),
      fontWeight: "900",
    },

    stepStatusText: {
      marginTop: vscale(6),
      textAlign: "center",
      color: "rgba(255,255,255,0.9)",
      fontSize: scale(11),
      fontWeight: "900",
    },

    levelHintWrap: {
      marginTop: vscale(6),
      alignItems: "center",
      justifyContent: "center",
      gap: vscale(2),
    },
    levelHintLine: {
      textAlign: "center",
      color: "rgba(255,255,255,0.82)",
      fontSize: scale(10),
      fontWeight: "700",
    },

    rejectedReason: {
      marginTop: vscale(6),
      textAlign: "center",
      color: "rgba(255,255,255,0.86)",
      fontSize: scale(10),
      fontWeight: "700",
      lineHeight: scale(14),
    },

    centerOverlay: {
      flex: 1,
      backgroundColor: "rgba(15, 23, 42, 0.35)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(16),
    },

    centerCard: {
      width: "100%",
      maxWidth: 520,
      borderRadius: CARD_R,
      borderWidth: 1,
      padding: scale(14),
    },

    centerHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: scale(10),
    },
    centerHeaderLeft: { flexDirection: "row", alignItems: "center", gap: scale(10), flex: 1 },
    centerBadge: {
      width: vscale(40),
      height: vscale(40),
      borderRadius: vscale(14),
      alignItems: "center",
      justifyContent: "center",
    },
    centerTitle: { fontSize: scale(16), fontWeight: "900" },
    centerSub: { marginTop: vscale(2), fontSize: scale(11), fontWeight: "500", lineHeight: scale(15) },
    centerCloseBtn: {
      width: vscale(36),
      height: vscale(36),
      borderRadius: vscale(18),
      alignItems: "center",
      justifyContent: "center",
    },

    typeBox: {
      marginTop: vscale(12),
      borderWidth: 1,
      borderRadius: vscale(12),
      padding: scale(12),
      backgroundColor: "#FFFFFF",
    },
    typeTitle: { fontSize: scale(12), fontWeight: "900", marginBottom: vscale(10) },
    typeOptions: { gap: vscale(8) },
    typeOption: {
      borderWidth: 1,
      borderRadius: vscale(12),
      paddingHorizontal: scale(12),
      paddingVertical: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(10),
      backgroundColor: "#FFFFFF",
    },
    typeOptionLabel: { fontSize: scale(12), fontWeight: "900" },
    typeOptionSub: { marginTop: vscale(2), fontSize: scale(11), fontWeight: "500", lineHeight: scale(15) },

    previewWrap: { marginTop: vscale(12) },
    previewImg: {
      width: "100%",
      height: vscale(160),
      borderRadius: vscale(12),
      backgroundColor: "#F1F5F9",
    },
    previewPlaceholder: {
      width: "100%",
      height: vscale(160),
      borderRadius: vscale(12),
      borderWidth: 1,
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
      gap: vscale(6),
    },
    previewText: { fontSize: scale(12), fontWeight: "600" },

    uploadRow: {
      marginTop: vscale(12),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      flexWrap: "wrap",
      gap: scale(10),
    },
    uploadBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(8),
      borderWidth: 1,
      borderRadius: vscale(14),
      paddingHorizontal: scale(12),
      paddingVertical: vscale(8),
      backgroundColor: "#FFFFFF",
    },
    uploadBtnText: { fontSize: scale(12), fontWeight: "900" },

    centerActions: {
      marginTop: vscale(14),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: scale(10),
    },
    actionBtn: {
      minWidth: scale(110),
      height: vscale(42),
      borderRadius: vscale(21),
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(14),
    },
    actionGhost: { backgroundColor: "transparent" },
    actionBtnText: { fontSize: scale(14), fontWeight: "900" },

    centerFoot: {
      marginTop: vscale(10),
      fontSize: scale(11),
      fontWeight: "500",
      lineHeight: scale(15),
    },
  });
}