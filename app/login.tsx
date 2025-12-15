// app/login.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setErrorText("Please fill in both email and password.");
      return;
    }

    setSubmitting(true);
    setErrorText(null);

    try {
      const res: any = await login({
        email: trimmedEmail,
        password,
      });

      // الباك إند بيرجع: { token, user: { ... } }
      const token: string | undefined = res?.token;
      if (!token) {
        throw new Error("Login succeeded but token is missing from response.");
      }

      // نخزن التوكن تحت مفتاح واحد ثابت
      await AsyncStorage.setItem("token", token);

      // روح للهوم / التابز
      router.replace("/(tabs)");
    } catch (err: any) {
      console.log("LOGIN ERROR (frontend):", err);
      setErrorText(
        err?.message || "We couldn’t sign you in. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#020617" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.appTitle}>SkillSwap</Text>
        <Text style={styles.pageTitle}>Sign in</Text>
        <Text style={styles.subtitle}>
          Welcome back. Enter your details to continue.
        </Text>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>We couldn’t sign you in</Text>
            <Text style={styles.errorBody}>{errorText}</Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(t) => setEmail(t)}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#6b7280"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(t) => setPassword(t)}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#6b7280"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            submitting && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>Sign in</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: 16 }}
          onPress={() => router.push("/signup")}
        >
          <Text style={styles.secondaryText}>
            Don’t have an account?{" "}
            <Text style={styles.secondaryLink}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e5e7eb",
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#f9fafb",
  },
  subtitle: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 4,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: "#7f1d1d",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fee2e2",
    marginBottom: 2,
  },
  errorBody: {
    fontSize: 13,
    color: "#fee2e2",
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: "#d1d5db",
    marginBottom: 4,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4b5563",
    backgroundColor: "#020617",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#f9fafb",
  },
  submitButton: {
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#f97316",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
  secondaryText: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
  },
  secondaryLink: {
    color: "#fdba74",
    fontWeight: "600",
  },
});
