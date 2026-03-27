import React, { useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus, View } from "react-native";

const IDLE_MS = 1 * 60 * 1000; // 15 minutes

interface Props {
  onTimeout: () => void;
  children: React.ReactNode;
}

/**
 * Wraps authenticated screens.
 * Any touch resets the 15-minute idle timer.
 * When the timer fires, `onTimeout` is called (should lock to PIN screen).
 * Also tracks background duration — if the app was backgrounded for 15+ minutes,
 * `onTimeout` fires immediately when the user returns.
 */
export default function IdleTimerWrapper({ onTimeout, children }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundAtRef = useRef<number | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, IDLE_MS);
  }, [clearTimer]);

  useEffect(() => {
    resetTimer();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        // Check how long the app was in the background
        if (backgroundAtRef.current) {
          const elapsed = Date.now() - backgroundAtRef.current;
          backgroundAtRef.current = null;

          if (elapsed >= IDLE_MS) {
            // Backgrounded for 15+ minutes → lock immediately
            clearTimer();
            onTimeoutRef.current();
            return;
          }
        }
        // Otherwise resume the idle timer
        resetTimer();
      } else {
        // App going to background — record timestamp and pause timer
        backgroundAtRef.current = Date.now();
        clearTimer();
      }
    });

    return () => {
      clearTimer();
      sub.remove();
    };
  }, [resetTimer, clearTimer]);

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
