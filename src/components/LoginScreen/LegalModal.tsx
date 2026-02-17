// src/components/Legal/LegalModal.tsx
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../../theme/colors";

export type LegalMode = "terms" | "privacy";

type Props = {
  visible: boolean;
  mode: LegalMode;
  onClose: () => void;
  scale: (n: number) => number;
  vscale: (n: number) => number;
};

export default function LegalModal({
  visible,
  mode,
  onClose,
  scale,
  vscale,
}: Props) {
  const styles = useMemo(() => createStyles(scale, vscale), [scale, vscale]);

  // ✅ checkbox required for BOTH
  const [agreed, setAgreed] = useState(false);

  React.useEffect(() => {
    if (visible) setAgreed(false);
  }, [visible, mode]);

  const title = mode === "terms" ? "Terms & Conditions" : "Privacy Policy";

  const termsBody = `Last updated: Feb 2026

IMPORTANT NOTICE
Please read these Terms & Conditions carefully. By using the TahananSafe mobile application (“App”), you agree to comply with these Terms. If you do not agree, do not use the App.

1. Definitions
• “App” refers to the TahananSafe mobile application and related services.
• “User” refers to any person who creates an account or uses the App.
• “Barangay Officials” refers to authorized personnel who manage incident reports in the App.
• “Report” refers to any complaint, emergency log, message, or submitted information including attachments.
• “Evidence” refers to photos or other media uploaded by the User.

2. Acceptance of Terms
By accessing or using the App, you confirm that you have read, understood, and agreed to these Terms and will follow applicable laws and community policies.

3. Eligibility and Account Registration
3.1 You must provide accurate and complete information when creating an account.
3.2 You agree not to register using someone else’s identity or misleading credentials.
3.3 You are responsible for safeguarding your password, OTP codes, and any verification credentials.
3.4 You are responsible for all activity that occurs under your account.

4. User Responsibilities
You agree to use the App only for legitimate safety, reporting, and communication purposes and to provide truthful, accurate, and relevant details when submitting reports.

5. Prohibited Conduct
You must NOT:
• Submit false, fabricated, prank, or malicious reports
• Harass, threaten, or abuse any person
• Upload illegal or harmful content
• Attempt to bypass security or access controls
• Impersonate another person or official
• Use the App for spam or promotions

6. Reports, Evidence, and Content
6.1 You retain ownership of content you upload, but you confirm that you have the right to submit it.
6.2 Reports may be reviewed by authorized Barangay Officials for verification, response, and documentation.
6.3 Submitting malicious or fabricated reports may result in restriction and escalation to proper authorities when applicable.

7. Location Services
The App may request location permission to improve report accuracy. If denied, a default/less precise location may be used.

8. Availability and Changes
We may update, change, suspend, or remove features to improve security and performance. We do not guarantee uninterrupted service.

9. Security
We apply reasonable safeguards, but no system is 100% secure. You must protect your account and device.

10. Termination
We may suspend or terminate accounts that violate these Terms or misuse the system.

11. Disclaimers and Liability
The App is provided “as is”. We do not guarantee incident outcomes, response times, or resolution.

12. Agreement
By checking the box below, you confirm that you have read and agree to the Terms & Conditions.`;

  const privacyBody = `Last updated: Feb 2026

IMPORTANT NOTICE
This Privacy Policy explains what information TahananSafe collects, why we collect it, how it is used, and what choices you have.

1. What We Collect
We may collect:
• Account data (name, email, login identifiers)
• Report details (incident narrative, type, timestamps)
• Evidence attachments you submit (photos)
• Location information (if you allow permission)
• Device/app metadata (basic diagnostics for stability)

2. Why We Collect It
We collect data to:
• Authenticate users and protect accounts
• Record and route incident reports to authorized barangay officials
• Support communication threads related to reports
• Improve safety features and system reliability
• Detect abuse, spam, or malicious activity

3. How We Use Data
We use collected data to operate core features:
• Incident reporting and tracking
• Evidence handling and viewing for authorized officials
• Notifications and status updates
• Audit trails for accountability (when applicable)

4. Data Sharing
Your reports may be visible to authorized barangay officials for review and response.
We do not sell your personal data.

We may share limited information when required by law, legal request, or to protect the safety of users and the community.

5. Storage & Security
We use security measures to protect stored data, including role-based access for authorized personnel.
No storage system can guarantee perfect security, but we work to minimize risks.

6. Data Retention
We keep data only as long as needed for reporting, legal compliance, and legitimate operational purposes.
Some reports may be retained based on local retention requirements.

7. Your Rights
You may request:
• Updates/corrections to account data
• Deletion of account data (subject to retention requirements)
• Clarification on how your data is handled

8. Contact
For privacy requests, contact the barangay system administrator.

9. Agreement
By checking the box below, you confirm you have read and understood this Privacy Policy.`;

  const body = mode === "terms" ? termsBody : privacyBody;

  // ✅ button disabled until checkbox checked (for both)
  const isButtonDisabled = !agreed;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>

            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.65 },
              ]}
            >
              <Ionicons name="close" size={scale(18)} color="#111827" />
            </Pressable>
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator
            contentContainerStyle={styles.body}
          >
            <Text style={styles.text}>{body}</Text>

            {/* ✅ Checkbox for BOTH */}
            <Pressable
              onPress={() => setAgreed((v) => !v)}
              style={({ pressed }) => [
                styles.checkRow,
                pressed && { opacity: 0.9 },
              ]}
              hitSlop={6}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && (
                  <Ionicons name="checkmark" size={scale(14)} color="#FFFFFF" />
                )}
              </View>

              <Text style={styles.checkText}>
                {mode === "terms"
                  ? "I have read and agree to the Terms & Conditions"
                  : "I have read and understand the Privacy Policy"}
              </Text>
            </Pressable>

            <View style={{ height: vscale(8) }} />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              disabled={isButtonDisabled}
              onPress={onClose}
              style={({ pressed }) => [
                styles.primaryBtnPressable,
                pressed && !isButtonDisabled && { opacity: 0.88 },
                isButtonDisabled && styles.disabledPressable,
              ]}
            >
              <LinearGradient
                colors={Colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtnGradient}
              >
                <Text style={styles.primaryBtnText}>I Understand</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(scale: (n: number) => number, vscale: (n: number) => number) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(18),
    },

    card: {
      width: "100%",
      maxWidth: scale(420),
      maxHeight: "82%",
      backgroundColor: "#FFFFFF",
      borderRadius: scale(16),
      overflow: "hidden",
    },

    header: {
      paddingHorizontal: scale(16),
      paddingTop: vscale(14),
      paddingBottom: vscale(10),
      borderBottomWidth: 1,
      borderBottomColor: "#E5E7EB",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    title: {
      fontSize: scale(14),
      fontWeight: "800",
      color: "#111827",
      maxWidth: "85%",
    },

    closeBtn: {
      width: scale(32),
      height: scale(32),
      borderRadius: scale(10),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F3F4F6",
    },

    body: {
      paddingHorizontal: scale(16),
      paddingVertical: vscale(14),
    },

    text: {
      fontSize: scale(12),
      lineHeight: scale(18),
      color: "#374151",
    },

    checkRow: {
      marginTop: vscale(14),
      flexDirection: "row",
      alignItems: "center",
      gap: scale(10),
      backgroundColor: "#F9FAFB",
      borderWidth: 1,
      borderColor: "#E5E7EB",
      borderRadius: scale(12),
      paddingVertical: vscale(10),
      paddingHorizontal: scale(12),
    },

    checkbox: {
      width: scale(20),
      height: scale(20),
      borderRadius: scale(6),
      borderWidth: 2,
      borderColor: "#9CA3AF",
      backgroundColor: "#FFFFFF",
      alignItems: "center",
      justifyContent: "center",
    },

    checkboxChecked: {
      backgroundColor: "#111827",
      borderColor: "#111827",
    },

    checkText: {
      flex: 1,
      fontSize: scale(12),
      lineHeight: scale(16),
      color: "#111827",
      fontWeight: "700",
    },

    footer: {
      paddingHorizontal: scale(16),
      paddingVertical: vscale(12),
      borderTopWidth: 1,
      borderTopColor: "#E5E7EB",
    },

    primaryBtnPressable: {
      borderRadius: scale(12),
      overflow: "hidden",
    },

    primaryBtnGradient: {
      height: scale(44),
      borderRadius: scale(12),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: scale(14),
    },

    primaryBtnText: {
      color: "#FFFFFF",
      fontSize: scale(13),
      fontWeight: "800",
    },

    disabledPressable: {
      opacity: 0.6,
    },
  });
}
