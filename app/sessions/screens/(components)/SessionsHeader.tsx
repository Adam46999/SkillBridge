import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { Scope } from "../(hooks)/useSessionsData";
import type { SessionDTO } from "../../api/sessionsApi";
import { UpdatingMiniBadge } from "./SessionsRowRenderer";
import type { StatusFilter } from "./SessionsRows";
import { computeStatusCounts } from "./SessionsRows";

function scopeLabelOf(scope: Scope) {
  if (scope === "upcoming") return "Upcoming sessions";
  if (scope === "past") return "Past sessions";
  return "All sessions";
}

function statusLabel(v: StatusFilter) {
  if (v === "all") return "All";
  if (v === "requested") return "Requested";
  if (v === "accepted") return "Accepted";
  if (v === "rejected") return "Rejected";
  if (v === "cancelled") return "Cancelled";
  if (v === "completed") return "Completed";
  return "All";
}

function Chip({
  label,
  active,
  onPress,
  accent = "orange",
  rightBadge,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: "orange" | "blue";
  rightBadge?: string;
}) {
  const border =
    accent === "blue"
      ? active
        ? "#60A5FA"
        : "#1E293B"
      : active
      ? "#F97316"
      : "#1E293B";

  const text =
    accent === "blue"
      ? active
        ? "#BFDBFE"
        : "#E5E7EB"
      : active
      ? "#FED7AA"
      : "#E5E7EB";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: active ? "#0B1120" : "#020617",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Text style={{ color: text, fontWeight: "900", fontSize: 12 }}>
        {label}
      </Text>

      {!!rightBadge && (
        <View
          style={{
            minWidth: 22,
            paddingHorizontal: 8,
            height: 18,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active
              ? accent === "blue"
                ? "#60A5FA"
                : "#F97316"
              : "#111827",
            borderWidth: 1,
            borderColor: active
              ? accent === "blue"
                ? "#93C5FD"
                : "#FB923C"
              : "#1E293B",
          }}
        >
          <Text
            style={{
              color: active ? "#0B1120" : "#CBD5E1",
              fontWeight: "900",
              fontSize: 11,
            }}
          >
            {rightBadge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function SessionsHeader({
  scope,
  setScope,
  statusFilter,
  setStatusFilter,
  sessions,
  filteredCount,
  loadingList,
  errorText,
  onRetry,

  // ✅ NEW (controlled search)
  query,
  setQuery,

  // ✅ NEW (safe actions)
  onFindMentor,
  onRequestSession,
}: {
  scope: Scope;
  setScope: (v: Scope) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  sessions: SessionDTO[];
  filteredCount: number;
  loadingList: boolean;
  errorText: string | null;
  onRetry: () => void;

  query: string;
  setQuery: (v: string) => void;

  onFindMentor?: () => void;
  onRequestSession?: () => void; // optional (حتى ما نخرب routes)
}) {
  const router = useRouter();

  const scopeLabel = useMemo(() => scopeLabelOf(scope), [scope]);
  const countsAll = useMemo(() => computeStatusCounts(sessions), [sessions]);

  const badge = (n: number) => (n > 99 ? "99+" : String(n));

  const hasAnyFilter = useMemo(() => {
    return scope !== "upcoming" || statusFilter !== "all" || !!query.trim();
  }, [query, scope, statusFilter]);

  const onReset = useCallback(() => {
    setScope("upcoming");
    setStatusFilter("all");
    setQuery("");
  }, [setQuery, setScope, setStatusFilter]);

  const searchHint = useMemo(() => {
    return "Search: skill / level / status / note…";
  }, []);

  const handleFind = useCallback(() => {
    if (onFindMentor) return onFindMentor();
    router.push("/find-mentor" as any);
  }, [onFindMentor, router]);

  return (
    <View style={{ padding: 16, paddingBottom: 10 }}>
      {/* Top nav */}
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

        {/* right actions */}
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Pressable
            onPress={handleFind}
            style={({ pressed }) => [
              {
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "#1E293B",
                backgroundColor: "#0B1120",
              },
              pressed ? { opacity: 0.9 } : null,
            ]}
          >
            <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 12 }}>
              Find
            </Text>
          </Pressable>

          {/* ✅ optional: يظهر فقط لو مرّرته من SessionsScreen */}
          {onRequestSession ? (
            <Pressable
              onPress={onRequestSession}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#FB923C",
                  backgroundColor: "#F97316",
                },
                pressed ? { opacity: 0.92 } : null,
              ]}
            >
              <Text
                style={{ color: "#111827", fontWeight: "900", fontSize: 12 }}
              >
                Request
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Subtitle */}
      <Text style={{ color: "#94A3B8", marginTop: 8, fontWeight: "700" }}>
        {scopeLabel}{" "}
        <Text style={{ color: "#CBD5E1", fontWeight: "900" }}>
          ({filteredCount}/{sessions.length})
        </Text>
      </Text>

      {/* Search (now реально يفلتر ✅) */}
      <View
        style={{
          marginTop: 12,
          backgroundColor: "#0B1120",
          borderWidth: 1,
          borderColor: "#111827",
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Text style={{ color: "#64748B", fontWeight: "900" }}>🔎</Text>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={searchHint}
          placeholderTextColor="#64748B"
          style={{ flex: 1, color: "#E5E7EB", fontWeight: "700" }}
          returnKeyType="search"
          accessibilityLabel="Search sessions"
        />

        {!!query.trim() && (
          <Pressable
            onPress={() => setQuery("")}
            style={({ pressed }) => [
              {
                width: 28,
                height: 28,
                borderRadius: 999,
                backgroundColor: "#111827",
                borderWidth: 1,
                borderColor: "#1E293B",
                alignItems: "center",
                justifyContent: "center",
              },
              pressed ? { opacity: 0.9 } : null,
            ]}
            hitSlop={10}
          >
            <Text
              style={{
                color: "#E5E7EB",
                fontWeight: "900",
                fontSize: 16,
                lineHeight: 18,
              }}
            >
              ×
            </Text>
          </Pressable>
        )}
      </View>

      {/* Reset filters */}
      {hasAnyFilter ? (
        <View style={{ marginTop: 10, flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={onReset}
            style={({ pressed }) => [
              {
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "#1E293B",
                backgroundColor: "#020617",
              },
              pressed ? { opacity: 0.9 } : null,
            ]}
          >
            <Text style={{ color: "#E5E7EB", fontWeight: "900", fontSize: 12 }}>
              Reset filters
            </Text>
          </Pressable>

          <Text
            style={{
              color: "#64748B",
              fontWeight: "800",
              fontSize: 12,
              alignSelf: "center",
            }}
          >
            Filters active
          </Text>
        </View>
      ) : null}

      {/* Scope chips */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: 14,
          flexWrap: "wrap",
        }}
      >
        <Chip
          label="upcoming"
          active={scope === "upcoming"}
          onPress={() => setScope("upcoming")}
        />
        <Chip
          label="past"
          active={scope === "past"}
          onPress={() => setScope("past")}
        />
        <Chip
          label="all"
          active={scope === "all"}
          onPress={() => setScope("all")}
        />
      </View>

      {/* Status chips */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        <Chip
          accent="blue"
          label={statusLabel("all")}
          active={statusFilter === "all"}
          onPress={() => setStatusFilter("all")}
          rightBadge={badge(countsAll.total)}
        />
        <Chip
          accent="blue"
          label={statusLabel("requested")}
          active={statusFilter === "requested"}
          onPress={() => setStatusFilter("requested")}
          rightBadge={badge(countsAll.byStatus.requested)}
        />
        <Chip
          accent="blue"
          label={statusLabel("accepted")}
          active={statusFilter === "accepted"}
          onPress={() => setStatusFilter("accepted")}
          rightBadge={badge(countsAll.byStatus.accepted)}
        />
        <Chip
          accent="blue"
          label={statusLabel("completed")}
          active={statusFilter === "completed"}
          onPress={() => setStatusFilter("completed")}
          rightBadge={badge(countsAll.byStatus.completed)}
        />
        <Chip
          accent="blue"
          label={statusLabel("cancelled")}
          active={statusFilter === "cancelled"}
          onPress={() => setStatusFilter("cancelled")}
          rightBadge={badge(countsAll.byStatus.cancelled)}
        />
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

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              onPress={onRetry}
              activeOpacity={0.85}
              style={{
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

            {hasAnyFilter ? (
              <TouchableOpacity
                onPress={onReset}
                activeOpacity={0.85}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: "#0B1120",
                  borderWidth: 1,
                  borderColor: "#1E293B",
                }}
              >
                <Text style={{ color: "#E5E7EB", fontWeight: "900" }}>
                  Reset
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* List meta */}
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ color: "#64748B", fontWeight: "800", fontSize: 12 }}>
            Total: {badge(countsAll.total)}
          </Text>
          {loadingList ? <UpdatingMiniBadge /> : null}
        </View>
      </View>
    </View>
  );
}
