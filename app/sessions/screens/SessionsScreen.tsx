import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";

import type { SessionDTO } from "../api/sessionsApi";
import SessionsHeader from "./(components)/SessionsHeader";
import { useRowRenderer } from "./(components)/SessionsRowRenderer";
import {
  buildGroupedRows,
  filterSessionsByStatus,
  type Row,
  type StatusFilter,
} from "./(components)/SessionsRows";
import { useSessionsData, type Scope } from "./(hooks)/useSessionsData";

function normalize(s: any) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

function sessionMatchesQuery(s: SessionDTO, q: string) {
  const query = normalize(q);
  if (!query) return true;

  const hay = [s.skill, s.level, s.status, s.note, s.feedback, s.scheduledAt]
    .map((x) => normalize(x))
    .join(" | ");

  return hay.includes(query);
}

export default function SessionsScreen() {
  const router = useRouter();

  const [scope, setScope] = useState<Scope>("upcoming");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const {
    token,
    currentUserId,
    sessions,
    loading,
    loadingList,
    refreshing,
    errorText,
    load,
    onRefresh,
  } = useSessionsData(scope);

  // 1) search filter (NEW ✅)
  const searchedSessions = useMemo(() => {
    const q = query.trim();
    if (!q) return sessions;
    return (Array.isArray(sessions) ? sessions : []).filter((s) =>
      sessionMatchesQuery(s, q)
    );
  }, [sessions, query]);

  // 2) status filter (existing ✅)
  const filteredSessions = useMemo(
    () => filterSessionsByStatus(searchedSessions, statusFilter),
    [searchedSessions, statusFilter]
  );

  // 3) grouped rows (existing ✅)
  const rows = useMemo<Row[]>(
    () => buildGroupedRows(filteredSessions),
    [filteredSessions]
  );

  const empty = useMemo(
    () => !loading && !errorText && filteredSessions.length === 0,
    [loading, errorText, filteredSessions.length]
  );

  const onChanged = useCallback(async () => {
    await load({ silent: true, listOnly: true });
  }, [load]);

  const renderRow = useRowRenderer({
    token,
    currentUserId,
    onChanged,
  });

  const keyExtractor = useCallback((r: Row) => r.key, []);

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

  if (empty && !errorText) {
    const msg =
      scope === "upcoming"
        ? "No upcoming sessions yet."
        : scope === "past"
        ? "No past sessions yet."
        : "No sessions yet.";

    const hint = query.trim()
      ? "Try clearing search or changing filters."
      : statusFilter !== "all"
      ? `Try switching the status filter (currently: ${statusFilter}).`
      : "When you request a session from a mentor, it’ll show up here.";

    return (
      <View style={{ flex: 1, backgroundColor: "#020617" }}>
        <SessionsHeader
          scope={scope}
          setScope={setScope}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sessions={sessions}
          filteredCount={filteredSessions.length}
          loadingList={loadingList}
          errorText={errorText}
          onRetry={() => load({ silent: true, listOnly: true })}
          query={query}
          setQuery={setQuery}
          // ✅ safest: route موجود عندك حسب الكود السابق
          onFindMentor={() => router.push("/find-mentor" as any)}
          // ✅ خليها اختياري… إذا عندك روت جاهز مررّه
          // onRequestSession={() => router.push("/sessions/request" as any)}
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View
            style={{
              backgroundColor: "#0B1120",
              borderWidth: 1,
              borderColor: "#1E293B",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>{msg}</Text>
            <Text style={{ color: "#94A3B8", marginTop: 6 }}>{hint}</Text>

            <View style={{ height: 12 }} />

            <View style={{ borderRadius: 999, overflow: "hidden" }}>
              <Text
                onPress={() => router.push("/find-mentor" as any)}
                style={{
                  textAlign: "center",
                  paddingVertical: 10,
                  backgroundColor: "#F97316",
                  borderWidth: 1,
                  borderColor: "#FB923C",
                  color: "#111827",
                  fontWeight: "900",
                }}
              >
                Find a mentor
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#020617" }}>
      <FlatList
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ListHeaderComponent={
          <SessionsHeader
            scope={scope}
            setScope={setScope}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sessions={sessions}
            filteredCount={filteredSessions.length}
            loadingList={loadingList}
            errorText={errorText}
            onRetry={() => load({ silent: true, listOnly: true })}
            query={query}
            setQuery={setQuery}
            onFindMentor={() => router.push("/find-mentor" as any)}
            // onRequestSession={() => router.push("/sessions/request" as any)}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F97316"
          />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}
