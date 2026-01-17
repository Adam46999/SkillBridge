// app/sessions/room/[id]/components/FilesPanel.tsx
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { SessionFileDTO } from "../../../api/sessionsApi";

export default function FilesPanel({
  files,
  loading,
  error,
  uploading,
  onUpload,
}: {
  files: SessionFileDTO[];
  loading: boolean;
  error: string | null;
  uploading: boolean;
  onUpload: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: "#0B1220",
        borderWidth: 1,
        borderColor: "#1F2937",
        borderRadius: 16,
        padding: 12,
        gap: 10,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>Files</Text>

        <Pressable
          onPress={onUpload}
          disabled={uploading}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: "#334155",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>
            {uploading ? "Uploading…" : "Upload"}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={{ color: "#FCA5A5" }}>{error}</Text>
      ) : files.length === 0 ? (
        <Text style={{ color: "#64748B" }}>No files yet.</Text>
      ) : (
        files.slice(0, 6).map((f) => (
          <View
            key={f._id}
            style={{
              padding: 10,
              borderRadius: 12,
              backgroundColor: "#0F172A",
              borderWidth: 1,
              borderColor: "#1F2937",
            }}
          >
            <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>
              {f.name}
            </Text>
            <Text style={{ color: "#64748B", marginTop: 2 }}>{f.url}</Text>
          </View>
        ))
      )}
    </View>
  );
}
