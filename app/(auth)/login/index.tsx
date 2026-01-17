import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { getMe, login } from "../../../lib/api";
import AuthButton from "../shared/AuthButton";
import AuthHeader from "../shared/AuthHeader";
import AuthTextField from "../shared/AuthTextField";
import PasswordField from "../shared/PasswordField";
import { mapApiError } from "../shared/mapApiError";
import { authStyles } from "../shared/styles";
import { useAuthFieldFocus } from "../shared/useAuthFieldFocus";
import { validateEmail, validatePassword } from "../shared/validators";

type FieldErrors = {
  email?: string;
  password?: string;
};

export const options = {
  title: "Sign in",
  headerTitle: "Sign in",
  headerShown: true,
};

export default function LoginScreen() {
  const router = useRouter();

  const { register, focusNext } = useAuthFieldFocus([
    "email",
    "password",
  ] as const);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);

  const [bannerError, setBannerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [forgotOpen, setForgotOpen] = useState(false);

  // ✅ Session check (prevents flicker)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          if (mounted) setCheckingSession(false);
          return;
        }

        await getMe(token);
        if (!mounted) return;
        router.replace("/(tabs)");
      } catch {
        await AsyncStorage.removeItem("token");
        if (mounted) setCheckingSession(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const canSubmit = useMemo(() => {
    if (checkingSession || loading) return false;
    const e = validateEmail(email);
    const p = validatePassword(password);
    return e.ok && p.ok;
  }, [checkingSession, loading, email, password]);

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

    const e = validateEmail(email);
    const p = validatePassword(password);

    const nextErrors: FieldErrors = {};
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

      const res: any = await login({
        email: e.value.toLowerCase(),
        password: p.value,
      });

      const token = res?.token;
      if (!token) {
        setBannerError("Login failed: missing token from server.");
        setPassword("");
        return;
      }

      await AsyncStorage.setItem("token", token);
      router.replace("/(tabs)");
    } catch (err: any) {
      setBannerError(mapApiError(err));
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={authStyles.root}>
      <KeyboardAvoidingView
        style={authStyles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={authStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          <AuthHeader
            title="Sign in"
            subtitle="Welcome back — continue learning where you left off."
          />

          {checkingSession ? (
            <View
              style={{ paddingVertical: 24, alignItems: "center", gap: 10 }}
            >
              <ActivityIndicator />
              <Text style={authStyles.subtitle}>Checking your session…</Text>
            </View>
          ) : (
            <>
              {bannerError ? (
                <View style={authStyles.bannerError}>
                  <Text style={authStyles.bannerErrorText}>{bannerError}</Text>
                </View>
              ) : null}

              <AuthTextField
                ref={register("email")}
                label="Email"
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  clearBannerAndField("email");
                }}
                placeholder="you@example.com"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => focusNext("email")}
                editable={!loading}
                errorText={fieldErrors.email}
              />

              <PasswordField
                ref={register("password")}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  clearBannerAndField("password");
                }}
                errorText={fieldErrors.password}
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                editable={!loading}
              />

              <Pressable
                onPress={() => setForgotOpen(true)}
                disabled={loading}
                style={({ pressed }) => [
                  { alignSelf: "flex-end", marginTop: 6 },
                  pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <Text style={authStyles.linkBtn}>Forgot password?</Text>
              </Pressable>

              <AuthButton
                title={loading ? "Signing in…" : "Sign in"}
                loading={loading}
                disabled={!canSubmit}
                onPress={onSubmit}
              />

              <View style={authStyles.linkRow}>
                <Text style={authStyles.linkText}>Don’t have an account?</Text>
                <Link href="/(auth)/signup" style={authStyles.linkBtn}>
                  Create one
                </Link>
              </View>
            </>
          )}
        </ScrollView>

        {/* ✅ Forgot password modal */}
        <Modal
          transparent
          visible={forgotOpen}
          animationType="fade"
          onRequestClose={() => setForgotOpen(false)}
        >
          <Pressable
            onPress={() => setForgotOpen(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.6)",
              justifyContent: "center",
              padding: 18,
            }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: "#0B1120",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "#1E293B",
                padding: 16,
              }}
            >
              <Text
                style={{
                  color: "#F9FAFB",
                  fontSize: 16,
                  fontWeight: "900",
                  marginBottom: 6,
                }}
              >
                Password reset
              </Text>
              <Text style={{ color: "#94A3B8", fontSize: 13, lineHeight: 18 }}>
                Coming soon. For now, create a new account or contact support if
                you’re locked out.
              </Text>

              <Pressable
                onPress={() => setForgotOpen(false)}
                style={({ pressed }) => [
                  {
                    marginTop: 14,
                    backgroundColor: "#22C55E",
                    borderRadius: 999,
                    paddingVertical: 12,
                    alignItems: "center",
                  },
                  pressed ? { opacity: 0.9 } : null,
                ]}
              >
                <Text style={{ color: "#022C22", fontWeight: "900" }}>OK</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}
