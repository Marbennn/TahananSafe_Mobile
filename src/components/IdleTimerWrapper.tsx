import React, { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus, View } from "react-native";

const IDLE_MS = 15 * 60 * 1000; // 15 minutes

interface Props {
  onTimeout: () => void;
  children: React.ReactNode;
}

/**
 * Wraps authenticated screens.
 * Any touch resets the 15-minute idle timer.
 * When the timer fires, `onTimeout` is called (should trigger logout).
 * Timer is paused while the app is in the background.
 */
export default function IdleTimerWrapper({ onTimeout, children }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    resetTimer();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        // Resume timer when the app comes back to foreground
        resetTimer();
      } else {
        // Pause timer while app is backgrounded
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      sub.remove();
    };
  }, [resetTimer]);

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        resetTimer();
        return false; // don't consume the event
      }}
      onMoveShouldSetResponderCapture={() => {
        resetTimer();
        return false;
      }}
    >
      {children}
    </View>
  );
}
