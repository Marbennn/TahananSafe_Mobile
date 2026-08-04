import React, { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onEnable: () => void;
  onNotNow: () => void;
};

export default function BiometricsOptInModal({
  visible,
  onClose,
  onEnable,
  onNotNow,
}: Props) {
  const alertPresentedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      alertPresentedRef.current = false;
      return;
    }

    if (alertPresentedRef.current) return;
    alertPresentedRef.current = true;

    const description =
      Platform.OS === "ios"
        ? "Use Face ID to fill your saved login details next time. OTP verification will still be required."
        : "Use fingerprint to fill your saved login details next time. OTP verification will still be required.";
    let handled = false;
    const handleOnce = (callback: () => void) => () => {
      if (handled) return;
      handled = true;
      callback();
    };

    Alert.alert(
      "Enable Biometrics?",
      description,
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: handleOnce(onNotNow),
        },
        {
          text: "Enable",
          onPress: handleOnce(onEnable),
        },
      ],
      {
        cancelable: true,
        onDismiss: handleOnce(onClose),
      }
    );
  }, [onClose, onEnable, onNotNow, visible]);

  return null;
}
