// app/sessions/room/[id]/index.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import ChatPanel from "./components/ChatPanel";
import FilesPanel from "./components/FilesPanel";
import RoomHeader from "./components/RoomHeader";

import { useSessionChat } from "./hooks/useSessionChat";
import { useSessionFiles } from "./hooks/useSessionFiles";
import { useSessionRoom } from "./hooks/useSessionRoom";

export default function SessionRoomScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id || "").trim();

  const room = useSessionRoom(sessionId);
  const files = useSessionFiles(sessionId);
  const chat = useSessionChat(sessionId, room.meId);

  if (!sessionId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Missing session id</Text>
      </View>
    );
  }

  if (room.loadingSession) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (room.error || !room.session) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{room.error || "Session not found"}</Text>
      </View>
    );
  }

  const joinEnabled = !!room.joinGate.ok && !room.busyAction;
  const joinHint =
    room.session.status !== "accepted"
      ? "Session is not accepted yet."
      : room.joinGate.ok
      ? "Join is available now."
      : room.joinGate.reason || "Join is locked.";

  return (
    <View style={styles.container}>
      <RoomHeader
        session={room.session}
        countdownSeconds={room.countdownSeconds}
        joinEnabled={joinEnabled}
        joinHint={joinHint}
        busy={room.busyAction}
        onJoin={room.openZoom}
        onCancel={room.cancel}
        onRefresh={() => {
          room.refresh(false);
          files.refresh(false);
          chat.refresh(false);
        }}
        onBack={() => router.replace("/sessions")} // adjust if your My Sessions route differs
      />

      <FilesPanel
        files={files.files}
        loading={files.loadingFiles}
        error={files.errorFiles}
        uploading={files.uploading}
        onUpload={files.upload}
      />

      <ChatPanel
        meId={room.meId}
        items={chat.items}
        loading={chat.loadingChat}
        error={chat.errorChat}
        peerTyping={chat.peerTyping}
        text={chat.text}
        sending={chat.sending}
        canSend={chat.canSend}
        onChangeText={chat.setText}
        onSend={chat.send}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
    padding: 14,
    gap: 12,
  },
  center: {
    flex: 1,
    backgroundColor: "#0B1220",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
  },
  error: {
    color: "#E2E8F0",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
});
