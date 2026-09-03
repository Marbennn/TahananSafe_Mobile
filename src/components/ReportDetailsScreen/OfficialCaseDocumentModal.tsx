import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";

import type { CaseDocumentDto } from "../../api/reports";

type DocumentFieldDefinition = {
  key: string;
  label: string;
};

type Props = {
  visible: boolean;
  document: CaseDocumentDto | null;
  fallbackReference?: string;
  onClose: () => void;
};

const DOCUMENT_FIELD_DEFINITIONS: Record<string, DocumentFieldDefinition[]> = {
  "mediation-notice": [
    { key: "caseId", label: "Case ID" },
    { key: "complainant", label: "Complainant" },
    { key: "respondent", label: "Respondent" },
    { key: "incidentType", label: "Incident Type" },
    { key: "scheduledAt", label: "Mediation Date and Time" },
    { key: "venue", label: "Venue" },
    { key: "issuedAt", label: "Date Issued" },
    { key: "additionalInstructions", label: "Additional Instructions" },
  ],
  "settlement-outcome": [
    { key: "caseId", label: "Case ID" },
    { key: "complainant", label: "Complainant" },
    { key: "respondent", label: "Respondent" },
    { key: "incidentType", label: "Incident Type" },
    { key: "mediationDate", label: "Mediation Date and Time" },
    { key: "venue", label: "Venue" },
    { key: "outcome", label: "Confirmed Outcome" },
    { key: "settlementTerms", label: "Settlement Terms" },
    { key: "otherAttendees", label: "Other Attendees" },
    { key: "issuedAt", label: "Date Prepared" },
  ],
  certification: [
    { key: "caseId", label: "Case ID" },
    { key: "complainant", label: "Complainant" },
    { key: "respondent", label: "Respondent" },
    { key: "incidentType", label: "Incident Type" },
    { key: "mediationDate", label: "Mediation Date and Time" },
    { key: "venue", label: "Venue" },
    { key: "outcome", label: "Confirmed Outcome" },
    { key: "certificationDetails", label: "Certification Details" },
    { key: "issuedAt", label: "Date Issued" },
  ],
};

function getDocumentStatement(type?: string) {
  if (type === "mediation-notice") {
    return "The parties named below are notified of the confirmed initial mediation schedule and are requested to appear at the stated date and time.";
  }

  if (type === "settlement-outcome") {
    return "This document records the factual outcome entered for the barangay mediation session. It must be checked against the official case record before release.";
  }

  return "This certification records the mediation outcome reflected in the official barangay case file. It does not replace any certification required by applicable law.";
}

function titleFromKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function valueToText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(valueToText).filter(Boolean).join(", ");

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function displayDocumentValue(key: string, value: unknown) {
  const text = valueToText(value);
  const normalizedKey = key.toLowerCase();

  if (text && (normalizedKey.endsWith("at") || normalizedKey.includes("date"))) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }

  return text || "Not provided";
}

function pdfSafeText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapPdfText(value: unknown, maxCharacters: number) {
  const source = String(value ?? "").trim();
  if (!source) return ["Not provided"];

  const lines: string[] = [];
  for (const paragraph of source.split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const chunks: string[] = [];
      for (let start = 0; start < word.length; start += maxCharacters) {
        chunks.push(word.slice(start, start + maxCharacters));
      }

      for (const chunk of chunks) {
        const candidate = current ? `${current} ${chunk}` : chunk;
        if (candidate.length <= maxCharacters) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = chunk;
        }
      }
    }

    if (current) lines.push(current);
  }

  return lines.length ? lines : ["Not provided"];
}

function asciiToBase64(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < value.length; index += 3) {
    const byte1 = value.charCodeAt(index) & 0xff;
    const hasByte2 = index + 1 < value.length;
    const hasByte3 = index + 2 < value.length;
    const byte2 = hasByte2 ? value.charCodeAt(index + 1) & 0xff : 0;
    const byte3 = hasByte3 ? value.charCodeAt(index + 2) & 0xff : 0;
    const packed = (byte1 << 16) | (byte2 << 8) | byte3;

    output += alphabet[(packed >> 18) & 63];
    output += alphabet[(packed >> 12) & 63];
    output += hasByte2 ? alphabet[(packed >> 6) & 63] : "=";
    output += hasByte3 ? alphabet[packed & 63] : "=";
  }

  return output;
}

function buildOfficialDocumentPdfBase64({
  document,
  definitions,
  fields,
  reference,
}: {
  document: CaseDocumentDto;
  definitions: DocumentFieldDefinition[];
  fields: Record<string, unknown>;
  reference: string;
}) {
  const pageWidth = 595;
  const pageHeight = 842;
  const left = 48;
  const right = pageWidth - 48;
  const pages: string[][] = [[]];
  let pageIndex = 0;
  let cursorTop = 48;

  const currentPage = () => pages[pageIndex];
  const addText = (
    text: string,
    x: number,
    top: number,
    size = 10,
    bold = false,
    color: [number, number, number] = [0.118, 0.161, 0.231],
  ) => {
    currentPage().push(
      `BT ${color.join(" ")} rg /F${bold ? "2" : "1"} ${size} Tf 1 0 0 1 ${x} ${pageHeight - top} Tm (${pdfSafeText(text)}) Tj ET`,
    );
  };
  const addLine = (
    x1: number,
    top1: number,
    x2: number,
    top2: number,
    width = 1,
    color: [number, number, number] = [0.796, 0.835, 0.882],
  ) => {
    currentPage().push(
      `${color.join(" ")} RG ${width} w ${x1} ${pageHeight - top1} m ${x2} ${pageHeight - top2} l S`,
    );
  };
  const addDocumentHeader = (continued = false) => {
    addText(
      "REPUBLIC OF THE PHILIPPINES - BARANGAY CASE MANAGEMENT",
      126,
      cursorTop,
      8,
      true,
      [0.278, 0.333, 0.412],
    );
    cursorTop += 22;
    addText(
      `${String(document.title || "Case Document").toUpperCase()}${continued ? " - CONTINUED" : ""}`,
      left,
      cursorTop,
      continued ? 15 : 18,
      true,
      [0, 0.114, 0.239],
    );
    cursorTop += 18;
    addLine(left, cursorTop, right, cursorTop, 2.5, [0.027, 0.318, 0.612]);
    cursorTop += 22;
  };
  const startNewPage = () => {
    pages.push([]);
    pageIndex += 1;
    cursorTop = 48;
    addDocumentHeader(true);
  };
  const ensureSpace = (height: number) => {
    if (cursorTop + height > 770) startNewPage();
  };

  addDocumentHeader();
  addText(`Reference: ${reference}`, left, cursorTop, 9, false, [0.392, 0.455, 0.545]);
  addText(
    String(document.status || "released").toUpperCase(),
    right - 62,
    cursorTop,
    8,
    true,
    [0.278, 0.333, 0.412],
  );
  cursorTop += 28;

  const statementLines = wrapPdfText(getDocumentStatement(document.type), 88);
  addLine(left, cursorTop - 3, left, cursorTop + statementLines.length * 14 + 5, 3, [0.027, 0.318, 0.612]);
  statementLines.forEach((line, index) => {
    addText(line, left + 12, cursorTop + index * 14, 10, false, [0.278, 0.333, 0.412]);
  });
  cursorTop += statementLines.length * 14 + 20;

  definitions.forEach((field) => {
    const valueLines = wrapPdfText(displayDocumentValue(field.key, fields[field.key]), 58);
    const rowHeight = Math.max(30, valueLines.length * 13 + 12);
    ensureSpace(rowHeight + 4);
    addLine(left, cursorTop, right, cursorTop);
    addText(field.label, left, cursorTop + 17, 9, true, [0.392, 0.455, 0.545]);
    valueLines.forEach((line, index) => {
      addText(line, left + 145, cursorTop + 17 + index * 13, 10, true);
    });
    cursorTop += rowHeight;
  });
  addLine(left, cursorTop, right, cursorTop);

  ensureSpace(120);
  cursorTop += 54;
  addLine(left, cursorTop, left + 205, cursorTop, 0.8, [0.278, 0.333, 0.412]);
  addLine(right - 205, cursorTop, right, cursorTop, 0.8, [0.278, 0.333, 0.412]);
  addText("Prepared / Verified by Barangay Secretary", left + 15, cursorTop + 14, 8, false, [0.392, 0.455, 0.545]);
  addText("Authorized by Barangay Captain", right - 174, cursorTop + 14, 8, false, [0.392, 0.455, 0.545]);
  cursorTop += 48;
  addLine(left, cursorTop, right, cursorTop, 0.6, [0.886, 0.91, 0.941]);
  const footerLines = wrapPdfText(
    "Generated through TahananSafe. Verify every factual entry against the official barangay case record before use or release.",
    100,
  );
  footerLines.forEach((line, index) => {
    addText(line, left + 35, cursorTop + 16 + index * 11, 7, false, [0.392, 0.455, 0.545]);
  });

  const objectCount = 4 + pages.length * 2;
  const objects: string[] = new Array(objectCount + 1).fill("");
  const pageObjectNumbers = pages.map((_, index) => 5 + index * 2);

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers
    .map((number) => `${number} 0 R`)
    .join(" ")}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pages.forEach((commands, index) => {
    const pageObjectNumber = pageObjectNumbers[index];
    const contentObjectNumber = pageObjectNumber + 1;
    const stream = commands.join("\n");
    objects[pageObjectNumber] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n%TahananSafe\n";
  const offsets = new Array(objectCount + 1).fill(0);
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    offsets[objectNumber] = pdf.length;
    pdf += `${objectNumber} 0 obj\n${objects[objectNumber]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return asciiToBase64(pdf);
}

function safeFileName(value: string) {
  const cleaned = value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80);
  return cleaned || "TahananSafe-Case-Document";
}

export default function OfficialCaseDocumentModal({
  visible,
  document,
  fallbackReference,
  onClose,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const fields = document?.fields || {};
  const definitions = useMemo(() => {
    if (!document) return [];

    const configured = DOCUMENT_FIELD_DEFINITIONS[String(document.type || "")];
    if (configured?.length) return configured;

    return Object.keys(document.fields || {}).map((key) => ({
      key,
      label: titleFromKey(key),
    }));
  }, [document]);

  if (!document) return null;

  const title = String(document.title || "Case Document");
  const status = String(document.status || "released").toUpperCase();
  const reference = valueToText(fields.caseId) || fallbackReference || "Not provided";

  const downloadDocument = async () => {
    if (downloading) return;

    setDownloading(true);
    try {
      const base64 = buildOfficialDocumentPdfBase64({
        document,
        definitions,
        fields,
        reference,
      });
      const fileBaseName = safeFileName(`TahananSafe-${title}-${reference}`);

      if (Platform.OS === "android") {
        const initialDirectory = FileSystem.StorageAccessFramework.getUriForDirectoryInRoot("Download");
        const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
          initialDirectory,
        );

        if (!permission.granted) return;

        const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permission.directoryUri,
          fileBaseName,
          "application/pdf",
        );
        await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        Alert.alert("PDF downloaded", "The official document was saved in the folder you selected.");
        return;
      }

      if (!FileSystem.documentDirectory) {
        throw new Error("Document storage is unavailable on this device.");
      }

      const fileUri = `${FileSystem.documentDirectory}${fileBaseName}.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      Alert.alert(
        "PDF downloaded",
        "The official document was saved in TahananSafe's Documents folder and is available from the Files app.",
      );
    } catch (error) {
      Alert.alert(
        "Download failed",
        error instanceof Error ? error.message : "The document could not be downloaded.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close official document"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <View style={styles.dialogHeaderTopRow}>
                <View style={styles.dialogHeaderText}>
                  <Text style={styles.eyebrow}>OFFICIAL CASE DOCUMENT</Text>
                  <Text style={styles.dialogTitle} numberOfLines={2}>
                    {title}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close official document"
                  hitSlop={10}
                  onPress={onClose}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={23} color="#64748B" />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Download official document as PDF"
                disabled={downloading}
                onPress={() => void downloadDocument()}
                style={({ pressed }) => [
                  styles.downloadButton,
                  pressed && styles.pressed,
                  downloading && styles.downloadButtonDisabled,
                ]}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.downloadButtonText}>
                  {downloading ? "Preparing PDF..." : "Download PDF"}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.documentScroll}
              contentContainerStyle={styles.documentScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.paper}>
                <View style={styles.paperHeader}>
                  <Text style={styles.republicLabel}>
                    REPUBLIC OF THE PHILIPPINES · BARANGAY CASE MANAGEMENT
                  </Text>
                  <Text style={styles.documentTitle}>{title.toUpperCase()}</Text>
                </View>

                <View style={styles.referenceRow}>
                  <Text style={styles.referenceText}>Reference: {reference}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{status}</Text>
                  </View>
                </View>

                <View style={styles.statementBox}>
                  <Text style={styles.statementText}>{getDocumentStatement(document.type)}</Text>
                </View>

                <View style={styles.fieldTable}>
                  {definitions.map((field) => (
                    <View key={field.key} style={styles.fieldRow}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <Text style={styles.fieldValue} selectable>
                        {displayDocumentValue(field.key, fields[field.key])}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.signatures}>
                  <View style={styles.signatureBlock}>
                    <View style={styles.signatureLine} />
                    <Text style={styles.signatureText}>Prepared / Verified by Barangay Secretary</Text>
                  </View>
                  <View style={styles.signatureBlock}>
                    <View style={styles.signatureLine} />
                    <Text style={styles.signatureText}>Authorized by Barangay Captain</Text>
                  </View>
                </View>

                <Text style={styles.footerText}>
                  Generated through TahananSafe. Verify every factual entry against the official barangay case record before use or release.
                </Text>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    paddingHorizontal: 12,
  },
  safeArea: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "96%",
    alignSelf: "center",
  },
  dialog: {
    maxHeight: "100%",
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 18,
  },
  dialogHeader: {
    minHeight: 72,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  dialogHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dialogHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: "#07519C",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  dialogTitle: {
    marginTop: 4,
    color: "#0F172A",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  downloadButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    backgroundColor: "#07519C",
    paddingHorizontal: 14,
  },
  downloadButtonDisabled: {
    opacity: 0.7,
  },
  downloadButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.7,
  },
  documentScroll: {
    minHeight: 0,
  },
  documentScrollContent: {
    padding: 14,
  },
  paper: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 20,
  },
  paperHeader: {
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "#07519C",
    paddingBottom: 15,
  },
  republicLabel: {
    color: "#64748B",
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 1.15,
    textAlign: "center",
  },
  documentTitle: {
    marginTop: 7,
    color: "#001D3D",
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: 0.7,
    textAlign: "center",
  },
  referenceRow: {
    marginTop: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  referenceText: {
    flex: 1,
    color: "#64748B",
    fontSize: 10,
    lineHeight: 15,
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusBadgeText: {
    color: "#475569",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  statementBox: {
    marginTop: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#07519C",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  statementText: {
    color: "#475569",
    fontSize: 11,
    lineHeight: 17,
  },
  fieldTable: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  fieldRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 10,
  },
  fieldLabel: {
    width: "39%",
    color: "#64748B",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
  },
  fieldValue: {
    flex: 1,
    color: "#1E293B",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  signatures: {
    marginTop: 44,
    flexDirection: "row",
    gap: 18,
  },
  signatureBlock: {
    flex: 1,
    alignItems: "center",
  },
  signatureLine: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#475569",
  },
  signatureText: {
    marginTop: 7,
    color: "#64748B",
    fontSize: 8,
    lineHeight: 12,
    textAlign: "center",
  },
  footerText: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 10,
    color: "#64748B",
    fontSize: 8,
    lineHeight: 12,
    textAlign: "center",
  },
});
