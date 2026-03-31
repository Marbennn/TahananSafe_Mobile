import React from "react";
import StepTutorialModal, { type TutorialStep } from "./StepTutorialModal";

const STEPS: TutorialStep[] = [
  {
    icon: "settings-outline",
    iconColor: "#1A3C6E",
    title: "Open Settings",
    description:
      "Go to the Settings tab and look for the Verify Account card near the top of the screen.",
  },
  {
    icon: "person-circle-outline",
    iconColor: "#D97706",
    title: "Start Verification",
    description:
      "Tap Verify now to begin the account verification flow and view the current verification stage.",
  },
  {
    icon: "camera-outline",
    iconColor: "#2E7D32",
    title: "Take a Selfie",
    description:
      "Capture a clear selfie first. Once submitted, your account moves to the semi-verified stage.",
  },
  {
    icon: "card-outline",
    iconColor: "#6A1B9A",
    title: "Choose a Valid ID",
    description:
      "Select the ID type you want to submit, such as Passport, Driver's License, or another valid Philippine ID.",
  },
  {
    icon: "image-outline",
    iconColor: "#1565C0",
    title: "Upload a Clear ID Photo",
    description:
      "Take or upload a readable photo of your ID. Make sure the image is not blurry and all details are visible.",
  },
  {
    icon: "shield-checkmark-outline",
    iconColor: "#C62828",
    title: "Submit for Review",
    description:
      "Submit the ID and wait for review. Your status will update in the app once verification is approved.",
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function VerifyAccountTutorialModal({ visible, onClose }: Props) {
  return (
    <StepTutorialModal
      visible={visible}
      onClose={onClose}
      title="How to Verify Your Account"
      headerIcon="shield-checkmark-outline"
      steps={STEPS}
    />
  );
}
