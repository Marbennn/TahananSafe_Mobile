// src/components/Settings/VerifyAccountCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

  const verifyTotal = 3;

  const hasLogin = !!userEmail;
  const hasBio = !!userEmail && !!bioEnabled;
  const hasPin = !!userEmail && !!pinEnabled;

  const verifyDone = (hasLogin ? 1 : 0) + (hasBio ? 1 : 0) + (hasPin ? 1 : 0);

  const verifyTitle =
    verifyDone >= 3
      ? "Fully Verified"
      : verifyDone === 2
        ? "Semi-verified"
        : verifyDone === 1
          ? "Basic Level"
          : "Verify Account";

  const displayName = hasLogin ? displayNameFromEmail(userEmail) : "Guest";
  const displaySub = hasLogin ? maskEmail(userEmail) : "Not signed in";
  const displayPhoneLike = user?.phone ? String(user.phone) : "";

  const nodes = [
    { key: "basic", done: verifyDone >= 1 },
    { key: "semi", done: verifyDone >= 2 },
    { key: "full", done: verifyDone >= 3 },
  ];

  // segments mapping:
  // done=0 -> 0
  // done=1 -> 0
  // done=2 -> 0.5
  // done=3 -> 1
  const segmentsDone = clamp01((verifyDone - 1) / (verifyTotal - 1)); // 0..1

  return (
    <View style={[styles.verifyCard, { borderColor: divider, backgroundColor: surface }]}>
      <View style={[styles.verifyHeader, { backgroundColor: primary }]}>
        <View style={styles.verifyHeaderRow}>
          <View style={styles.verifyAvatarWrap}>
            {user?.photoURL ? (
              <Image source={{ uri: String(user.photoURL) }} style={styles.verifyAvatarImg} />
            ) : (
              <View style={styles.verifyAvatarFallback}>
                <Ionicons name="person" size={scale(22)} color="#fff" />
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.verifyName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.verifyContact} numberOfLines={1}>
              {displayPhoneLike ? displayPhoneLike : displaySub}
            </Text>
          </View>
        </View>

        <View style={styles.stepperWrap}>
          <View style={styles.barOuter}>
            {/* Track from center of first node to center of last node */}
            <View style={styles.barTrack} />

            {/* ✅ Fill uses SAME insets as track, so it cannot exceed last node */}
            <View
              style={[
                styles.barFill,
                {
                  transform: [{ scaleX: segmentsDone }],
                },
              ]}
            />

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
        </View>
      </View>
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

    verifyHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(12),
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
    verifyAvatarFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },

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

    /**
     * ✅ The critical change:
     * Fill spans the SAME exact track bounds (left+right),
     * then we scaleX it from the left edge.
     */
    barFill: {
      position: "absolute",
      left: TRACK_INSET,
      right: TRACK_INSET, // ✅ ensures full length equals track length
      top: vscale(22),
      height: vscale(4),
      borderRadius: vscale(4),
      backgroundColor: "rgba(255,255,255,0.92)",
      transformOrigin: "left" as any, // RN doesn't officially support; scaleX still works correctly visually
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
  });
}