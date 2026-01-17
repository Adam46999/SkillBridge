
import React, { useEffect, useState } from "react";
import { Slot, useRouter } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { connectChatSocket, onRing } from "../lib/chat/socket";
import { getMe, getPublicUserProfile } from "../lib/api";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = { anchor: "(tabs)" };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const [ringNotif, setRingNotif] = useState<null | { conversationId: string | null; from?: string; callerName?: string }>(null);

  // connect socket + register global ring handler
  // run once on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        connectChatSocket(token);

        const off = onRing(async (p) => {
          try {
            const to = String((p as any)?.toUserId || "").trim();
            if (!to) return;

            const token2 = await AsyncStorage.getItem("token");
            if (!token2) return;
            const me = await getMe(token2).catch(() => null);
            const myId = String((me as any)?.user?._id || "").trim();
            if (!myId) return;
            if (myId !== to) return; // not for this client

            const conv = (p as any)?.conversationId;
            const from = (p as any)?.fromUserId;

            let callerName: string | undefined;
            try {
              if (from && token2) {
                const pub = await getPublicUserProfile(token2, String(from));
                if (pub && pub.fullName) callerName = String(pub.fullName);
              }
            } catch {
              // ignore
            }

            if (conv) setRingNotif({ conversationId: conv, from: from || undefined, callerName: callerName || undefined });
            else if (from) setRingNotif({ conversationId: null, from: from || undefined, callerName: callerName || undefined });
          } catch {
            // ignore
          }
        });

        return () => {
          try {
            off?.();
          } catch {}
        };
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      {Platform.OS === "web" && <AudioUnlock />}

      {ringNotif && Platform.OS === "web" && (
        <div style={{ position: "fixed", right: 16, top: 76, zIndex: 9999 }}>
          <div style={{ background: "#06202a", padding: 12, borderRadius: 10, border: "1px solid #16324a", color: "#E2E8F0", minWidth: 260 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>{ringNotif.callerName ?? "Incoming call"}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  try {
                    const conv = ringNotif.conversationId;
                    const from = ringNotif.from;
                    if (conv) {
                      const qp: string[] = [];
                      if (from) qp.push(`peerId=${from}`);
                      if (ringNotif.callerName) qp.push(`peerName=${encodeURIComponent(ringNotif.callerName)}`);
                      qp.push(`initialRingingFrom=${from || ""}`);
                      const q = qp.length ? `?${qp.join("&")}` : "";
                      router.push(`/chats/${conv}${q}`);
                    } else {
                      router.push("/chats");
                    }
                  } catch {
                    // ignore
                  }
                  setRingNotif(null);
                }}
                style={{ padding: "6px 10px", background: "#10B981", color: "#fff", border: "none", borderRadius: 8 }}
              >
                Open
              </button>
              <button onClick={() => setRingNotif(null)} style={{ padding: "6px 10px", background: "#334155", color: "#fff", border: "none", borderRadius: 8 }}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <Slot />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function AudioUnlock() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = async () => {
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        if (ctx.state === "suspended") await ctx.resume();
        try {
          ctx.close();
        } catch {}
      } catch {}
      try {
        window.removeEventListener("pointerdown", handler);
      } catch {}
    };

    window.addEventListener("pointerdown", handler, { passive: true });
    return () => {
      try {
        window.removeEventListener("pointerdown", handler);
      } catch {}
    };
  }, []);

  return null;
}
