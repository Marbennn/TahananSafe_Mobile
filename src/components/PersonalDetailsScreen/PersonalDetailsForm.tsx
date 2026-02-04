// src/components/PersonalDetailsScreen/PersonalDetailsForm.tsx
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
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
  dob: string;
  contactNumber: string;
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

  const [firstFocused, setFirstFocused] = useState(false);
  const [lastFocused, setLastFocused] = useState(false);
  const [dobFocused, setDobFocused] = useState(false);
  const [contactFocused, setContactFocused] = useState(false);

  const [genderOpen, setGenderOpen] = useState(false);

  const selectedGenderLabel =
    genderOptions.find((g) => g.id === gender)?.label ?? "Select your gender";

  return (
    <>
      <View style={styles.form}>
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your legal first name"
            placeholderTextColor={Colors.placeholder}
            autoCapitalize="words"
            style={[
              styles.input,
              firstFocused ? styles.inputFocused : styles.inputIdle,
            ]}
            onFocus={() => setFirstFocused(true)}
            onBlur={() => setFirstFocused(false)}
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter your legal last name"
            placeholderTextColor={Colors.placeholder}
            autoCapitalize="words"
            style={[
              styles.input,
              lastFocused ? styles.inputFocused : styles.inputIdle,
            ]}
            onFocus={() => setLastFocused(true)}
            onBlur={() => setLastFocused(false)}
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Date of Birth</Text>
          <TextInput
            value={dob}
            onChangeText={setDob}
            placeholder="02 / 24 / 2000"
            placeholderTextColor={Colors.placeholder}
            keyboardType="numbers-and-punctuation"
            style={[styles.input, dobFocused ? styles.inputFocused : styles.inputIdle]}
            onFocus={() => setDobFocused(true)}
            onBlur={() => setDobFocused(false)}
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            value={contactNumber}
            onChangeText={setContactNumber}
            placeholder="+63 909 000 0000"
            placeholderTextColor={Colors.placeholder}
            keyboardType="phone-pad"
            style={[
              styles.input,
              contactFocused ? styles.inputFocused : styles.inputIdle,
            ]}
            onFocus={() => setContactFocused(true)}
            onBlur={() => setContactFocused(false)}
          />
        </View>

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

        {/* space so last input isn't blocked by bottom button */}
        <View style={{ height: vscale(80) }} />
      </View>

      {/* Gender Modal */}
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
                  <Text
                    style={[
                      styles.modalItemText,
                      active ? styles.modalItemTextActive : null,
                    ]}
                  >
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
