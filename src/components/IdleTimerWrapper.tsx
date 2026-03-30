import React, { useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus, View } from "react-native";

const IDLE_MS = 15 * 60 * 1000;

interface Props {
  onTimeout: () => void | Promise<void>;
  children: React.ReactNode;
}

/**
 * Wraps authenticated screens and locks them after 15 minutes without touch input.
 * If the app stays in the background for 15+ minutes, it locks as soon as it returns.
 */
export default function IdleTimerWrapper({ onTimeout, children }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundAtRef = useRef<number | null>(null);
  const timeoutInFlightRef = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const triggerTimeout = useCallback(() => {
    if (timeoutInFlightRef.current) return;
    timeoutInFlightRef.current = true;

    Promise.resolve()
      .then(() => onTimeoutRef.current())
      .finally(() => {
        timeoutInFlightRef.current = false;
      });
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      triggerTimeout();
    }, IDLE_MS);
  }, [clearTimer, triggerTimeout]);

  const handleActivity = useCallback(() => {
    if (timeoutInFlightRef.current) return;
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    resetTimer();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        if (backgroundAtRef.current) {
          const elapsed = Date.now() - backgroundAtRef.current;
          backgroundAtRef.current = null;

          if (elapsed >= IDLE_MS) {
            clearTimer();
            triggerTimeout();
            return;
          }
        }

        resetTimer();
        return;
      }

      backgroundAtRef.current = Date.now();
      clearTimer();
    });

    return () => {
      clearTimer();
      sub.remove();
    };
  }, [clearTimer, resetTimer, triggerTimeout]);

  return (
    <View
      style={{ flex: 1 }}
      onTouchStart={handleActivity}
      onTouchMove={handleActivity}
      onStartShouldSetResponderCapture={() => {
        handleActivity();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        handleActivity();
        return false;
      }}
    >
      {children}
    </View>
  );
}
