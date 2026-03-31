// src/components/Settings/VerifyAccountCard.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "../../theme/colors";
import { getAccessToken } from "../../auth/session";
import {
  getVerificationStatusApi,
  submitVerificationApi,
  VerificationStatus,
} from "../../api/verification";

type Props = {
  primary: string;
  divider: string;
  surface: string;
  scale: (n: number) => number;
  vscale: (n: number) => number;
  user: any;
  userEmail: string;
  bioEnabled: boolean;
  pinEnabled: boolean;
  onOpenAccount: () => void;
  onOpenPrivacySecurity: () => void;
  onOpenPinSetup: () => void;
};

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
  { key: "drivers_license", label: "Driver's License", sub: "Front side is required" },
  { key: "phil_id", label: "Philippine Valid ID", sub: "PhilSys, UMID, PRC, etc." },
];

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

function selfieSubmittedKey(email: string) {
  return `tahanansafe_selfie_submitted_${String(email || "").trim().toLowerCase()}`;
}
function selfieUriKey(email: string) {
  return `tahanansafe_selfie_uri_${String(email || "").trim().toLowerCase()}`;
}

/* ── Verify Now button with sliding light ── */
function VerifyNowButton({
  onPress,
  label,
  primary,
  scale,
  styles,
}: {
  onPress: () => void;
  label: string;
  primary: string;
  scale: (n: number) => number;
  styles: any;
}) {
  const shimmer = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    shimmer.setValue(-1);
    Animated.timing(shimmer, {
      toValue: 2,
      duration: 2400,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
    return () => shimmer.stopAnimation();
  }, [shimmer]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.88 }]}
      hitSlop={6}
    >
      <LinearGradient
        colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.ctaGradient, { overflow: "hidden" as const }]}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            transform: [
              {
                translateX: shimmer.interpolate({
                  inputRange: [-1, 2],
                  outputRange: [-120, 400],
                }),
              },
            ],
          }}
        >
          <LinearGradient
            colors={[
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0.08)",
              "rgba(255,255,255,0.28)",
              "rgba(255,255,255,0.08)",
              "rgba(255,255,255,0)",
            ]}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: 120, height: "100%" }}
          />
        </Animated.View>
        <Text style={styles.ctaText}>{label}</Text>
        <View style={styles.ctaArrow}>
          <Ionicons name="arrow-forward" size={scale(14)} color={primary} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/* ── Step node with animated check ── */
function StepNode({
  done,
  active,
  size,
  primary,
  scale,
}: {
  done: boolean;
  active: boolean;
  size: number;
  primary: string;
  scale: (n: number) => number;
}) {
  const pop = useRef(new Animated.Value(done ? 1 : 0)).current;
  const prevDone = useRef(done);
  useEffect(() => {
    if (done && !prevDone.current) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    }
    prevDone.current = done;
  }, [done, pop]);

  const nodeScale = done
    ? pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] })
    : 1;

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: done ? "#FFFFFF" : active ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)",
        borderWidth: 2.5,
        borderColor: done ? "#FFFFFF" : active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)",
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: nodeScale as any }],
      }}
    >
      {done ? (
        <Ionicons name="checkmark-sharp" size={scale(14)} color={primary} />
      ) : (
        <View
          style={{
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: size * 0.14,
            backgroundColor: active ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)",
          }}
        />
      )}
    </Animated.View>
  );
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
  const TC = useColors();

  // ── Backend verification status ──
  const [verStatus, setVerStatus] = useState<VerificationStatus>("none");
  const [verReason, setVerReason] = useState<string>("");
  const [verLoading, setVerLoading] = useState<boolean>(false);

  const refreshStatus = useCallback(async () => {
    if (!userEmail) { setVerStatus("none"); setVerReason(""); return; }
    try {
      setVerLoading(true);
      const accessToken = await getAccessToken();
      if (!accessToken) { setVerStatus("none"); setVerReason(""); return; }
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

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // ── Local selfie status ──
  const [selfieLocalDone, setSelfieLocalDone] = useState(false);
  const [selfieLocalUri, setSelfieLocalUri] = useState<string>("");

  const loadSelfieLocal = useCallback(async () => {
    if (!userEmail) { setSelfieLocalDone(false); setSelfieLocalUri(""); return; }
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

  useEffect(() => { loadSelfieLocal(); }, [loadSelfieLocal]);

  // ── Verification stage ──
  const hasLogin = !!userEmail;
  const selfieVerified = !!userEmail && (selfieLocalDone || isSelfieVerifiedFromUser(user));
  const isApproved = verStatus === "approved";

  let stage = 0;
  if (hasLogin) stage = 1;
  if (hasLogin && selfieVerified) stage = 2;
  if (isApproved) stage = 3;

  const displayName = hasLogin ? displayNameFromEmail(userEmail) : "Guest";
  const displaySub = hasLogin ? maskEmail(userEmail) : "Not signed in";
  const displayPhoneLike = user?.phone ? String(user.phone) : "";

  const nodes = [
    { key: "basic", label: "Basic", done: stage >= 1, active: stage === 0 },
    { key: "semi", label: "Semi-verified", done: stage >= 2, active: stage === 1 },
    { key: "full", label: "Fully Verified", done: stage >= 3, active: stage === 2 },
  ];


  // ── Card entrance animation ──
  const enterAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enterAnim]);

  // ── Selfie modal ──
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string>("");
  const [selfieLoading, setSelfieLoading] = useState(false);

  const openSelfieModal = () => {
    if (!userEmail) { Alert.alert("Login required", "Please login first."); return; }
    setSelfieUri("");
    setSelfieModalVisible(true);
  };
  const closeSelfieModal = () => setSelfieModalVisible(false);

  // ── ID modal ──
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [idImageUri, setIdImageUri] = useState<string>("");
  const [idType, setIdType] = useState<IdOption["key"]>("phil_id");
  const [submitLoading, setSubmitLoading] = useState(false);

  const closeVerifyModal = () => setVerifyModalVisible(false);
  const canVerifyNow = !!userEmail && verStatus !== "pending" && verStatus !== "approved";

  const onPressVerifyNow = () => {
    if (!userEmail) { Alert.alert("Login required", "Please login first."); return; }
    if (stage < 2) { openSelfieModal(); return; }
    setVerifyModalVisible(true);
  };

  // ── Permissions ──
  const requestCameraPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Camera permission is required."); return false; }
    return true;
  }, []);

  const requestLibraryPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Media library permission is required."); return false; }
    return true;
  }, []);

  // ── Selfie actions ──
  const takeSelfie = useCallback(async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.85, allowsEditing: true, aspect: [1, 1],
      cameraType: ImagePicker.CameraType.front,
    });
    if (!res.canceled && res.assets?.[0]?.uri) setSelfieUri(res.assets[0].uri);
  }, [requestCameraPermission]);

  const submitSelfie = useCallback(async () => {
    if (!userEmail) return;
    if (!selfieUri) { Alert.alert("Missing selfie", "Please take a selfie first."); return; }
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

  // ── ID actions ──
  const pickFromGallery = useCallback(async () => {
    const ok = await requestLibraryPermission();
    if (!ok) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85, allowsEditing: true, aspect: [4, 3],
    });
    if (!res.canceled && res.assets?.[0]?.uri) setIdImageUri(res.assets[0].uri);
  }, [requestLibraryPermission]);

  const takePhoto = useCallback(async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.85, allowsEditing: true, aspect: [4, 3],
      cameraType: ImagePicker.CameraType.back,
    });
    if (!res.canceled && res.assets?.[0]?.uri) setIdImageUri(res.assets[0].uri);
  }, [requestCameraPermission]);

  const removeSelected = () => setIdImageUri("");

  const submitVerification = async () => {
    if (!userEmail) return;
    if (!idImageUri) { Alert.alert("Missing ID", "Please upload a valid ID photo before submitting."); return; }
    try {
      setSubmitLoading(true);
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Session missing. Please login again.");
      const res = await submitVerificationApi({ accessToken, idType, fileUri: idImageUri });
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

  // ── Status badge ──
  const statusBadge = (() => {
    if (!userEmail) return null;
    if (verLoading) return { icon: "hourglass-outline" as const, label: "Checking...", bg: "rgba(255,255,255,0.15)" };
    if (verStatus === "pending") return { icon: "time-outline" as const, label: "Under review", bg: "rgba(251,191,36,0.2)" };
    if (verStatus === "approved") return { icon: "shield-checkmark" as const, label: "Verified", bg: "rgba(52,211,153,0.2)" };
    if (verStatus === "rejected") return { icon: "close-circle-outline" as const, label: "Rejected", bg: "rgba(248,113,113,0.2)" };
    return null;
  })();

  const avatarUri = user?.photoURL ? String(user.photoURL) : "";

  const NODE_SIZE = scale(28);
  const CARD_RADIUS = scale(22);

  const styles = useMemo(() => makeStyles(scale, vscale), [scale, vscale]);

  return (
    <Animated.View
      style={[
        styles.outerWrap,
        {
          opacity: enterAnim,
          transform: [
            { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={["#07519C", "#04396E", "#021C36"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderRadius: CARD_RADIUS }]}
      >
        {/* Decorative circles */}
        <View style={styles.decoCircle1} />
        <View style={styles.decoCircle2} />

        {/* ── Top section: Avatar + Info + Badge ── */}
        <View style={styles.topSection}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarRing}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <LinearGradient
                  colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.05)"]}
                  style={styles.avatarFallback}
                >
                  <Ionicons name="person" size={scale(24)} color="rgba(255,255,255,0.85)" />
                </LinearGradient>
              )}
            </View>
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.nameText} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.emailText} numberOfLines={1}>
              {displayPhoneLike ? displayPhoneLike : displaySub}
            </Text>
          </View>

          {statusBadge && (
            <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
              {verLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name={statusBadge.icon} size={scale(13)} color="#fff" />
              )}
              <Text style={styles.statusBadgeText}>{statusBadge.label}</Text>
            </View>
          )}
        </View>

        {/* ── Progress stepper ── */}
        <View style={styles.nodesRow}>
          {nodes.map((n) => (
            <View key={n.key} style={styles.nodeColumn}>
              <StepNode
                done={n.done}
                active={n.active}
                size={NODE_SIZE}
                primary={primary}
                scale={scale}
              />
              <Text
                style={[
                  styles.nodeLabel,
                  n.done && styles.nodeLabelDone,
                  n.active && styles.nodeLabelActive,
                ]}
                numberOfLines={1}
              >
                {n.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Rejection reason ── */}
        {verStatus === "rejected" && !!verReason && (
          <View style={styles.rejectedWrap}>
            <Ionicons name="alert-circle" size={scale(14)} color="#FCA5A5" />
            <Text style={styles.rejectedText} numberOfLines={2}>
              {verReason}
            </Text>
          </View>
        )}

        {/* ── CTA Button ── */}
        {canVerifyNow && (
          <VerifyNowButton
            onPress={onPressVerifyNow}
            label={verStatus === "rejected" ? "Verify again" : "Verify now"}
            primary={primary}
            scale={scale}
            styles={styles}
          />
        )}
      </LinearGradient>

      {/* ── SELFIE MODAL ── */}
      <Modal visible={selfieModalVisible} transparent animationType="fade" onRequestClose={closeSelfieModal}>
        <View style={styles.centerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSelfieModal} />
          <View style={[styles.centerCard, { backgroundColor: surface, borderColor: divider }]}>
            <View style={styles.centerHeader}>
              <View style={styles.centerHeaderLeft}>
                <View style={[styles.centerBadge, { backgroundColor: "rgba(7,81,156,0.08)" }]}>
                  <Ionicons name="camera-outline" size={scale(18)} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.centerTitle, { color: TC.textDark }]}>Selfie verification</Text>
                  <Text style={[styles.centerSub, { color: TC.muted }]}>Take a clear picture.</Text>
                </View>
              </View>
            </View>

            <View style={styles.previewWrap}>
              {selfieUri ? (
                <Image source={{ uri: selfieUri }} style={styles.previewImg} />
              ) : (
                <Pressable
                  onPress={takeSelfie}
                  disabled={selfieLoading}
                  style={[styles.previewPlaceholder, { borderColor: divider }]}
                >
                  <Ionicons name="camera-outline" size={scale(26)} color={primary} />
                  <Text style={[styles.previewText, { color: primary }]}>Take a selfie</Text>
                </Pressable>
              )}
            </View>

            {!!selfieUri && (
              <View style={styles.uploadRow}>
                <Pressable
                  onPress={() => setSelfieUri("")}
                  disabled={selfieLoading}
                  style={[styles.uploadBtn, { borderColor: divider }]}
                >
                  <Ionicons name="trash-outline" size={scale(16)} color="#DC2626" />
                  <Text style={[styles.uploadBtnText, { color: "#DC2626" }]}>Remove</Text>
                </Pressable>
              </View>
            )}

            <View style={[styles.centerActions, { justifyContent: "center" }]}>
              <Pressable
                onPress={closeSelfieModal}
                disabled={selfieLoading}
                style={[styles.actionBtn, styles.actionGhost, { borderColor: divider }]}
              >
                <Text style={[styles.actionBtnText, { color: TC.textDark }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitSelfie}
                disabled={selfieLoading}
                style={[styles.actionBtn, { backgroundColor: primary, borderColor: primary }, selfieLoading && { opacity: 0.85 }]}
              >
                {selfieLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Submit</Text>
                )}
              </Pressable>
            </View>

            {Platform.OS === "ios" ? <View style={{ height: vscale(2) }} /> : null}
          </View>
        </View>
      </Modal>

      {/* ── ID MODAL ── */}
      <Modal visible={verifyModalVisible} transparent animationType="fade" onRequestClose={closeVerifyModal}>
        <View style={styles.centerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeVerifyModal} />
          <View style={[styles.centerCard, { backgroundColor: surface, borderColor: divider }]}>
            <View style={styles.centerHeader}>
              <View style={styles.centerHeaderLeft}>
                <View style={[styles.centerBadge, { backgroundColor: "rgba(7,81,156,0.08)" }]}>
                  <Ionicons name="id-card-outline" size={scale(18)} color={primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.centerTitle, { color: TC.textDark }]}>Verify your identity</Text>
                  <Text style={[styles.centerSub, { color: TC.muted }]}>Upload a clear photo of a valid ID.</Text>
                </View>
              </View>
              <Pressable onPress={closeVerifyModal} hitSlop={10} style={styles.centerCloseBtn}>
                <Ionicons name="close" size={scale(18)} color={TC.muted} />
              </Pressable>
            </View>

            <View style={[styles.typeBox, { borderColor: divider }]}>
              <Text style={[styles.typeTitle, { color: TC.textDark }]}>Choose ID type</Text>
              <View style={styles.typeOptions}>
                {ID_OPTIONS.map((opt) => {
                  const active = idType === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setIdType(opt.key)}
                      style={[
                        styles.typeOption,
                        { borderColor: divider },
                        active && { borderColor: primary, backgroundColor: "rgba(7,81,156,0.06)" },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.typeOptionLabel, { color: TC.textDark }]}>{opt.label}</Text>
                        <Text style={[styles.typeOptionSub, { color: TC.muted }]}>{opt.sub}</Text>
                      </View>
                      {active && <Ionicons name="checkmark-circle" size={scale(18)} color={primary} />}
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
                  <Text style={[styles.previewText, { color: TC.muted }]}>No ID uploaded yet</Text>
                </View>
              )}
            </View>

            <View style={styles.uploadRow}>
              <Pressable
                onPress={pickFromGallery}
                disabled={submitLoading}
                style={[styles.uploadBtn, { borderColor: divider }]}
              >
                <Ionicons name="images-outline" size={scale(16)} color={primary} />
                <Text style={[styles.uploadBtnText, { color: TC.textDark }]}>Gallery</Text>
              </Pressable>
              <Pressable
                onPress={takePhoto}
                disabled={submitLoading}
                style={[styles.uploadBtn, { borderColor: divider }]}
              >
                <Ionicons name="camera-outline" size={scale(16)} color={primary} />
                <Text style={[styles.uploadBtnText, { color: TC.textDark }]}>Camera</Text>
              </Pressable>
              {!!idImageUri && (
                <Pressable
                  onPress={removeSelected}
                  disabled={submitLoading}
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
                style={[styles.actionBtn, styles.actionGhost, { borderColor: divider }]}
              >
                <Text style={[styles.actionBtnText, { color: TC.textDark }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submitVerification}
                disabled={submitLoading}
                style={[styles.actionBtn, { backgroundColor: primary, borderColor: primary }, submitLoading && { opacity: 0.85 }]}
              >
                {submitLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.actionBtnText, { color: "#fff" }]}>Submit</Text>
                )}
              </Pressable>
            </View>

            <Text style={[styles.centerFoot, { color: TC.muted }]}>
              Tip: Make sure the ID is readable and not blurry.
            </Text>

            {Platform.OS === "ios" ? <View style={{ height: vscale(2) }} /> : null}
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

function makeStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const CARD_R = scale(22);

  return StyleSheet.create({
    outerWrap: {
      marginTop: vscale(10),
    },

    card: {
      overflow: "hidden",
      paddingHorizontal: scale(16),
      paddingTop: vscale(14),
      paddingBottom: vscale(12),
    },

    /* Decorative background circles */
    decoCircle1: {
      position: "absolute",
      top: -scale(30),
      right: -scale(30),
      width: scale(120),
      height: scale(120),
      borderRadius: scale(60),
      backgroundColor: "rgba(255,255,255,0.04)",
    },
    decoCircle2: {
      position: "absolute",
      bottom: -scale(20),
      left: -scale(20),
      width: scale(80),
      height: scale(80),
      borderRadius: scale(40),
      backgroundColor: "rgba(255,255,255,0.03)",
    },

    /* ── Top section ── */
    topSection: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(14),
    },

    avatarContainer: {
      alignItems: "center",
      justifyContent: "center",
      width: scale(62),
      height: scale(62),
    },
    avatarRing: {
      width: scale(54),
      height: scale(54),
      borderRadius: scale(27),
      borderWidth: 2.5,
      borderColor: "rgba(255,255,255,0.35)",
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImg: {
      width: "100%",
      height: "100%",
    },
    avatarFallback: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },

    infoBlock: {
      flex: 1,
      minWidth: 0,
    },
    nameText: {
      color: "#FFFFFF",
      fontSize: scale(17),
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    emailText: {
      marginTop: vscale(2),
      color: "rgba(255,255,255,0.7)",
      fontSize: scale(12),
      fontWeight: "500",
    },

    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(5),
      paddingHorizontal: scale(10),
      paddingVertical: vscale(5),
      borderRadius: scale(20),
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
    },
    statusBadgeText: {
      color: "#FFFFFF",
      fontSize: scale(10),
      fontWeight: "800",
      letterSpacing: 0.3,
    },

    nodesRow: {
      marginTop: vscale(12),
      flexDirection: "row",
      justifyContent: "space-between",
    },
    nodeColumn: {
      alignItems: "center",
      flex: 1,
    },
    nodeLabel: {
      marginTop: vscale(6),
      color: "rgba(255,255,255,0.45)",
      fontSize: scale(10),
      fontWeight: "600",
      textAlign: "center",
    },
    nodeLabelDone: {
      color: "rgba(255,255,255,0.9)",
      fontWeight: "800",
    },
    nodeLabelActive: {
      color: "rgba(255,255,255,0.7)",
    },

    /* ── Rejected ── */
    rejectedWrap: {
      marginTop: vscale(10),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(6),
      paddingHorizontal: scale(10),
      paddingVertical: vscale(6),
      borderRadius: scale(8),
      backgroundColor: "rgba(248,113,113,0.12)",
    },
    rejectedText: {
      flex: 1,
      color: "#FCA5A5",
      fontSize: scale(11),
      fontWeight: "600",
    },

    /* ── CTA Button ── */
    ctaBtn: {
      marginTop: vscale(10),
      borderRadius: scale(14),
      overflow: "hidden",
    },
    ctaGradient: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: vscale(12),
      paddingHorizontal: scale(18),
      gap: scale(10),
      borderRadius: scale(14),
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.15)",
    },
    ctaText: {
      color: "#FFFFFF",
      fontSize: scale(13),
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    ctaArrow: {
      width: scale(24),
      height: scale(24),
      borderRadius: scale(12),
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },

    /* ── Modal styles (kept from original) ── */
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
      borderRadius: scale(18),
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
