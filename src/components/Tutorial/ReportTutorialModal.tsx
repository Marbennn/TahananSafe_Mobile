import React from "react";
import StepTutorialModal, { type TutorialStep } from "./StepTutorialModal";

const STEPS: TutorialStep[] = [
  {
    icon: "add-circle",
    iconColor: "#1A3C6E",
    title: "Tap the + Button",
    description:
      "On the Home screen, tap the blue + button at the bottom right to open the quick actions menu.",
  },
  {
    icon: "document-text-outline",
    iconColor: "#D4770B",
    title: "Click Incident Log",
    description:
      "From the quick actions menu, tap Incident Log to open the report form.",
  },
  {
    icon: "create-outline",
    iconColor: "#2E7D32",
    title: "Fill Up the Incident Log",
    description:
      "Enter the incident details such as the date, time, location, and what happened.",
  },
  {
    icon: "shield-checkmark-outline",
    iconColor: "#1565C0",
    title: "Tap Secure Complaint",
    description:
      "When everything is complete, tap Secure Complaint to submit your report to the Barangay.",
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ReportTutorialModal({ visible, onClose }: Props) {
  return (
    <StepTutorialModal
      visible={visible}
      onClose={onClose}
      title="How to Submit a Report"
      headerIcon="book-outline"
      steps={STEPS}
    />
  );
}
