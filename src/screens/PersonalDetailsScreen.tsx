// src/screens/PersonalDetailsScreen.tsx
import React, { useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { Colors, useColors } from "../theme/colors";
import { createTypography } from "../theme/typography";
import PersonalDetailsForm from "../components/PersonalDetailsScreen/PersonalDetailsForm";
import SavedModal from "../components/SavedModal";

// ✅ API (separated)
import { savePersonalDetails } from "../api/user";

type SubmitPayload = {
  firstName: string;
  lastName: string;
  dob: string; // MM/DD/YYYY
  contactNumber: string;
  gender: "male" | "female";
};

type Props = {
  initialValues?: Partial<SubmitPayload>;
  onBack?: () => void;
  onSubmit?: (payload: SubmitPayload) => void;
  progressActiveCount?: 1 | 2 | 3 | 4;
};

const MAX_BIRTH_YEAR = 2011;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** ---------- VALIDATION HELPERS ---------- **/
function normalizeName(s: string) {
  return s.trim().replace(/\s+/g, " ");
}
function isValidName(s: string) {
  return /^[A-Za-z\s.'-]{2,}$/.test(s);
}
function normalizePhone(raw: string) {
  const t = raw.trim();
  if (t.startsWith("+")) return "+" + t.slice(1).replace(/\D/g, "");
  return t.replace(/\D/g, "");
}

/**
 * ✅ PH Phone (STRICT):
 * - 09XXXXXXXXX (must start with 09)
 * - +639XXXXXXXXX (must start with +639)
 */
function isValidPHPhone(raw: string) {
  const p = normalizePhone(raw);
  if (/^09\d{9}$/.test(p)) return true;
  if (/^\+639\d{9}$/.test(p)) return true;
  return false;
}

function isValidDobFormat(mmddyyyy: string) {
  return /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(19|20)\d{2}$/.test(mmddyyyy);
}
function parseDob(mmddyyyy: string): Date | null {
  if (!isValidDobFormat(mmddyyyy)) return null;
  const [mm, dd, yyyy] = mmddyyyy.split("/").map((x) => Number(x));
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}
function calcAge(dob: Date) {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export default function PersonalDetailsScreen({ initialValues, onSubmit }: Props) {
  const TC = useColors();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const s = clamp(Math.min(width, 480) / 375, 0.84, 1.12);
  const vs = clamp(height / 812, 0.78, 1.08);
  const scale = (n: number) => Math.round(n * s);
  const vscale = (n: number) => Math.round(n * vs);

  const styles = useMemo(() => createStyles(scale, vscale), [width, height]);

  const [firstName, setFirstName] = useState(initialValues?.firstName ?? "");
  const [lastName, setLastName] = useState(initialValues?.lastName ?? "");
  const [dob, setDob] = useState(initialValues?.dob ?? "");
  const [contactNumber, setContactNumber] = useState(initialValues?.contactNumber ?? "");
  const [gender, setGender] = useState<"male" | "female" | null>(initialValues?.gender ?? null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<SubmitPayload | null>(null);

  const canContinue =
    normalizeName(firstName).length > 0 &&
    normalizeName(lastName).length > 0 &&
    dob.trim().length > 0 &&
    contactNumber.trim().length > 0 &&
    (gender === "male" || gender === "female");

  function validateAll(): { ok: boolean; message?: string } {
    const fn = normalizeName(firstName);
    const ln = normalizeName(lastName);
    const phone = normalizePhone(contactNumber);
    const dobDate = parseDob(dob.trim());

    if (!fn) return { ok: false, message: "First name is required." };
    if (!ln) return { ok: false, message: "Last name is required." };

    // ✅ limit to 16 chars
    if (fn.length > 16) return { ok: false, message: "First name must be 16 characters or less." };
    if (ln.length > 16) return { ok: false, message: "Last name must be 16 characters or less." };

    if (!isValidName(fn)) return { ok: false, message: "First name must contain letters only (min 2 characters)." };
    if (!isValidName(ln)) return { ok: false, message: "Last name must contain letters only (min 2 characters)." };

    if (!dob.trim()) return { ok: false, message: "Date of Birth is required." };
    if (!dobDate) return { ok: false, message: "Invalid Date of Birth. Use MM/DD/YYYY (example: 02/24/2000)." };
    if (dobDate.getFullYear() > MAX_BIRTH_YEAR) {
      return { ok: false, message: "Birth year must be 2011 or earlier." };
    }

    const age = calcAge(dobDate);
    if (age < 10) return { ok: false, message: "Invalid Date of Birth (age too low)." };
    if (age > 120) return { ok: false, message: "Invalid Date of Birth (age too high)." };

    if (!phone) return { ok: false, message: "Contact number is required." };

    // ✅ must be 09... OR +639...
    if (!isValidPHPhone(phone)) {
      return { ok: false, message: "Invalid PH contact number. Use 09XXXXXXXXX or +639XXXXXXXXX." };
    }

    if (gender !== "male" && gender !== "female") return { ok: false, message: "Please select your gender." };

    return { ok: true };
  }

  const handleContinue = async () => {
    const check = validateAll();
    if (!check.ok) {
      Alert.alert("Invalid", check.message || "Please check your inputs.");
      return;
    }

    const payload: SubmitPayload = {
      firstName: normalizeName(firstName),
      lastName: normalizeName(lastName),
      dob: dob.trim(),
      contactNumber: normalizePhone(contactNumber),
      gender: gender as "male" | "female",
    };

    try {
      setIsSubmitting(true);
      await savePersonalDetails(payload);

      setPendingPayload(payload);
      setSavedVisible(true);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.safe, { backgroundColor: TC.surface }]}>
      <SavedModal
        visible={savedVisible}
        title="Saved!"
        message="Personal details saved successfully."
        buttonLabel="OK"
        onClose={() => {
          setSavedVisible(false);
          onSubmit?.(pendingPayload!);
        }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.body}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
            <View style={styles.page}>
              <View style={styles.titleBlock}>
                <Text style={styles.screenTitle}>Enter Your Details</Text>
                <Text style={styles.screenSub}>
                  Enter your personal information. This will be kept private and secure.
                </Text>
              </View>

              <PersonalDetailsForm
                scale={scale}
                vscale={vscale}
                styles={styles}
                firstName={firstName}
                lastName={lastName}
                dob={dob}
                contactNumber={contactNumber}
                gender={gender}
                setFirstName={setFirstName}
                setLastName={setLastName}
                setDob={setDob}
                setContactNumber={setContactNumber}
                setGender={setGender}
              />
            </View>
          </ScrollView>

          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, vscale(12)) }]}>
            <Pressable
              onPress={handleContinue}
              disabled={!canContinue || isSubmitting}
              hitSlop={10}
              style={({ pressed }) => [
                styles.ctaOuter,
                (!canContinue || isSubmitting) && { opacity: 0.55 },
                pressed && canContinue && !isSubmitting ? { transform: [{ scale: 0.99 }] } : null,
              ]}
            >
              <View style={styles.ctaInnerClip}>
                <LinearGradient
                  colors={TC.actionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.ctaGradient}
                >
                  {isSubmitting ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color="#FFFFFF" />
                      <Text style={styles.loadingText}>Saving...</Text>
                    </View>
                  ) : (
                    <Text style={styles.ctaText}>Continue</Text>
                  )}
                </LinearGradient>
              </View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  const typography = createTypography(scale);
  return StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: "#FFFFFF" },
    body: { flex: 1 },

    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: scale(22),
      paddingTop: vscale(6),
      paddingBottom: vscale(14),
    },

    page: {
      flexGrow: 1,
      width: "100%",
      maxWidth: 480,
      alignSelf: "center",
    },

    titleBlock: { marginTop: vscale(18), marginBottom: vscale(22) },

    screenTitle: { ...typography.authTitle, color: Colors.text },

    screenSub: {
      ...typography.bodySmall,
      marginTop: vscale(8),
      color: Colors.muted,
      maxWidth: scale(360),
    },

    form: {},
    fieldBlock: { marginBottom: vscale(14) },

    label: { ...typography.label, marginBottom: vscale(8), color: Colors.text },

    input: {
      ...typography.input,
      minHeight: Math.max(44, vscale(50)),
      borderRadius: scale(14),
      paddingHorizontal: scale(14),
      borderWidth: 1.4,
      backgroundColor: "#FFFFFF",
      color: Colors.text,
      justifyContent: "center",
    },

    inputIdle: { borderColor: "#E5E7EB" },
    inputFocused: { borderColor: Colors.primary },

    // ✅ NEW: red validation text style
    errorText: {
      ...typography.captionStrong,
      marginTop: vscale(6),
      color: "#DC2626",
    },

    select: {
      minHeight: Math.max(44, vscale(50)),
      borderRadius: scale(14),
      paddingHorizontal: scale(14),
      borderWidth: 1.4,
      borderColor: "#E5E7EB",
      backgroundColor: "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(8),
    },

    selectFilled: {
      borderColor: Colors.primary,
      backgroundColor: "rgba(7, 81, 156, 0.03)",
    },

    selectText: {
      ...typography.input,
      flex: 1,
      color: Colors.text,
    },

    genderIconInline: {
      width: scale(26),
      height: scale(26),
      borderRadius: scale(13),
      backgroundColor: "rgba(7, 81, 156, 0.10)",
      alignItems: "center",
      justifyContent: "center",
    },

    bottomBar: {
      width: "100%",
      maxWidth: 524,
      alignSelf: "center",
      paddingHorizontal: scale(22),
      paddingTop: vscale(10),
      backgroundColor: "#FFFFFF",
    },

    ctaOuter: {
      marginTop: vscale(4),
      borderRadius: scale(14),
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
        android: { elevation: 7 },
      }),
    },

    ctaInnerClip: { borderRadius: scale(14), overflow: "hidden" },

    ctaGradient: {
      minHeight: Math.max(46, vscale(52)),
      alignItems: "center",
      justifyContent: "center",
    },

    ctaText: { ...typography.button, color: "#FFFFFF" },

    loadingRow: { flexDirection: "row", alignItems: "center", gap: scale(10) },
    loadingText: { ...typography.button, color: "#FFFFFF" },

    genderSheet: {
      width: "100%",
      maxWidth: 600,
      alignSelf: "center",
      backgroundColor: "#FFFFFF",
      borderTopLeftRadius: scale(28),
      borderTopRightRadius: scale(28),
      paddingHorizontal: scale(20),
      paddingTop: scale(10),
      paddingBottom: scale(32),
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 28, shadowOffset: { width: 0, height: -6 } },
        android: { elevation: 18 },
      }),
    },

    genderSheetHandle: {
      width: scale(40),
      height: scale(4),
      borderRadius: scale(2),
      backgroundColor: "#E5E7EB",
      alignSelf: "center",
      marginBottom: scale(18),
    },

    genderSheetTitle: {
      ...typography.sectionTitle,
      color: Colors.text,
      marginBottom: scale(14),
    },

    genderOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: scale(14),
      paddingVertical: vscale(14),
      paddingHorizontal: scale(14),
      borderRadius: scale(18),
      borderWidth: 1.5,
      borderColor: "#E5E7EB",
      backgroundColor: "#FFFFFF",
      marginBottom: scale(10),
    },

    genderOptionActive: {
      borderColor: Colors.primary,
      backgroundColor: "rgba(7, 81, 156, 0.05)",
    },

    genderIconBadge: {
      width: scale(44),
      height: scale(44),
      borderRadius: scale(22),
      backgroundColor: "#F3F4F6",
      alignItems: "center",
      justifyContent: "center",
    },

    genderIconBadgeActive: {
      backgroundColor: "rgba(7, 81, 156, 0.12)",
    },

    genderOptionText: {
      ...typography.bodyStrong,
      color: Colors.text,
    },

    genderOptionTextActive: {
      color: Colors.primary,
    },

    genderOptionSub: {
      ...typography.caption,
      color: Colors.muted,
      marginTop: scale(2),
    },

    genderOptionCircle: {
      width: scale(22),
      height: scale(22),
      borderRadius: scale(11),
      borderWidth: 1.5,
      borderColor: "#D1D5DB",
    },

    genderCancel: {
      marginTop: scale(4),
      paddingVertical: vscale(14),
      alignItems: "center",
      borderRadius: scale(14),
      backgroundColor: "#F3F4F6",
    },

    genderCancelText: {
      ...typography.bodyStrong,
      color: Colors.muted,
    },
  });
}
