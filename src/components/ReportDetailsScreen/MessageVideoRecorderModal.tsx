import { Ionicons } from "@expo/vector-icons";
import {
  CameraView,
  type CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  maxDurationSeconds: number;
  maxFileSizeBytes: number;
  onCancel: () => void;
  onRecorded: (uri: string) => void | Promise<void>;
};

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 10 ? `${Math.round(megabytes)} MB` : `${megabytes.toFixed(1)} MB`;
}

export default function MessageVideoRecorderModal({
  visible,
  maxDurationSeconds,
  maxFileSizeBytes,
  onCancel,
  onRecorded,
}: Props) {
  const [cameraPermission, requestCameraPermission, getCameraPermission] =
    useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission, getMicrophonePermission] =
    useMicrophonePermissions();

  const cameraRef = useRef<CameraView | null>(null);
  const mountedRef = useRef(true);
  const visibleRef = useRef(visible);
  const closeRequestedRef = useRef(!visible);
  const recordingRef = useRef(false);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);
  const processingRef = useRef(false);
  const permissionRequestRef = useRef(false);
  const permissionAlertVisibleRef = useRef(false);
  const settingsOpenedRef = useRef(false);
  const autoPermissionAttemptedRef = useRef(false);
  const recordingSessionRef = useRef(0);
  const recordingStartedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [facing, setFacing] = useState<CameraType>("back");
  const [cameraReady, setCameraReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionSessionReady, setPermissionSessionReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const durationLimit = useMemo(() => {
    const value = Number(maxDurationSeconds);
    return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
  }, [maxDurationSeconds]);

  const fileSizeLimit = useMemo(() => {
    const value = Number(maxFileSizeBytes);
    return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
  }, [maxFileSizeBytes]);

  const hasRequiredPermissions =
    cameraPermission?.granted === true && microphonePermission?.granted === true;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const safelySetRecordingState = useCallback(
    (recording: boolean, stopping: boolean, processing: boolean) => {
      if (!mountedRef.current || !visibleRef.current || closeRequestedRef.current) return;
      setIsRecording(recording);
      setIsStopping(stopping);
      setIsProcessing(processing);
    },
    []
  );

  const invalidateAndStopRecording = useCallback(() => {
    recordingSessionRef.current += 1;
    stopTimer();

    const shouldStopNativeRecording = recordingRef.current || startingRef.current;
    recordingRef.current = false;
    startingRef.current = false;
    stoppingRef.current = false;
    processingRef.current = false;

    if (shouldStopNativeRecording) {
      try {
        cameraRef.current?.stopRecording();
      } catch {
        // The camera may already have stopped while the modal was closing.
      }
    }
  }, [stopTimer]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      visibleRef.current = false;
      closeRequestedRef.current = true;
      invalidateAndStopRecording();
    };
  }, [invalidateAndStopRecording]);

  useEffect(() => {
    visibleRef.current = visible;

    if (visible) {
      closeRequestedRef.current = false;
      autoPermissionAttemptedRef.current = false;
      permissionAlertVisibleRef.current = false;
      settingsOpenedRef.current = false;
      setPermissionSessionReady(false);
      recordingSessionRef.current += 1;
      setFacing("back");
      setCameraReady(false);
      setIsRecording(false);
      setIsStopping(false);
      setIsProcessing(false);
      setElapsedSeconds(0);
      return;
    }

    closeRequestedRef.current = true;
    setPermissionSessionReady(false);
    invalidateAndStopRecording();
  }, [invalidateAndStopRecording, visible]);

  const handleCancel = useCallback(() => {
    if (closeRequestedRef.current) return;

    permissionAlertVisibleRef.current = false;
    settingsOpenedRef.current = false;
    setPermissionSessionReady(false);
    closeRequestedRef.current = true;
    visibleRef.current = false;
    invalidateAndStopRecording();
    onCancel();
  }, [invalidateAndStopRecording, onCancel]);

  const showNativeErrorAlert = useCallback(
    (title: string, message: string) => {
      if (
        permissionAlertVisibleRef.current ||
        !visibleRef.current ||
        closeRequestedRef.current
      ) {
        return;
      }

      permissionAlertVisibleRef.current = true;
      Alert.alert(
        title,
        message,
        [
          {
            text: "Close",
            onPress: () => {
              permissionAlertVisibleRef.current = false;
              handleCancel();
            },
          },
        ],
        {
          cancelable: false,
          onDismiss: () => {
            permissionAlertVisibleRef.current = false;
          },
        }
      );
    },
    [handleCancel]
  );

  const openSettings = useCallback(async () => {
    settingsOpenedRef.current = true;
    try {
      await Linking.openSettings();
    } catch (error: any) {
      settingsOpenedRef.current = false;
      if (visibleRef.current && !closeRequestedRef.current) {
        showNativeErrorAlert(
          "Settings unavailable",
          error?.message || "Open your device settings to enable camera access."
        );
      }
    }
  }, [showNativeErrorAlert]);

  const showNativePermissionAlert = useCallback(
    (cameraGranted: boolean, microphoneGranted: boolean) => {
      if (
        permissionAlertVisibleRef.current ||
        !visibleRef.current ||
        closeRequestedRef.current
      ) {
        return;
      }

      const missingPermissions = [
        !cameraGranted ? "camera" : "",
        !microphoneGranted ? "microphone" : "",
      ].filter(Boolean);
      const missingLabel = missingPermissions.join(" and ");

      permissionAlertVisibleRef.current = true;
      Alert.alert(
        "Permission required",
        `Allow ${missingLabel} access in your device settings to record a message video.`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              permissionAlertVisibleRef.current = false;
              handleCancel();
            },
          },
          {
            text: "Open Settings",
            onPress: () => {
              permissionAlertVisibleRef.current = false;
              void openSettings();
            },
          },
        ],
        {
          cancelable: false,
          onDismiss: () => {
            permissionAlertVisibleRef.current = false;
          },
        }
      );
    },
    [handleCancel, openSettings]
  );

  const requestRequiredPermissions = useCallback(async () => {
    if (permissionRequestRef.current || !visibleRef.current) return;

    permissionRequestRef.current = true;

    try {
      const [currentCameraPermission, currentMicrophonePermission] = await Promise.all([
        getCameraPermission(),
        getMicrophonePermission(),
      ]);
      if (!visibleRef.current || closeRequestedRef.current) return;

      const nextCameraPermission = currentCameraPermission.granted
        ? currentCameraPermission
        : await requestCameraPermission();
      if (!visibleRef.current || closeRequestedRef.current) return;

      const nextMicrophonePermission = currentMicrophonePermission.granted
        ? currentMicrophonePermission
        : await requestMicrophonePermission();
      if (!visibleRef.current || closeRequestedRef.current) return;

      if (!nextCameraPermission.granted || !nextMicrophonePermission.granted) {
        setPermissionSessionReady(false);
        showNativePermissionAlert(
          nextCameraPermission.granted,
          nextMicrophonePermission.granted
        );
      } else {
        setPermissionSessionReady(true);
      }
    } catch (error: any) {
      if (mountedRef.current) setPermissionSessionReady(false);
      if (visibleRef.current && !closeRequestedRef.current) {
        showNativeErrorAlert(
          "Permission error",
          error?.message || "Camera permissions could not be requested."
        );
      }
    } finally {
      permissionRequestRef.current = false;
    }
  }, [
    getCameraPermission,
    getMicrophonePermission,
    requestCameraPermission,
    requestMicrophonePermission,
    showNativeErrorAlert,
    showNativePermissionAlert,
  ]);

  useEffect(() => {
    if (
      !visible ||
      autoPermissionAttemptedRef.current
    ) {
      return;
    }

    autoPermissionAttemptedRef.current = true;
    void requestRequiredPermissions();
  }, [
    requestRequiredPermissions,
    visible,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        nextState !== "active" ||
        !settingsOpenedRef.current ||
        permissionRequestRef.current ||
        !visibleRef.current ||
        closeRequestedRef.current
      ) {
        return;
      }

      settingsOpenedRef.current = false;
      permissionRequestRef.current = true;

      void Promise.all([getCameraPermission(), getMicrophonePermission()])
        .then(([nextCameraPermission, nextMicrophonePermission]) => {
          if (!visibleRef.current || closeRequestedRef.current) return;
          const permissionsGranted =
            nextCameraPermission.granted && nextMicrophonePermission.granted;
          setPermissionSessionReady(permissionsGranted);
          if (!permissionsGranted) {
            showNativePermissionAlert(
              nextCameraPermission.granted,
              nextMicrophonePermission.granted
            );
          }
        })
        .catch((error: any) => {
          if (mountedRef.current) setPermissionSessionReady(false);
          if (visibleRef.current && !closeRequestedRef.current) {
            showNativeErrorAlert(
              "Permission error",
              error?.message || "Camera permissions could not be checked."
            );
          }
        })
        .finally(() => {
          permissionRequestRef.current = false;
        });
    });

    return () => subscription.remove();
  }, [
    getCameraPermission,
    getMicrophonePermission,
    showNativeErrorAlert,
    showNativePermissionAlert,
  ]);

  const startRecording = useCallback(async () => {
    const camera = cameraRef.current;
    if (
      !camera ||
      !visibleRef.current ||
      closeRequestedRef.current ||
      !cameraReady ||
      !hasRequiredPermissions ||
      recordingRef.current ||
      startingRef.current ||
      stoppingRef.current ||
      processingRef.current
    ) {
      return;
    }

    const sessionId = recordingSessionRef.current + 1;
    recordingSessionRef.current = sessionId;
    startingRef.current = true;
    recordingRef.current = true;
    recordingStartedAtRef.current = Date.now();
    setElapsedSeconds(0);
    safelySetRecordingState(true, false, false);

    stopTimer();
    timerRef.current = setInterval(() => {
      if (
        !mountedRef.current ||
        !visibleRef.current ||
        closeRequestedRef.current ||
        sessionId !== recordingSessionRef.current
      ) {
        return;
      }

      const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
      setElapsedSeconds(Math.min(durationLimit, Math.max(0, elapsed)));
    }, 250);

    try {
      const result = await camera.recordAsync({
        maxDuration: durationLimit,
        maxFileSize: fileSizeLimit,
      });

      if (
        !mountedRef.current ||
        !visibleRef.current ||
        closeRequestedRef.current ||
        sessionId !== recordingSessionRef.current
      ) {
        return;
      }

      recordingRef.current = false;
      stoppingRef.current = false;
      stopTimer();

      if (!result?.uri) {
        throw new Error("The camera did not return a recorded video.");
      }

      processingRef.current = true;
      safelySetRecordingState(false, false, true);
      await Promise.resolve(onRecorded(result.uri));
    } catch (error: any) {
      if (
        mountedRef.current &&
        visibleRef.current &&
        !closeRequestedRef.current &&
        sessionId === recordingSessionRef.current
      ) {
        Alert.alert(
          "Recording failed",
          error?.message || "The video could not be recorded. Please try again."
        );
      }
    } finally {
      if (sessionId === recordingSessionRef.current) {
        recordingRef.current = false;
        startingRef.current = false;
        stoppingRef.current = false;
        processingRef.current = false;
        stopTimer();
        safelySetRecordingState(false, false, false);
      }
    }
  }, [
    cameraReady,
    durationLimit,
    fileSizeLimit,
    hasRequiredPermissions,
    onRecorded,
    safelySetRecordingState,
    stopTimer,
  ]);

  const stopRecording = useCallback(() => {
    if (
      !recordingRef.current ||
      stoppingRef.current ||
      closeRequestedRef.current
    ) {
      return;
    }

    stoppingRef.current = true;
    safelySetRecordingState(true, true, false);

    try {
      cameraRef.current?.stopRecording();
    } catch (error: any) {
      stoppingRef.current = false;
      safelySetRecordingState(true, false, false);
      if (visibleRef.current && !closeRequestedRef.current) {
        Alert.alert(
          "Could not stop recording",
          error?.message || "Please try the stop button again."
        );
      }
    }
  }, [safelySetRecordingState]);

  const flipCamera = useCallback(() => {
    if (
      recordingRef.current ||
      startingRef.current ||
      stoppingRef.current ||
      processingRef.current ||
      closeRequestedRef.current
    ) {
      return;
    }

    setCameraReady(false);
    setFacing((current) => (current === "back" ? "front" : "back"));
  }, []);

  const handleCameraMountError = useCallback((event: { message: string }) => {
    if (!mountedRef.current || !visibleRef.current || closeRequestedRef.current) return;
    setCameraReady(false);
    Alert.alert(
      "Camera unavailable",
      event?.message || "The camera preview could not be started."
    );
  }, []);

  const timerLabel = `${formatDuration(elapsedSeconds)} / ${formatDuration(durationLimit)}`;
  const limitDescription = `Recording automatically stops at ${formatDuration(
    durationLimit
  )} or ${formatFileSize(fileSizeLimit)}, whichever comes first.`;
  const controlsDisabled = !cameraReady || isStopping || isProcessing;

  return (
    <Modal
      visible={visible && permissionSessionReady && hasRequiredPermissions}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === "android"}
      hardwareAccelerated
      onRequestClose={handleCancel}
    >
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {hasRequiredPermissions ? (
          <CameraView
            key={facing}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="video"
            videoQuality="480p"
            active={visible}
            onCameraReady={() => {
              if (mountedRef.current && visibleRef.current && !closeRequestedRef.current) {
                setCameraReady(true);
              }
            }}
            onMountError={handleCameraMountError}
          />
        ) : null}

        <SafeAreaView style={styles.safeArea}>
          {permissionSessionReady && hasRequiredPermissions ? (
            <View style={styles.cameraOverlay}>
              <View style={styles.topBar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close video recorder"
                  onPress={handleCancel}
                  hitSlop={10}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={27} color="#FFFFFF" />
                </Pressable>

                <View style={styles.timerPill}>
                  {isRecording ? <View style={styles.recordingDot} /> : null}
                  <Text style={styles.timerText}>{timerLabel}</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Flip camera"
                  onPress={flipCamera}
                  disabled={isRecording || isStopping || isProcessing}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.iconButton,
                    pressed && styles.pressed,
                    (isRecording || isStopping || isProcessing) && styles.disabled,
                  ]}
                >
                  <Ionicons name="camera-reverse-outline" size={25} color="#FFFFFF" />
                </Pressable>
              </View>

              {!cameraReady ? (
                <View style={styles.cameraLoading} pointerEvents="none">
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.cameraLoadingText}>Starting camera…</Text>
                </View>
              ) : null}

              <View style={styles.bottomPanel}>
                <Text style={styles.limitText}>{limitDescription}</Text>
                <Text style={styles.recordingStateText}>
                  {isProcessing
                    ? "Preparing video…"
                    : isStopping
                      ? "Stopping…"
                      : isRecording
                        ? "Recording"
                        : cameraReady
                          ? "Tap to record"
                          : "Camera is loading"}
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
                  onPress={isRecording ? stopRecording : startRecording}
                  disabled={controlsDisabled}
                  style={({ pressed }) => [
                    styles.recordButtonOuter,
                    pressed && styles.recordButtonPressed,
                    controlsDisabled && styles.disabled,
                  ]}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View
                      style={
                        isRecording
                          ? styles.recordButtonStop
                          : styles.recordButtonStart
                      }
                    />
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  safeArea: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.38)",
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  timerPill: {
    minHeight: 42,
    minWidth: 132,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.38)",
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F43F5E",
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  cameraLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  cameraLoadingText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  bottomPanel: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 22,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.56)",
  },
  limitText: {
    maxWidth: 420,
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  recordingStateText: {
    marginTop: 7,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  recordButtonOuter: {
    width: 82,
    height: 82,
    marginTop: 16,
    borderRadius: 41,
    borderWidth: 5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  recordButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  recordButtonStart: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#EF4444",
  },
  recordButtonStop: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  pressed: {
    opacity: 0.76,
  },
  disabled: {
    opacity: 0.5,
  },
});
