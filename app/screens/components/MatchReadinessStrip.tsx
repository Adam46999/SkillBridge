import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  getMatchingStatus,
  type MatchingMode,
  type MatchingStatus,
} from "../../../lib/api";

type Props = {
  currentMode?: MatchingMode; // اختياري (لو عندك مود محفوظ بالـ AsyncStorage)
  onApplyRecommended?: (recommended: MatchingMode) => void; // لما المستخدم يكبس "Use recommended"
  onOpenSettings?: () => void; // اختياري (لو بدك تفتح شاشة إعدادات لاحقًا)
  compact?: boolean; // لو بدك شكل أصغر
};

function getHumanMessage(s: MatchingStatus): string {
  if (!s.openaiAvailable) {
    if (s.reason === "NO_KEY")
      return "AI matching is off (no API key). Using local matching.";
    return "AI matching is unavailable right now. Using local matching.";
  }
  return "AI matching is ready. For best results, use Hybrid mode.";
}

export default function MatchReadinessStrip({
  currentMode,
  onApplyRecommended,
  onOpenSettings,
  compact = false,
}: Props) {
  const [status, setStatus] = useState<MatchingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const s = await getMatchingStatus();
        if (!alive) return;
        setStatus(s);
      } catch {
        if (!alive) return;
        setStatus({
          openaiAvailable: false,
          reason: "ERROR",
          recommendedMode: "local",
        });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const recommendedMode: MatchingMode = useMemo(() => {
    // server returns "local" | "hybrid"
    const r = status?.recommendedMode;
    return r === "hybrid" ? "hybrid" : "local";
  }, [status]);

  const showApplyButton = useMemo(() => {
    if (!status) return false;
    if (!onApplyRecommended) return false;
    if (currentMode && currentMode === recommendedMode) return false;
    return true;
  }, [status, onApplyRecommended, currentMode, recommendedMode]);

  const tone = useMemo(() => {
    if (!status) return "neutral";
    return status.openaiAvailable ? "good" : "warn";
  }, [status]);

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        tone === "good" && styles.goodWrap,
        tone === "warn" && styles.warnWrap,
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.title}>Matching status</Text>

        {loading ? (
          <View style={styles.row}>
            <ActivityIndicator />
            <Text style={styles.subtitle}>Checking availability…</Text>
          </View>
        ) : (
          <Text style={styles.subtitle}>
            {status ? getHumanMessage(status) : "Status unknown."}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        {!loading && status && (
          <>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                Recommended: {recommendedMode.toUpperCase()}
              </Text>
            </View>

            {showApplyButton ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.btn}
                onPress={() => onApplyRecommended?.(recommendedMode)}
              >
                <Text style={styles.btnText}>Use recommended</Text>
              </TouchableOpacity>
            ) : onOpenSettings ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.btn, styles.btnGhost]}
                onPress={onOpenSettings}
              >
                <Text style={styles.btnText}>Settings</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  wrapCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  goodWrap: {
    borderColor: "rgba(34, 197, 94, 0.35)",
    backgroundColor: "rgba(20, 83, 45, 0.18)",
  },
  warnWrap: {
    borderColor: "rgba(251, 191, 36, 0.35)",
    backgroundColor: "rgba(120, 53, 15, 0.18)",
  },
  left: { flex: 1 },
  right: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
  },
  title: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 12.5,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    backgroundColor: "rgba(2, 6, 23, 0.35)",
  },
  pillText: {
    color: "#e5e7eb",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
    backgroundColor: "rgba(2, 6, 23, 0.35)",
  },
  btnGhost: {
    backgroundColor: "transparent",
  },
  btnText: {
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: "700",
  },
});
