// app/sessions/screens/SessionsScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { getMe } from "../../../lib/api";
import { listMySessions, SessionDTO } from "../api/sessionsApi";
import SessionCard from "../components/SessionCard";

type Scope = "upcoming" | "past" | "all";

export default function SessionsScreen() {
  const router = useRouter();

  const [scope, setScope] = useState<Scope>("upcoming");
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionDTO[]>([]);
  const [loading, setLoading] = useState(true); // initial load
  const [loadingList, setLoadingList] = useState(false); // chip switching
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const scopeLabel = useMemo(() => {
    if (scope === "upcoming") return "Upcoming sessions";
    if (scope === "past") return "Past sessions";
    return "All sessions";
  }, [scope]);

  const load = useCallback(
    async (opts?: { silent?: boolean; listOnly?: boolean }) => {
      const silent = !!opts?.silent;
      const listOnly = !!opts?.listOnly;

      try {
        setErrorText(null);

        if (!silent && !listOnly) setLoading(true);
        if (listOnly) setLoadingList(true);

        const t = token ?? (await AsyncStorage.getItem("token"));
        if (!token) setToken(t);

        if (!t) {
          router.replace("/(auth)/login" as any);
          return;
        }

        // only fetch me once (unless missing)
        if (!currentUserId) {
          const me: any = await getMe(t);
          setCurrentUserId(me?.user?._id ?? me?._id ?? null);
        }

        const data = await listMySessions(t, { scope });
        setSessions(data);
      } catch (e: any) {
        setErrorText(e?.message || "Failed to load sessions.");
      } finally {
        if (!silent && !listOnly) setLoading(false);
        if (listOnly) setLoadingList(false);
        setRefreshing(false);
      }
    },
    [router, scope, token, currentUserId]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when scope changes => load list only (no full-screen loader)
  useEffect(() => {
    if (!token) return; // wait initial token
    load({ listOnly: true, silent: true });
  }, [scope, token, load]);

  const onRefresh = () => {
    setRefreshing(true);
    load({ silent: true });
  };

  const ScopeChip = ({ v }: { v: Scope }) => {
    const active = v === scope;
    return (
      <TouchableOpacity
        onPress={() => setScope(v)}
        activeOpacity={0.85}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: active ? "#F97316" : "#1E293B",
          backgroundColor: active ? "#0B1120" : "#020617",
        }}
      >
        <Text
          style={{
            color: active ? "#FED7AA" : "#E5E7EB",
            fontWeight: "900",
            fontSize: 12,
            textTransform: "capitalize",
          }}
        >
          {v}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#020617",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" />
        <Text style={{ color: "#9CA3AF", marginTop: 12 }}>
          Loading sessions…
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#020617" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
          />
        }
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={{ color: "#60A5FA", fontWeight: "900" }}>← Back</Text>
          </TouchableOpacity>

          <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 16 }}>
            Sessions
          </Text>

          <View style={{ width: 54 }} />
        </View>

        {/* Subtitle */}
        <Text style={{ color: "#94A3B8", marginTop: 8, fontWeight: "700" }}>
          {scopeLabel}
        </Text>

        {/* Scope chips */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <ScopeChip v="upcoming" />
          <ScopeChip v="past" />
          <ScopeChip v="all" />
        </View>

        {/* Error */}
        {errorText ? (
          <View
            style={{
              marginTop: 14,
              backgroundColor: "#451A1A",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "#FCA5A5",
            }}
          >
            <Text style={{ color: "#FECACA", fontWeight: "900" }}>
              Couldn’t load sessions
            </Text>
            <Text style={{ color: "#FECACA", marginTop: 6 }}>{errorText}</Text>

            <TouchableOpacity
              onPress={() => load({ silent: true })}
              activeOpacity={0.85}
              style={{
                marginTop: 10,
                alignSelf: "flex-start",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: "#B91C1C",
              }}
            >
              <Text style={{ color: "#FEE2E2", fontWeight: "900" }}>
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* List header row */}
        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 14 }}>
            Results
          </Text>

          {loadingList ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <ActivityIndicator />
              <Text style={{ color: "#94A3B8", fontWeight: "900" }}>
                Updating…
              </Text>
            </View>
          ) : null}
        </View>

        {/* Sessions */}
        <View style={{ marginTop: 12, gap: 10 }}>
          {sessions.length === 0 ? (
            <View
              style={{
                backgroundColor: "#0B1120",
                borderWidth: 1,
                borderColor: "#1E293B",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>
                No sessions yet
              </Text>
              <Text style={{ color: "#94A3B8", marginTop: 6 }}>
                When you request a session from a mentor, it’ll show up here.
              </Text>

              <TouchableOpacity
                onPress={() => router.push("/find-mentor" as any)}
                activeOpacity={0.85}
                style={{
                  marginTop: 12,
                  borderRadius: 999,
                  paddingVertical: 10,
                  alignItems: "center",
                  backgroundColor: "#F97316",
                  borderWidth: 1,
                  borderColor: "#FB923C",
                }}
              >
                <Text style={{ color: "#111827", fontWeight: "900" }}>
                  Find a mentor
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            sessions.map((s) => (
              <SessionCard
                key={s._id}
                session={s}
                token={token}
                currentUserId={currentUserId}
                onChanged={() => load({ silent: true })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
