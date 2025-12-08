// app/signup.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  const clearMessages = () => {
    if (errorText) setErrorText(null);
  };

  const validate = () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !password || !confirmPassword) {
      setErrorText("Please fill in all fields.");
      return false;
    }
    if (trimmedName.length < 3) {
      setErrorText("Full name must be at least 3 characters long.");
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
    if (password !== confirmPassword) {
      setErrorText("Passwords do not match.");
      return false;
    }
    setErrorText(null);
    return true;
  };

  const handleSignup = async () => {
    if (loading || redirecting) return;
    Keyboard.dismiss();
    clearMessages();

    if (!validate()) return;

    try {
      setLoading(true);

      const trimmedName = fullName.trim();
      const trimmedEmail = email.trim().toLowerCase();

      const data = await signup(trimmedName, trimmedEmail, password);

      console.log("Signup success:", data);

      await AsyncStorage.setItem("authToken", data.token);

      // نجهز شاشة النجاح
      setSuccessName(data.user.fullName || trimmedName || "there");
      setRedirecting(true);

      // بعد ثانية ننقله على التابات
      setTimeout(() => {
        router.replace("/(tabs)" as any);
      }, 1000);
    } catch (err: any) {
      console.log("Signup error:", err);
      const msg =
        err?.message === "Email already used"
          ? "This email is already registered. Try logging in instead."
          : err?.message ||
            "Could not create your account. Please review your details and try again.";
      setErrorText(msg);
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    if (loading || redirecting) return;
    router.push("/login" as any);
  };

  // 🔁 شاشة النجاح الكاملة بعد إنشاء الحساب
  if (redirecting) {
    return (
      <View style={styles.successScreen}>
        <Text style={styles.bigCheck}>✨</Text>
        <Text style={styles.successTitle}>
          Welcome to SkillSwap{successName ? `, ${successName}` : ""}!
        </Text>
        <Text style={styles.successSubtitle}>
          Your account is ready. We’re setting up your dashboard…
        </Text>
        <ActivityIndicator style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create an account</Text>
      <Text style={styles.subtitle}>
        Join SkillSwap and start exchanging skills with other learners.
      </Text>

      {errorText && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>We couldn’t create your account</Text>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor="#9CA3AF"
        value={fullName}
        onChangeText={(text) => {
          setFullName(text);
          clearMessages();
        }}
        returnKeyType="next"
      />

      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          clearMessages();
        }}
        returnKeyType="next"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#9CA3AF"
        secureTextEntry
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          clearMessages();
        }}
        returnKeyType="next"
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        placeholderTextColor="#9CA3AF"
        secureTextEntry
        value={confirmPassword}
        onChangeText={(text) => {
          setConfirmPassword(text);
          clearMessages();
        }}
        returnKeyType="done"
        onSubmitEditing={handleSignup}
      />

      <TouchableOpacity
        style={[
          styles.primaryButton,
          (loading || redirecting) && styles.disabledButton,
        ]}
        onPress={handleSignup}
        disabled={loading || redirecting}
      >
        <Text style={styles.primaryButtonText}>
          {loading ? "Creating account..." : "Sign up"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={goToLogin} disabled={loading || redirecting}>
        <Text style={styles.linkText}>
          Already have an account?{" "}
          <Text style={styles.linkHighlight}>Sign in</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // الشاشة الأساسية
  container: {
    flex: 1,
    backgroundColor: "#111827",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "left",
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: "#451A1A",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginBottom: 12,
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
  input: {
    backgroundColor: "#1F2937",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  primaryButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FEFCE8",
    fontWeight: "600",
    fontSize: 16,
  },
  linkText: {
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 16,
    fontSize: 13,
  },
  linkHighlight: {
    color: "#FBBF24",
    fontWeight: "600",
  },

  // شاشة النجاح
  successScreen: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  bigCheck: {
    fontSize: 56,
    marginBottom: 16,
  },
  successTitle: {
    color: "#ECFEFF",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  successSubtitle: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
  },
});
