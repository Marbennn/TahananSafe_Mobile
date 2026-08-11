// src/components/IncidentVideoPreviewModal.tsx
import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { Typography } from "../theme/typography";

type Props = {
  visible: boolean;
  uri?: string | null;
  title?: string;
  headers?: Record<string, string>;
  onError?: () => void;
  onClose: () => void;
};

function escHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineJson(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function buildVideoHtml(uri: string, headers?: Record<string, string>) {
  const src = escHtml(uri);
  const shouldFetchWithHeaders = !!headers && Object.keys(headers).length > 0;
  const videoSource = shouldFetchWithHeaders ? "" : ` src="${src}"`;
  const loadingMessage = shouldFetchWithHeaders
    ? '<div id="loading-message">Loading video...</div>'
    : "";
  const playbackErrorHandler = `<script>
    document.getElementById("preview-video").addEventListener("error", function () {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage("video-load-error");
      }
    }, { once: true });
  </script>`;
  const authenticatedLoader = shouldFetchWithHeaders
    ? `<script>
      (async function () {
        const video = document.getElementById("preview-video");
        const loading = document.getElementById("loading-message");
        let objectUrl = "";
        try {
          const response = await fetch(${inlineJson(uri)}, {
            method: "GET",
            headers: ${inlineJson(headers)},
            credentials: "omit"
          });
          if (!response.ok) throw new Error("HTTP " + response.status);
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          video.src = objectUrl;
          video.load();
          loading.style.display = "none";
        } catch (error) {
          loading.textContent = "Unable to load this video.";
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage("video-load-error");
          }
        }
        window.addEventListener("beforeunload", function () {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        });
      })();
    </script>`
    : "";
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <style>
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      background: #050B12;
      overflow: hidden;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #050B12;
    }
    #loading-message {
      position: absolute;
      color: #cbd5e1;
      font: 600 14px -apple-system, BlinkMacSystemFont, sans-serif;
    }
  </style>
</head>
<body>
  ${loadingMessage}
  <video id="preview-video"${videoSource} controls playsinline preload="metadata"></video>
  ${authenticatedLoader}
  ${playbackErrorHandler}
</body>
</html>`;
}

export default function IncidentVideoPreviewModal({
  visible,
  uri,
  title = "Video Evidence",
  headers,
  onError,
  onClose,
}: Props) {
  const html = useMemo(
    () => (uri ? buildVideoHtml(uri, headers) : ""),
    [headers, uri]
  );
  const webViewSource = useMemo<{ html: string; baseUrl?: string }>(() => {
    if (uri && /^https?:\/\//i.test(uri)) {
      try {
        return { html, baseUrl: `${new URL(uri).origin}/` };
      } catch {
        return { html };
      }
    }
    return { html };
  }, [html, uri]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#050B12" />

        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title} allowFontScaling={false}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.playerFrame}>
          {uri ? (
            <WebView
              source={webViewSource}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
              onError={onError}
              onHttpError={({ nativeEvent }) => {
                if (nativeEvent.statusCode >= 400) onError?.();
              }}
              onMessage={({ nativeEvent }) => {
                if (nativeEvent.data === "video-load-error") onError?.();
              }}
              style={styles.webview}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="videocam-outline" size={36} color="#8FA0B2" />
              <Text style={styles.emptyTitle}>No video selected</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#050B12",
  },
  header: {
    minHeight: 58,
    backgroundColor: "#050B12",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  closeBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...Typography.modalTitle,
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },
  playerFrame: {
    flex: 1,
    backgroundColor: "#050B12",
  },
  webview: {
    flex: 1,
    backgroundColor: "#050B12",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    ...Typography.sectionTitle,
    marginTop: 12,
    color: "#FFFFFF",
  },
});
