import React, { useMemo } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";

type Props = {
  /**
   * width can be:
   * - number (e.g. 120)
   * - percentage string (e.g. "80%")
   */
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: any;
};

export default function SkeletonCard({
  width = "100%",
  height = 14,
  radius = 10,
  style,
}: Props) {
  // ✅ ensure correct type for RN style
  const safeWidth = useMemo(() => width as DimensionValue, [width]);

  return (
    <View
      style={[
        styles.skeleton,
        {
          width: safeWidth,
          height,
          borderRadius: radius,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#0B1120",
    borderWidth: 1,
    borderColor: "#111827",
    overflow: "hidden",
  },
});
