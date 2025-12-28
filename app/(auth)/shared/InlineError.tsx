import React from "react";
import { Text, View } from "react-native";
import { authStyles } from "./styles";

type Props = { text?: string | null };

export default function InlineError({ text }: Props) {
  if (!text) return null;
  return (
    <View style={authStyles.inlineErrorBox}>
      <Text style={authStyles.inlineErrorText}>{text}</Text>
    </View>
  );
}
