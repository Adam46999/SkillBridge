import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, Linking, Platform } from "react-native";
import type { ChatMessage } from "../../../../lib/chat/api";
import { API_URL } from "../../../../lib/api";

type Props = {
  item: ChatMessage;
  mine: boolean;
  isLastMine?: boolean;
  lastMineId?: string | null;
  seen?: boolean;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ item, mine, isLastMine, seen }: Props) {
  const time = useMemo(
    () => formatTime(String((item as any)?.createdAt || "")),
    [item]
  );

  const tickText = useMemo(() => {
    if (!mine) return "";
    // ✓ = sent/delivered (basic)
    // ✓✓ = seen (only show when this is the last mine)
    if (isLastMine && seen) return "✓✓";
    return "✓";
  }, [isLastMine, mine, seen]);

  // Parse file attachment from text format: FILE:url:filename:mimetype
  const fileData = useMemo(() => {
    const text = item.text || "";
    if (!text.startsWith("FILE:")) return null;
    
    const parts = text.split(":");
    if (parts.length < 4) return null;
    
    return {
      url: parts[1],
      name: parts[2],
      type: parts[3],
    };
  }, [item.text]);

  const handleDownload = () => {
    if (!fileData) return;
    const fullUrl = fileData.url.startsWith("http") 
      ? fileData.url 
      : `${API_URL}${fileData.url}`;
    
    if (Platform.OS === "web") {
      // Create a temporary anchor element to force download with original filename
      fetch(fullUrl)
        .then(response => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = fileData.name; // Use original filename
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        })
        .catch(() => {
          // Fallback: just open in new tab if download fails
          window.open(fullUrl, "_blank");
        });
    } else {
      Linking.openURL(fullUrl);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "🖼";
    if (mimeType.startsWith("video/")) return "🎬";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("zip") || mimeType.includes("rar")) return "📦";
    return "📎";
  };

  if (fileData) {
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
        <Pressable
          onPress={handleDownload}
          style={[styles.bubble, styles.fileBubble, mine ? styles.mine : styles.theirs]}
          accessibilityRole="button"
          accessibilityLabel={`Download ${fileData.name}`}
        >
          <View style={styles.fileContent}>
            <Text style={styles.fileIcon}>{getFileIcon(fileData.type)}</Text>
            <View style={styles.fileInfo}>
              <Text style={[styles.fileName, mine ? styles.textMine : styles.textTheirs]} numberOfLines={2}>
                {fileData.name}
              </Text>
              <Text style={[styles.fileAction, mine ? styles.textMine : styles.textTheirs]}>
                Tap to download
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text
              style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}
            >
              {time}
            </Text>

            {mine ? (
              <Text
                style={[
                  styles.tick,
                  isLastMine && seen ? styles.tickSeen : null,
                ]}
              >
                {tickText}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        style={[styles.bubble, mine ? styles.mine : styles.theirs]}
        accessibilityRole="text"
      >
        <Text style={[styles.text, mine ? styles.textMine : styles.textTheirs]}>
          {item.text}
        </Text>

        <View style={styles.metaRow}>
          <Text
            style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}
          >
            {time}
          </Text>

          {mine ? (
            <Text
              style={[
                styles.tick,
                // make ✓✓ slightly more visible but keep your palette
                isLastMine && seen ? styles.tickSeen : null,
              ]}
            >
              {tickText}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%", marginVertical: 6, flexDirection: "row" },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },

  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },

  mine: { backgroundColor: "#F97316", borderColor: "#FB923C" },
  theirs: { backgroundColor: "#0B1120", borderColor: "#111827" },

  text: { fontWeight: "800", fontSize: 14, lineHeight: 20 },
  textMine: { color: "#111827" },
  textTheirs: { color: "#E5E7EB" },

  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },

  time: { fontSize: 11, fontWeight: "900" },
  tick: { fontSize: 12, fontWeight: "900" },

  timeMine: { color: "rgba(17,24,39,0.75)" },
  timeTheirs: { color: "#94A3B8" },

  tickSeen: {
    // keep same color family but slightly stronger
    color: "rgba(17,24,39,0.9)",
  },

  fileBubble: {
    minWidth: 200,
  },

  fileContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  fileIcon: {
    fontSize: 32,
  },

  fileInfo: {
    flex: 1,
    gap: 4,
  },

  fileName: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 18,
  },

  fileAction: {
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.7,
  },
});
