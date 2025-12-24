import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { authStyles } from "./styles";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export default function AuthButton({
  title,
  onPress,
  loading,
  disabled,
}: Props) {
  const isDisabled = !!disabled || !!loading;

  return (
    <TouchableOpacity
      style={[
        authStyles.primaryBtn,
        isDisabled && authStyles.primaryBtnDisabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
    >
      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ActivityIndicator />
          <Text style={authStyles.primaryBtnText}>{title}</Text>
        </View>
      ) : (
        <Text style={authStyles.primaryBtnText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
