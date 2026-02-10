// src/components/PersonalDetailsScreen/PersonalDetailsForm.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../theme/colors";

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
  gender: "male" | "female";

  // setters
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setDob: (v: string) => void;
  setContactNumber: (v: string) => void;
  setGender: (v: "male" | "female") => void;

  // ui
  activeBlue: string; // for checkmark color
};

const PREFIX = "+63";

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

function formatDobParts(monthIndex0: number, day: number, year: number) {
  const mm = pad2(monthIndex0 + 1);
  const dd = pad2(day);
  return `${mm}/${dd}/${year}`;
}

function parseDobToParts(s: string): { monthIndex0: number; day: number; year: number } | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  if (yyyy < 1900 || yyyy > 3000) return null;
  return { monthIndex0: mm - 1, day: dd, year: yyyy };
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
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

  activeBlue,
}: Props) {
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

  // modals
  const [genderOpen, setGenderOpen] = useState(false);

  // ✅ DOB modal + step modals
  const [dobOpen, setDobOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);

  const selectedGenderLabel =
    genderOptions.find((g) => g.id === gender)?.label ?? "Select your gender";

  // ✅ local phone state (digits only after +63)
  const [localPhone, setLocalPhone] = useState("");

  // ✅ show validation only after user touches the field
  const [contactTouched, setContactTouched] = useState(false);

  useEffect(() => {
    const local = normalizeToLocal10(contactNumber || "");
    setLocalPhone(local);
  }, [contactNumber]);

  /**
   * ✅ NO MORE forcing 9:
   * - keep digits only
   * - max 10 digits
   * - store as "+63 XXXXXXXXXX"
   */
  const commitPhone = (nextLocal10: string) => {
    const cleaned = digitsOnly(nextLocal10).slice(0, 10);

    setLocalPhone(cleaned);

    if (!cleaned) {
      setContactNumber("");
      return;
    }
    setContactNumber(formatFullPH(cleaned));
  };

  // ✅ show error if user already touched and current input is invalid
  const showPhoneError =
    contactTouched && localPhone.length > 0 && !isValidLocalMobile10(localPhone);

  /** ---------------- DOB 3-PART PICKER ---------------- **/
  const monthOptions = useMemo(
    () => [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    []
  );

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonthIndex0 = now.getMonth(); // 0..11
  const currentDay = now.getDate(); // 1..31

  // choose a reasonable year range
  const yearOptions = useMemo(() => {
    const minYear = currentYear - 90; // 90 yrs back
    const maxYear = currentYear; // ✅ up to current year only
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y); // descending
    return arr;
  }, [currentYear]);

  // Local draft values for modal (user can cancel without changing dob)
  const parsed = useMemo(() => parseDobToParts(dob), [dob]);

  const [draftMonth, setDraftMonth] = useState<number>(parsed?.monthIndex0 ?? 0);
  const [draftDay, setDraftDay] = useState<number>(parsed?.day ?? 1);
  const [draftYear, setDraftYear] = useState<number>(parsed?.year ?? (currentYear - 18));

  // when dob changes externally, update draft
  useEffect(() => {
    const p = parseDobToParts(dob);
    if (p) {
      setDraftMonth(p.monthIndex0);
      setDraftDay(p.day);
      setDraftYear(p.year);
    }
  }, [dob]);

  // ✅ helper: is current year/month selected?
  const isCurrentYear = draftYear === currentYear;
  const isCurrentMonthInCurrentYear = isCurrentYear && draftMonth === currentMonthIndex0;

  // ✅ clamp month/day if user ends up in the future
  useEffect(() => {
    if (isCurrentYear && draftMonth > currentMonthIndex0) {
      setDraftMonth(currentMonthIndex0);
      return;
    }

    const maxInMonth = daysInMonth(draftYear, draftMonth);
    let allowedMaxDay = maxInMonth;

    if (isCurrentMonthInCurrentYear) {
      allowedMaxDay = Math.min(allowedMaxDay, currentDay);
    }

    if (draftDay > allowedMaxDay) setDraftDay(allowedMaxDay);
    if (draftDay < 1) setDraftDay(1);
  }, [
    draftYear,
    draftMonth,
    draftDay,
    isCurrentYear,
    isCurrentMonthInCurrentYear,
    currentMonthIndex0,
    currentDay,
    currentYear,
  ]);

  const dayOptions = useMemo(() => {
    const maxInMonth = daysInMonth(draftYear, draftMonth);
    let maxAllowed = maxInMonth;

    if (draftYear === currentYear && draftMonth === currentMonthIndex0) {
      maxAllowed = Math.min(maxAllowed, currentDay);
    }

    const arr: number[] = [];
    for (let d = 1; d <= maxAllowed; d++) arr.push(d);
    return arr;
  }, [draftYear, draftMonth, currentYear, currentMonthIndex0, currentDay]);

  const dobDisplay = useMemo(() => {
    if (dob?.trim()?.length) return dob;
    return "MM/DD/YYYY";
  }, [dob]);

  const draftDobLabel = useMemo(() => {
    return `${monthOptions[draftMonth]} ${draftDay}, ${draftYear}`;
  }, [draftMonth, draftDay, draftYear, monthOptions]);

  const saveDobFromDraft = () => {
    const formatted = formatDobParts(draftMonth, draftDay, draftYear);
    setDob(formatted);
    setDobOpen(false);
  };

  return (
    <>
      <View style={styles.form}>
        {/* First Name */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your legal first name"
            placeholderTextColor={Colors.placeholder}
            autoCapitalize="words"
            maxLength={16} // ✅ limit to 16
            style={[
              styles.input,
              firstFocused ? styles.inputFocused : styles.inputIdle,
            ]}
            onFocus={() => setFirstFocused(true)}
            onBlur={() => setFirstFocused(false)}
          />
        </View>

        {/* Last Name */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter your legal last name"
            placeholderTextColor={Colors.placeholder}
            autoCapitalize="words"
            maxLength={16} // ✅ limit to 16
            style={[
              styles.input,
              lastFocused ? styles.inputFocused : styles.inputIdle,
            ]}
            onFocus={() => setLastFocused(true)}
            onBlur={() => setLastFocused(false)}
          />
        </View>

        {/* ✅ DOB (opens custom picker modal) */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Date of Birth</Text>

          <Pressable
            onPress={() => setDobOpen(true)}
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
                fontSize: scale(14),
                color: dob?.trim()?.length ? Colors.text : Colors.placeholder,
              }}
              numberOfLines={1}
            >
              {dobDisplay}
            </Text>

            <Ionicons name="calendar-outline" size={scale(18)} color="#6B7280" />
          </Pressable>
        </View>

        {/* ✅ CONTACT NUMBER (fixed +63 prefix, NO forcing 9, show red validation text) */}
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
                fontSize: scale(14),
                color: Colors.text,
                fontWeight: "700",
                marginRight: scale(10),
              }}
            >
              {PREFIX}
            </Text>

            <TextInput
              value={localPhone}
              onChangeText={commitPhone}
              placeholder="9XXXXXXXXX"
              placeholderTextColor={Colors.placeholder}
              keyboardType="number-pad"
              style={{
                flex: 1,
                fontSize: scale(14),
                color: Colors.text,
                paddingVertical: 0,
              }}
              onFocus={() => {
                setContactFocused(true);
              }}
              onBlur={() => {
                setContactFocused(false);
                setContactTouched(true);
              }}
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
            onPress={() => setGenderOpen(true)}
            hitSlop={10}
            style={({ pressed }) => [styles.select, pressed ? { opacity: 0.95 } : null]}
          >
            <Text style={styles.selectText} numberOfLines={1}>
              {selectedGenderLabel}
            </Text>
            <Ionicons name="chevron-down" size={scale(18)} color="#6B7280" />
          </Pressable>
        </View>

        <View style={{ height: vscale(80) }} />
      </View>

      {/* ---------------- DOB MAIN MODAL ---------------- */}
      <Modal
        visible={dobOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDobOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDobOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Select Date of Birth</Text>

            <View style={{ marginBottom: vscale(10) }}>
              <Text style={{ color: "#111827", fontWeight: "800", fontSize: scale(13) }}>
                {draftDobLabel}
              </Text>
              <Text style={{ color: "#6B7280", marginTop: vscale(4), fontSize: scale(12) }}>
                Pick Month, Day, and Year separately.
              </Text>
            </View>

            <View style={{ gap: vscale(10) }}>
              <Pressable
                onPress={() => setMonthOpen(true)}
                style={[styles.select, { borderColor: "#E5E7EB" }]}
              >
                <Text style={[styles.selectText, { color: "#111827" }]}>
                  Month: {monthOptions[draftMonth]}
                </Text>
                <Ionicons name="chevron-down" size={scale(18)} color="#6B7280" />
              </Pressable>

              <Pressable
                onPress={() => setDayOpen(true)}
                style={[styles.select, { borderColor: "#E5E7EB" }]}
              >
                <Text style={[styles.selectText, { color: "#111827" }]}>
                  Day: {draftDay}
                </Text>
                <Ionicons name="chevron-down" size={scale(18)} color="#6B7280" />
              </Pressable>

              <Pressable
                onPress={() => setYearOpen(true)}
                style={[styles.select, { borderColor: "#E5E7EB" }]}
              >
                <Text style={[styles.selectText, { color: "#111827" }]}>
                  Year: {draftYear}
                </Text>
                <Ionicons name="chevron-down" size={scale(18)} color="#6B7280" />
              </Pressable>
            </View>

            <View style={{ marginTop: vscale(12) }}>
              <Pressable onPress={saveDobFromDraft} style={styles.modalCancel}>
                <Text style={[styles.modalCancelText, { color: "#111827" }]}>Save</Text>
              </Pressable>

              <Pressable
                onPress={() => setDobOpen(false)}
                style={[styles.modalCancel, { marginTop: vscale(8) }]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>

            {/* ---------- Month Picker Modal ---------- */}
            <Modal
              visible={monthOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setMonthOpen(false)}
            >
              <Pressable style={styles.modalOverlay} onPress={() => setMonthOpen(false)}>
                <Pressable style={styles.modalSheet} onPress={() => {}}>
                  <Text style={styles.modalTitle}>Select Month</Text>
                  <ScrollView style={{ maxHeight: vscale(320) }}>
                    {monthOptions.map((label, idx) => {
                      const active = idx === draftMonth;

                      const isFutureMonth = draftYear === currentYear && idx > currentMonthIndex0;
                      const disabled = isFutureMonth;

                      return (
                        <Pressable
                          key={label}
                          onPress={() => {
                            if (disabled) return;
                            setDraftMonth(idx);
                            setMonthOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.modalItem,
                            active ? styles.modalItemActive : null,
                            disabled ? { opacity: 0.45 } : null,
                            pressed && !disabled ? { opacity: 0.92 } : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.modalItemText,
                              active ? styles.modalItemTextActive : null,
                            ]}
                          >
                            {label}
                          </Text>
                          {active ? (
                            <Ionicons name="checkmark" size={scale(18)} color={activeBlue} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Pressable onPress={() => setMonthOpen(false)} style={styles.modalCancel}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </Modal>

            {/* ---------- Day Picker Modal ---------- */}
            <Modal
              visible={dayOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setDayOpen(false)}
            >
              <Pressable style={styles.modalOverlay} onPress={() => setDayOpen(false)}>
                <Pressable style={styles.modalSheet} onPress={() => {}}>
                  <Text style={styles.modalTitle}>Select Day</Text>
                  <ScrollView style={{ maxHeight: vscale(320) }}>
                    {dayOptions.map((d) => {
                      const active = d === draftDay;

                      return (
                        <Pressable
                          key={String(d)}
                          onPress={() => {
                            setDraftDay(d);
                            setDayOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.modalItem,
                            active ? styles.modalItemActive : null,
                            pressed ? { opacity: 0.92 } : null,
                          ]}
                        >
                          <Text style={[styles.modalItemText, active ? styles.modalItemTextActive : null]}>
                            {d}
                          </Text>
                          {active ? (
                            <Ionicons name="checkmark" size={scale(18)} color={activeBlue} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Pressable onPress={() => setDayOpen(false)} style={styles.modalCancel}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </Modal>

            {/* ---------- Year Picker Modal ---------- */}
            <Modal
              visible={yearOpen}
              transparent
              animationType="fade"
              onRequestClose={() => setYearOpen(false)}
            >
              <Pressable style={styles.modalOverlay} onPress={() => setYearOpen(false)}>
                <Pressable style={styles.modalSheet} onPress={() => {}}>
                  <Text style={styles.modalTitle}>Select Year</Text>
                  <ScrollView style={{ maxHeight: vscale(320) }}>
                    {yearOptions.map((y) => {
                      const active = y === draftYear;

                      return (
                        <Pressable
                          key={String(y)}
                          onPress={() => {
                            setDraftYear(y);
                            setYearOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.modalItem,
                            active ? styles.modalItemActive : null,
                            pressed ? { opacity: 0.92 } : null,
                          ]}
                        >
                          <Text style={[styles.modalItemText, active ? styles.modalItemTextActive : null]}>
                            {y}
                          </Text>
                          {active ? (
                            <Ionicons name="checkmark" size={scale(18)} color={activeBlue} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <Pressable onPress={() => setYearOpen(false)} style={styles.modalCancel}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </Modal>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ---------------- Gender Modal ---------------- */}
      <Modal
        visible={genderOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setGenderOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setGenderOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Select Gender</Text>

            {genderOptions.map((opt) => {
              const active = opt.id === gender;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    setGender(opt.id);
                    setGenderOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.modalItem,
                    active ? styles.modalItemActive : null,
                    pressed ? { opacity: 0.92 } : null,
                  ]}
                >
                  <Text style={[styles.modalItemText, active ? styles.modalItemTextActive : null]}>
                    {opt.label}
                  </Text>

                  {active ? (
                    <Ionicons name="checkmark" size={scale(18)} color={activeBlue} />
                  ) : null}
                </Pressable>
              );
            })}

            <Pressable onPress={() => setGenderOpen(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
