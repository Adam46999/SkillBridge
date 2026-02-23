import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import type { SessionDTO } from "../api/sessionsApi";
import {
  getSessionById,
  listSessionChat,
  listSessionFiles,
  sendSessionChat,
  updateSessionStatus,
  uploadSessionFile,
} from "../api/sessionsApi";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../../lib/api";

type ChatMsg = {
  _id: string;
  senderId: string;
  text: string;
  createdAt: string;
};

type SessionFile = {
  _id: string;
  uploaderId: string;
  name: string;
  url: string;
  createdAt: string;
};

async function getToken() {
  // عدّل المفتاح إذا عندك اسم ثاني للتوكن
  return (await AsyncStorage.getItem("token")) || null;
}

export default function SessionRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id || "").trim();
console.log("ROOM PARAMS", { id, sessionId });

  const [token, setToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionDTO | null>(null);

  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");

  const [filesLoading, setFilesLoading] = useState(false);
  const [files, setFiles] = useState<SessionFile[]>([]);

  const [busy, setBusy] = useState(false);

  const flatRef = useRef<FlatList>(null);

  const zoomUrl = useMemo(() => (session as any)?.zoomJoinUrl || "", [session]);

  async function loadAll(tk: string) {
    try {
      setLoading(true);
      console.log("ROOM LOAD", { sessionId, API_URL });

      const s = await getSessionById(tk, sessionId);
      console.log("ROOM GOT SESSION", { ok: !!s, _id: (s as any)?._id, status: (s as any)?.status });

      setSession(s);

      setChatLoading(true);
      const chat = await listSessionChat(tk, sessionId);
      setMessages(chat);

      setFilesLoading(true);
      const fl = await listSessionFiles(tk, sessionId);
      setFiles(fl);
    } catch (e: any) {
console.log("ROOM ERROR", {
  message: e?.message,
  status: e?.status,
  body: e?.body,
});
Alert.alert(
  "Failed",
  `${e?.message || "Failed"}\nstatus=${e?.status || "?"}\n${JSON.stringify(e?.body || {}, null, 2)}`
);
    } finally {
      setLoading(false);
      setChatLoading(false);
      setFilesLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const tk = await getToken();
      setToken(tk);
      if (!tk) {
        setLoading(false);
        Alert.alert("Not logged in", "Please login again.");
        return;
      }
      if (!sessionId) {
        setLoading(false);
        Alert.alert("Missing id", "No session id in route.");
        return;
      }
      await loadAll(tk);
    })();
  }, [sessionId]);

  const onSend = async () => {
    if (!token) return;
    const t = text.trim();
    if (!t) return;

    try {
      setBusy(true);
      const msg = await sendSessionChat(token, sessionId, t);
      setMessages((prev) => [...prev, msg]);
      setText("");

      // scroll
      setTimeout(() => flatRef.current?.scrollToEnd?.({ animated: true }), 50);
    } catch (e: any) {
      Alert.alert("Send failed", e?.message || "Send failed");
    } finally {
      setBusy(false);
    }
  };

  const onPickUpload = async () => {
    if (!token) return;

    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file?.uri) return;

      setBusy(true);
      const uploaded = await uploadSessionFile(token, sessionId, {
        uri: file.uri,
        name: file.name || "file",
        mimeType: file.mimeType || "application/octet-stream",
      });

      setFiles((prev) => [uploaded, ...prev]);
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onEnterZoom = async () => {
    const url = String(zoomUrl || "").trim();
    if (!url) {
      Alert.alert("No Zoom link", "This session has no zoomJoinUrl yet.");
      return;
    }
    const ok = await Linking.canOpenURL(url);
    if (!ok) return Alert.alert("Cannot open", "Invalid Zoom link.");
    Linking.openURL(url);
  };

  const onEndMeeting = async () => {
    if (!token || !sessionId) return;

    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert("End meeting", "This will mark the session as completed.", [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "End", style: "destructive", onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;

    try {
      setBusy(true);
      const updated = await updateSessionStatus(token, sessionId, "completed");
      setSession(updated);
      Alert.alert("Done", "Session marked as completed.");
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Failed to complete session");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B1220", padding: 16 }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B1220", padding: 16 }}>
        <Text style={{ color: "#E2E8F0" }}>Session not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0B1220", padding: 14, gap: 12 }}>
      {/* Header */}
      <View
        style={{
          borderWidth: 1,
          borderColor: "#1F2937",
          borderRadius: 16,
          padding: 12,
          gap: 6,
        }}
      >
        <Text style={{ color: "#E2E8F0", fontWeight: "900", fontSize: 16 }}>
          {session.skill} • {session.level}
        </Text>
        <Text style={{ color: "#94A3B8" }}>{session.scheduledAt}</Text>
        <Text style={{ color: "#64748B" }}>Status: {session.status}</Text>

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Pressable
            onPress={onEnterZoom}
            disabled={busy}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "#10B981",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#0B1220", fontWeight: "900" }}>
              Enter Zoom
            </Text>
          </Pressable>

          <Pressable
            onPress={onEndMeeting}
            disabled={busy}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "#EF4444",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#0B1220", fontWeight: "900" }}>
              End Meeting
            </Text>
          </Pressable>

          <Pressable
            onPress={() => token && loadAll(token)}
            disabled={busy}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "#334155",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>Refresh</Text>
          </Pressable>
        </View>
      </View>

      {/* Files */}
      <View
        style={{
          borderWidth: 1,
          borderColor: "#1F2937",
          borderRadius: 16,
          padding: 12,
          gap: 10,
          flexShrink: 0,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>Files</Text>

          <Pressable
            onPress={onPickUpload}
            disabled={busy}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 12,
              backgroundColor: "#334155",
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: "#E2E8F0", fontWeight: "800" }}>Upload</Text>
          </Pressable>
        </View>

        {filesLoading ? (
          <ActivityIndicator />
        ) : files.length === 0 ? (
          <Text style={{ color: "#64748B" }}>No files yet.</Text>
        ) : (
          files.slice(0, 6).map((f) => (
            <Pressable
              key={f._id}
              onPress={() => {
                const u = String(f.url || "");
                const full = u.startsWith("http") ? u : `${API_URL}${u}`;
                Linking.openURL(full);
              }}
              style={{
                padding: 10,
                borderRadius: 12,
                backgroundColor: "#0F172A",
                borderWidth: 1,
                borderColor: "#1F2937",
              }}
            >
              <Text style={{ color: "#E2E8F0", fontWeight: "800" }}>
                {f.name}
              </Text>
              <Text style={{ color: "#64748B", marginTop: 2 }}>
                Tap to open
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {/* Chat */}
      <View
        style={{
          flex: 1,
          borderWidth: 1,
          borderColor: "#1F2937",
          borderRadius: 16,
          padding: 12,
          gap: 10,
        }}
      >
        <Text style={{ color: "#E2E8F0", fontWeight: "900" }}>Chat</Text>

        {chatLoading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => m._id}
            renderItem={({ item }) => (
              <View style={{ paddingVertical: 6 }}>
                <Text style={{ color: "#94A3B8", fontSize: 12 }}>
                  {item.senderId}
                </Text>
                <Text style={{ color: "#E2E8F0", fontWeight: "700" }}>
                  {item.text}
                </Text>
              </View>
            )}
          />
        )}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type..."
            placeholderTextColor="#64748B"
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#1F2937",
              borderRadius: 12,
              padding: 10,
              color: "#E2E8F0",
            }}
          />
          <Pressable
            onPress={onSend}
            disabled={busy}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "#10B981",
              opacity: busy ? 0.6 : 1,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#0B1220", fontWeight: "900" }}>Send</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
