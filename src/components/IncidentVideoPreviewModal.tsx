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

type Props = {
  visible: boolean;
  uri?: string | null;
  title?: string;
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

function buildVideoHtml(uri: string) {
  const src = escHtml(uri);
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
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #050B12;
    }
  </style>
</head>
<body>
  <video src="${src}" controls playsinline preload="metadata"></video>
</body>
</html>`;
}

export default function IncidentVideoPreviewModal({
  visible,
  uri,
  title = "Video Evidence",
  onClose,
}: Props) {
  const html = useMemo(() => (uri ? buildVideoHtml(uri) : ""), [uri]);

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
              source={{ html }}
              originWhitelist={["*"]}
              javaScriptEnabled
              domStorageEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
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
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
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
    marginTop: 12,
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
