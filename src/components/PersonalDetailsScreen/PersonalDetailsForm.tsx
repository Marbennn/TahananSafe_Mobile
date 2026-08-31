// src/components/PersonalDetailsScreen/PersonalDetailsForm.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Colors, useColors } from "../../theme/colors";
import { createTypography } from "../../theme/typography";

type GenderOption = { id: "male" | "female"; label: string };

type Props = {
  scale: (n: number) => number;
  vscale: (n: number) => number;

  styles: any;

  // values
  firstName: string;
  lastName: string;
  dob: string; // MM/DD/YYYY
  contactNumber: string; // stored like "+63 XXXXXXXXXX" (local part)
  gender: "male" | "female" | null;

  // setters
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setDob: (v: string) => void;
  setContactNumber: (v: string) => void;
  setGender: (v: "male" | "female") => void;

};

const PREFIX = "+63";
const MINIMUM_AGE = 17;

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

function normalizeToLocal10(input: string): string {
  const raw = input.trim();
  const d = digitsOnly(raw);

  if (d.startsWith("63")) return d.slice(2).slice(0, 10);
  if (d.startsWith("0")) return d.slice(1).slice(0, 10);
  return d.slice(0, 10);
}

function formatFullPH(local10: string) {
  return `${PREFIX} ${local10}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDobDate(d: Date) {
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function parseDobToDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);

  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  if (yyyy < 1900 || yyyy > 3000) return null;

  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;

  return d;
}

// ✅ Local part validation: must be 9XXXXXXXXX (10 digits starting with 9)
function isValidLocalMobile10(local10: string) {
  return /^9\d{9}$/.test(local10);
}

export default function PersonalDetailsForm({
  scale,
  vscale,
  styles,

  firstName,
  lastName,
  dob,
  contactNumber,
  gender,

  setFirstName,
  setLastName,
  setDob,
  setContactNumber,
  setGender,
}: Props) {
  const TC = useColors();
  const typography = createTypography(scale);
  const genderOptions: GenderOption[] = useMemo(
    () => [
      { id: "male", label: "Male" },
      { id: "female", label: "Female" },
    ],
    []
  );

  // focus states
  const [firstFocused, setFirstFocused] = useState(false);
  const [lastFocused, setLastFocused] = useState(false);
  const [dobFocused, setDobFocused] = useState(false);
  const [contactFocused, setContactFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [ageNoticeOpen, setAgeNoticeOpen] = useState(false);

  const firstNameRef = useRef<TextInput | null>(null);
  const lastNameRef = useRef<TextInput | null>(null);
  const contactRef = useRef<TextInput | null>(null);

  // modals
  const [genderOpen, setGenderOpen] = useState(false);
  const openGender = () => setGenderOpen(true);
  const closeGender = () => setGenderOpen(false);

  const selectedGender = genderOptions.find((g) => g.id === gender);
  const selectedGenderLabel = selectedGender?.label ?? "Select a gender";

  // ✅ local phone state
  const [localPhone, setLocalPhone] = useState("");
  const [contactTouched, setContactTouched] = useState(false);

  useEffect(() => {
    const local = normalizeToLocal10(contactNumber || "");
    setLocalPhone(local);
  }, [contactNumber]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const reopenKeyboardIfNeeded = (ref: React.RefObject<TextInput | null>, isFocused: boolean) => {
    if (keyboardVisible || !isFocused) return;

    ref.current?.blur();
    requestAnimationFrame(() => {
      ref.current?.focus();
    });
  };

  const commitPhone = (nextLocal10: string) => {
    const cleaned = digitsOnly(nextLocal10).slice(0, 10);
    setLocalPhone(cleaned);

    if (!cleaned) {
      setContactNumber("");
      return;
    }
    setContactNumber(formatFullPH(cleaned));
  };

  const showPhoneError =
    contactTouched && localPhone.length > 0 && !isValidLocalMobile10(localPhone);

  /** ---------------- DOB PICKER ---------------- **/
  // Android: real popup calendar
  const [androidDobOpen, setAndroidDobOpen] = useState(false);

  // iOS: inline calendar shown/hidden under the input
  const [iosInlineOpen, setIosInlineOpen] = useState(false);

  const minDobDate = useMemo(() => new Date(1900, 0, 1), []);
  const maxDobDate = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(23, 59, 59, 999);
    cutoff.setFullYear(cutoff.getFullYear() - MINIMUM_AGE);
    return cutoff;
  }, []);
  const pickerDobDate = useMemo(() => {
    const parsed = parseDobToDate(dob);
    if (!parsed) return new Date(2000, 0, 1);
    return parsed > maxDobDate ? maxDobDate : parsed;
  }, [dob, maxDobDate]);

  const dobDisplay = useMemo(() => {
    if (dob?.trim()?.length) return dob;
    return "MM/DD/YYYY";
  }, [dob]);

  const openDobPicker = () => {
    if (Platform.OS === "android") {
      setAndroidDobOpen(true);
      return;
    }
    // iOS: show the inline calendar after the age notice is acknowledged.
    setIosInlineOpen(true);
  };

  const onDobPress = () => {
    Keyboard.dismiss();
    setAgeNoticeOpen(true);
  };

  const continueToDobPicker = () => {
    setAgeNoticeOpen(false);
    setTimeout(openDobPicker, Platform.OS === "android" ? 250 : 0);
  };

  const onChangeAndroid = (event: DateTimePickerEvent, selected?: Date) => {
    // closes automatically on Android (OK/dismiss)
    setAndroidDobOpen(false);

    if (event.type === "dismissed") return;
    if (selected) setDob(formatDobDate(selected));
  };

  const onChangeIosInline = (_event: DateTimePickerEvent, selected?: Date) => {
    // inline calendar always "changes" when user taps a date
    if (selected) {
      setDob(formatDobDate(selected));
      // ✅ auto-close after picking
      setIosInlineOpen(false);
    }
  };

  return (
    <>
      <View style={styles.form}>
        {/* First Name */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            ref={firstNameRef}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your legal first name"
            placeholderTextColor={Colors.placeholder}
            autoCapitalize="words"
            maxLength={16}
            style={[
              styles.input,
              firstFocused ? styles.inputFocused : styles.inputIdle,
            ]}
            onFocus={() => setFirstFocused(true)}
            onBlur={() => setFirstFocused(false)}
            onTouchStart={() => reopenKeyboardIfNeeded(firstNameRef, firstFocused)}
          />
        </View>

        {/* Last Name */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            ref={lastNameRef}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter your legal last name"
            placeholderTextColor={Colors.placeholder}
            autoCapitalize="words"
            maxLength={16}
            style={[
              styles.input,
              lastFocused ? styles.inputFocused : styles.inputIdle,
            ]}
            onFocus={() => setLastFocused(true)}
            onBlur={() => setLastFocused(false)}
            onTouchStart={() => reopenKeyboardIfNeeded(lastNameRef, lastFocused)}
          />
        </View>

        {/* ✅ DOB */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Date of Birth</Text>

          <Pressable
            onPress={onDobPress}
            hitSlop={10}
            style={[
              styles.input,
              dobFocused ? styles.inputFocused : styles.inputIdle,
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              },
            ]}
            onPressIn={() => setDobFocused(true)}
            onPressOut={() => setDobFocused(false)}
          >
            <Text
              style={{
                ...typography.input,
                color: dob?.trim()?.length ? Colors.text : Colors.placeholder,
              }}
              numberOfLines={1}
            >
              {dobDisplay}
            </Text>

            <Ionicons name="calendar-outline" size={scale(18)} color="#6B7280" />
          </Pressable>

          {/* ✅ iOS Inline Calendar (no modal, no spinner) */}
          {Platform.OS === "ios" && iosInlineOpen && (
            <View
              style={{
                marginTop: vscale(10),
                borderWidth: 1.4,
                borderColor: Colors.border,
                borderRadius: scale(24),
                overflow: "hidden",
                backgroundColor: "#F0F6FF",
                shadowColor: Colors.primary,
                shadowOpacity: 0.08,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <DateTimePicker
                value={pickerDobDate}
                mode="date"
                display="inline"
                minimumDate={minDobDate}
                maximumDate={maxDobDate}
                onChange={onChangeIosInline}
                accentColor={Colors.primary}
                style={{ alignSelf: "stretch" }}
              />
            </View>
          )}
        </View>

        {/* ✅ Android Calendar Popup */}
        {Platform.OS === "android" && androidDobOpen && (
          <DateTimePicker
            value={pickerDobDate}
            mode="date"
            display="calendar"
            minimumDate={minDobDate}
            maximumDate={maxDobDate}
            onChange={onChangeAndroid}
          />
        )}

        {/* ✅ CONTACT NUMBER */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Contact Number</Text>

          <View
            style={[
              styles.input,
              contactFocused ? styles.inputFocused : styles.inputIdle,
              {
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: scale(14),
              },
            ]}
          >
            <Text
              style={{
                ...typography.label,
                color: Colors.text,
                marginRight: scale(10),
              }}
            >
              {PREFIX}
            </Text>

            <TextInput
              ref={contactRef}
              value={localPhone}
              onChangeText={commitPhone}
              placeholder="9XXXXXXXXX"
              placeholderTextColor={Colors.placeholder}
              keyboardType="number-pad"
              style={{
                ...typography.input,
                flex: 1,
                color: Colors.text,
                paddingVertical: 0,
              }}
              onFocus={() => setContactFocused(true)}
              onBlur={() => {
                setContactFocused(false);
                setContactTouched(true);
              }}
              onTouchStart={() => reopenKeyboardIfNeeded(contactRef, contactFocused)}
              maxLength={10}
            />
          </View>

          {showPhoneError ? (
            <Text style={styles.errorText}>Please enter a valid mobile number</Text>
          ) : null}
        </View>

        {/* Gender */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Gender</Text>
          <Pressable
            onPress={openGender}
            hitSlop={10}
            style={({ pressed }) => [
              styles.select,
              gender ? styles.selectFilled : null,
              pressed ? { opacity: 0.92 } : null,
            ]}
          >
            <Text
              style={[styles.selectText, !gender && { color: Colors.placeholder }]}
              numberOfLines={1}
            >
              {selectedGenderLabel}
            </Text>
            <Ionicons name="chevron-down" size={scale(16)} color="#9CA3AF" />
          </Pressable>
        </View>

        <View style={{ height: vscale(80) }} />
      </View>

      <Modal
        visible={ageNoticeOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setAgeNoticeOpen(false)}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: scale(24),
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: scale(360),
              borderRadius: scale(20),
              padding: scale(22),
              backgroundColor: TC.card,
            }}
          >
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  ...typography.input,
                  fontWeight: "700",
                  color: TC.text,
                }}
              >
                Age requirement
              </Text>
              <Text
                style={{
                  ...typography.input,
                  marginTop: vscale(8),
                  textAlign: "center",
                  lineHeight: scale(21),
                  color: TC.muted,
                }}
              >
                Please note: You must be at least 17 years old.
              </Text>
            </View>

            <Pressable
              onPress={continueToDobPicker}
              style={({ pressed }) => ({
                minHeight: scale(46),
                marginTop: vscale(20),
                borderRadius: scale(12),
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: Colors.primary,
                opacity: pressed ? 0.86 : 1,
              })}
            >
              <Text style={{ ...typography.input, fontWeight: "700", color: "#FFFFFF" }}>
                Continue
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ---------------- Centered Gender Modal ---------------- */}
      <Modal
        visible={genderOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeGender}
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: scale(24),
          }}
        >
          <Pressable
            style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.45)" }]}
            onPress={closeGender}
          />

          <View style={[styles.genderSheet, { backgroundColor: TC.card }]}>
            <Text style={[styles.genderSheetTitle, { color: TC.text }]}>Select Gender</Text>

            {genderOptions.map((opt) => {
              const active = opt.id === gender;
              const subLabel = opt.id === "male" ? "He / Him" : "She / Her";
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    setGender(opt.id);
                    closeGender();
                  }}
                  style={({ pressed }) => [
                    styles.genderOption,
                    active && styles.genderOptionActive,
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.genderOptionText, active && styles.genderOptionTextActive]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.genderOptionSub}>{subLabel}</Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={scale(22)} color={Colors.primary} />
                  ) : (
                    <View style={styles.genderOptionCircle} />
                  )}
                </Pressable>
              );
            })}

            <Pressable
              onPress={closeGender}
              style={({ pressed }) => [styles.genderCancel, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.genderCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
