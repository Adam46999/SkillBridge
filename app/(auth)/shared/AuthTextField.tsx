import React from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import InlineError from "./InlineError";
import { authStyles } from "./styles";

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  errorText?: string | null;
} & Omit<TextInputProps, "value" | "onChangeText">;

const AuthTextField = React.forwardRef<TextInput, Props>(function AuthTextField(
  { label, value, onChangeText, placeholder, errorText, style, ...rest },
  ref
) {
  return (
    <View style={authStyles.fieldWrap}>
      <Text style={authStyles.fieldLabel}>{label}</Text>
      <TextInput
        ref={ref}
        style={[authStyles.input, !!errorText && authStyles.inputError, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      <InlineError text={errorText} />
    </View>
  );
});

export default AuthTextField;
