// app/sessions/screens/request/components/RequestTopBar.tsx
import React from "react";
import { Pressable, Text, View } from "react-native";
import { COLORS } from "../styles";
import { Title } from "./UI";

/**
 * RequestTopBar (UI/UX fix)
 * المشكلة: كلمة "Back" هون بتوهم المستخدم انها خطوة لورا، بس هي فعليًا بتطلع من الشاشة (router.back)
 * الحل: نخليها "Close" (أو "Cancel") بشكل واضح.
 *
 * ✅ ما غيّرنا ولا ذرة لوجيك — بس نصوص وشكل ووضوح.
 */
export default function RequestTopBar({
  onBack,
  title,
  leftLabel = "Close",
}: {
  onBack: () => void;
  title: string;
  leftLabel?: string; // optional, default "Close"
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={leftLabel}
        style={({ pressed }) => [
          {
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.bg,
          },
          pressed ? { opacity: 0.9 } : null,
        ]}
      >
        <Text style={{ color: COLORS.link, fontWeight: "900", fontSize: 12 }}>
          ✕ {leftLabel}
        </Text>
      </Pressable>

      <View style={{ flex: 1, paddingHorizontal: 10 }}>
        <Title>{title}</Title>
      </View>

      {/* spacer to keep title centered */}
      <View style={{ width: 74 }} />
    </View>
  );
}
