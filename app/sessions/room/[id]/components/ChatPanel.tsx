// app/sessions/room/[id]/components/ChatPanel.tsx
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { RoomChatItem } from "../hooks/useSessionChat";

export default function ChatPanel({
  meId,
  items,
  loading,
  error,
  peerTyping,
  text,
  sending,
  canSend,
  onChangeText,
  onSend,
}: {
  meId: string;
  items: RoomChatItem[];
  loading: boolean;
  error: string | null;
  peerTyping: boolean;
  text: string;
  sending: boolean;
  canSend: boolean;
  onChangeText: (v: string) => void;
  onSend: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#020617",
        borderWidth: 1,
        borderColor: "#1F2937",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#0B1120",
        }}
      >
        <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>Chat</Text>
        {peerTyping ? (
          <Text style={{ color: "#94A3B8", marginTop: 4 }}>Typing…</Text>
        ) : null}
      </View>

      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={{ flex: 1, padding: 12 }}>
          <Text style={{ color: "#FCA5A5" }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={[...items].reverse()} // inverted manually
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          renderItem={({ item }) => {
            const mine = String(item.senderId) === String(meId);
            return (
              <View
                style={{
                  alignSelf: mine ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: mine ? "#22C55E" : "#0F172A",
                  borderWidth: 1,
                  borderColor: "#1F2937",
                }}
              >
                <Text
                  style={{
                    color: mine ? "#052E16" : "#E2E8F0",
                    fontWeight: "700",
                  }}
                >
                  {item.text}
                </Text>
                <Text
                  style={{
                    color: mine ? "#064E3B" : "#64748B",
                    marginTop: 4,
                    fontSize: 12,
                  }}
                >
                  {new Date(item.createdAt).toLocaleTimeString()}
                </Text>
              </View>
            );
          }}
        />
      )}

      <View
        style={{
          padding: 10,
          borderTopWidth: 1,
          borderTopColor: "#0B1120",
          gap: 8,
        }}
      >
        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder="Type a message…"
          placeholderTextColor="#64748B"
          style={{
            backgroundColor: "#0B1220",
            borderWidth: 1,
            borderColor: "#1F2937",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: "#E2E8F0",
          }}
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend || sending}
          style={{
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: !canSend || sending ? "#14532D" : "#22C55E",
            opacity: !canSend || sending ? 0.6 : 1,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#052E16", fontWeight: "900" }}>
            {sending ? "Sending…" : "Send"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
