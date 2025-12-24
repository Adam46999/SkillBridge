import React from "react";
import { Text, View } from "react-native";
import { authStyles } from "./styles";

type Props = { title: string; subtitle: string };

export default function AuthHeader({ title, subtitle }: Props) {
  return (
    <View style={authStyles.header}>
      <Text style={authStyles.title}>{title}</Text>
      <Text style={authStyles.subtitle}>{subtitle}</Text>
    </View>
  );
}
