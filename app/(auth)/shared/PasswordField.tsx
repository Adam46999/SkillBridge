import React, { useState } from "react";
import {
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import InlineError from "./InlineError";
import { authStyles } from "./styles";

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  errorText?: string | null;
  label?: string;
} & Omit<TextInputProps, "value" | "onChangeText" | "secureTextEntry">;

const PasswordField = React.forwardRef<TextInput, Props>(function PasswordField(
  { value, onChangeText, errorText, label = "Password", style, ...rest },
  ref
) {
  const [show, setShow] = useState(false);

  return (
    <View style={authStyles.fieldWrap}>
      <Text style={authStyles.fieldLabel}>{label}</Text>

      <View style={authStyles.passwordRow}>
        <TextInput
          ref={ref}
          style={[
            authStyles.input,
            { flex: 1 },
            !!errorText && authStyles.inputError,
            style,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder="••••••••"
          placeholderTextColor="#64748B"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />

        <TouchableOpacity
          onPress={() => setShow((v) => !v)}
          style={authStyles.eyeBtn}
          accessibilityRole="button"
          accessibilityLabel={show ? "Hide password" : "Show password"}
          activeOpacity={0.85}
        >
          <Text style={authStyles.eyeText}>{show ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>

      <InlineError text={errorText} />
    </View>
  );
});

export default PasswordField;
