import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { signup } from "../../../lib/api";
import AuthButton from "../shared/AuthButton";
import AuthHeader from "../shared/AuthHeader";
import AuthTextField from "../shared/AuthTextField";
import PasswordField from "../shared/PasswordField";
import { mapApiError } from "../shared/mapApiError";
import { authStyles } from "../shared/styles";
import { useAuthFieldFocus } from "../shared/useAuthFieldFocus";
import {
  validateEmail,
  validateFullName,
  validatePassword,
} from "../shared/validators";

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
};

export default function SignupScreen() {
  const router = useRouter();
  const { register, focusNext } = useAuthFieldFocus([
    "fullName",
    "email",
    "password",
  ] as const);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const canSubmit = useMemo(() => {
    if (loading) return false;
    const n = validateFullName(fullName);
    const e = validateEmail(email);
    const p = validatePassword(password);
    return n.ok && e.ok && p.ok;
  }, [loading, fullName, email, password]);

  const clearBannerAndField = (k: keyof FieldErrors) => {
    setBannerError(null);
    setFieldErrors((prev) => {
      if (!prev[k]) return prev;
      return { ...prev, [k]: undefined };
    });
  };

  const onSubmit = async () => {
    setBannerError(null);
    setFieldErrors({});

    const n = validateFullName(fullName);
    const e = validateEmail(email);
    const p = validatePassword(password);

    const nextErrors: FieldErrors = {};
    if (!n.ok) nextErrors.fullName = n.error || "Please enter your full name.";
    if (!e.ok) nextErrors.email = e.error || "Please enter a valid email.";
    if (!p.ok)
      nextErrors.password =
        p.error || "Password must be at least 6 characters.";

    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      return;
    }

    try {
      setLoading(true);

      const res: any = await signup({
        fullName: n.value,
        email: e.value.toLowerCase(),
        password: p.value,
      });

      const token = res?.token;
      if (!token) {
        setBannerError("Signup failed: missing token from server.");
        return;
      }

      await AsyncStorage.setItem("token", token);
      router.replace("/(tabs)" as any);
    } catch (err: any) {
      setBannerError(mapApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={authStyles.root}>
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AuthHeader
          title="Create account"
          subtitle="Join SkillSwap and start learning & teaching."
        />

        {bannerError ? (
          <View style={authStyles.bannerError}>
            <Text style={authStyles.bannerErrorText}>{bannerError}</Text>
          </View>
        ) : null}

        <AuthTextField
          ref={register("fullName")}
          label="Full name"
          value={fullName}
          onChangeText={(t) => {
            setFullName(t);
            clearBannerAndField("fullName");
          }}
          placeholder="Your name"
          errorText={fieldErrors.fullName}
          editable={!loading}
          returnKeyType="next"
          onSubmitEditing={() => focusNext("fullName")}
        />

        <AuthTextField
          ref={register("email")}
          label="Email"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            clearBannerAndField("email");
          }}
          placeholder="name@example.com"
          keyboardType="email-address"
          errorText={fieldErrors.email}
          editable={!loading}
          returnKeyType="next"
          onSubmitEditing={() => focusNext("email")}
        />

        <PasswordField
          ref={register("password")}
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            clearBannerAndField("password");
          }}
          errorText={fieldErrors.password}
          editable={!loading}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
        />

        <AuthButton
          title={loading ? "Creating…" : "Create account"}
          loading={loading}
          disabled={!canSubmit}
          onPress={onSubmit}
        />

        <View style={authStyles.linkRow}>
          <Text style={authStyles.linkText}>Already have an account?</Text>
          <Link href="/(auth)/login" style={authStyles.linkBtn}>
            Sign in
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}
