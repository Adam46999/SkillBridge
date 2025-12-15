// app/signup.tsx
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
import { signup } from "../lib/api";

export default function SignupScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    if (!trimmedName || !trimmedEmail || !password || !confirm) {
      setErrorText("Please fill in all fields.");
      return;
    }

    if (password !== confirm) {
      setErrorText("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setErrorText("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    setErrorText(null);

    try {
      const res: any = await signup({
        fullName: trimmedName,
        email: trimmedEmail,
        password,
      });

      const token: string | undefined = res?.token;
      if (!token) {
        throw new Error("Signup succeeded but token is missing from response.");
      }

      await AsyncStorage.setItem("token", token);
      await AsyncStorage.setItem("authToken", token);

      router.replace("/(tabs)");
    } catch (err: any) {
      console.log("SIGNUP ERROR (frontend):", err);
      setErrorText(err?.message || "We couldn’t create your account.");
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
        <Text style={styles.pageTitle}>Create an account</Text>
        <Text style={styles.subtitle}>
          Join SkillSwap and start exchanging skills with other learners.
        </Text>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>
              We couldn’t create your account
            </Text>
            <Text style={styles.errorBody}>{errorText}</Text>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            placeholderTextColor="#6b7280"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
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
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#6b7280"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
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
            <Text style={styles.submitText}>Sign up</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={{ marginTop: 16 }}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.secondaryText}>
            Already have an account?{" "}
            <Text style={styles.secondaryLink}>Sign in</Text>
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
    backgroundColor: "#22c55e",
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
