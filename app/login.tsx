// app/login.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { login } from "../lib/api";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const clearError = () => {
    if (errorText) setErrorText(null);
  };

  const validate = () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setErrorText("Please fill in both email and password.");
      return false;
    }
    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      setErrorText("Please enter a valid email address.");
      return false;
    }
    if (password.length < 6) {
      setErrorText("Password must be at least 6 characters long.");
      return false;
    }
    setErrorText(null);
    return true;
  };

  const handleLogin = async () => {
    if (loading) return;
    Keyboard.dismiss();

    if (!validate()) return;

    try {
      setLoading(true);
      setErrorText(null);

      const trimmedEmail = email.trim().toLowerCase();
      const data = await login(trimmedEmail, password);

      await AsyncStorage.setItem("authToken", data.token);

      // انتقال مباشر للتطبيق بعد نجاح البروسه
      router.replace("/(tabs)" as any);
    } catch (err: any) {
      console.log("Login error:", err);
      const msg =
        err?.message === "Invalid credentials"
          ? "Incorrect email or password. Please try again."
          : err?.message || "We couldn’t sign you in. Please try again.";
      setErrorText(msg);
    } finally {
      setLoading(false);
    }
  };

  const goToSignup = () => {
    if (loading) return;
    router.push("/signup" as any);
  };

  const handleForgotPassword = () => {
    setErrorText(
      "Password reset is not available yet. Please create a new account if needed."
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020617" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Brand / Header */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>SS</Text>
            </View>
            <View>
              <Text style={styles.appName}>SkillSwap</Text>
              <Text style={styles.appTagline}>
                Learn and teach skills with real people.
              </Text>
            </View>
          </View>

          {/* Auth Card */}
          <View style={styles.card}>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>
              Welcome back. Enter your details to continue.
            </Text>

            {errorText && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>We couldn’t sign you in</Text>
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#6B7280"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearError();
              }}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#6B7280"
              secureTextEntry
              returnKeyType="done"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearError();
              }}
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={loading}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>Forgot your password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>Signing you in…</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Don’t have an account?</Text>
              <TouchableOpacity onPress={goToSignup} disabled={loading}>
                <Text style={styles.footerLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logoText: {
    color: "#F97316",
    fontWeight: "700",
    fontSize: 16,
  },
  appName: {
    color: "#F9FAFB",
    fontSize: 20,
    fontWeight: "700",
  },
  appTagline: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  card: {
    backgroundColor: "#020617",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 13,
    marginBottom: 20,
  },
  label: {
    color: "#E5E7EB",
    fontSize: 13,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#020617",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#374151",
  },
  errorBox: {
    backgroundColor: "#451A1A",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginBottom: 4,
  },
  errorTitle: {
    color: "#FCA5A5",
    fontWeight: "600",
    marginBottom: 2,
    fontSize: 13,
  },
  errorText: {
    color: "#FECACA",
    fontSize: 13,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginTop: 8,
    marginBottom: 16,
  },
  forgotText: {
    color: "#60A5FA",
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: "#F97316",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FEFCE8",
    fontWeight: "600",
    fontSize: 16,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerRow: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  footerLink: {
    color: "#FBBF24",
    fontWeight: "600",
    marginLeft: 4,
    fontSize: 13,
  },
});
