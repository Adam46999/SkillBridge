export function mapApiError(err: any): string {
  // Try to pick the most useful message without leaking raw server dumps.
  const raw =
    String(err?.message || "").trim() ||
    String(err?.response?.data?.message || "").trim() ||
    String(err?.response?.data?.error || "").trim();

  const msg = raw.toLowerCase();

  if (!raw) return "Something went wrong. Please try again.";

  // Network-ish
  if (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("socket") ||
    msg.includes("ecconn") ||
    msg.includes("timeout")
  ) {
    return "Can’t reach the server. Check your internet (or API URL) and try again.";
  }

  // Auth / credentials
  if (
    msg.includes("invalid credentials") ||
    msg.includes("invalid") && msg.includes("password") ||
    msg.includes("incorrect") ||
    msg.includes("unauthorized") ||
    msg.includes("401")
  ) {
    return "Email or password is incorrect.";
  }

  // Signup collisions
  if (msg.includes("already") && msg.includes("email")) {
    return "This email is already registered. Try logging in.";
  }
  if (msg.includes("exists") && msg.includes("email")) {
    return "This email is already registered. Try logging in.";
  }

  // User not found (login)
  if (msg.includes("not found") || msg.includes("no user")) {
    return "This email is not registered yet.";
  }

  // Token missing from backend
  if (msg.includes("missing") && msg.includes("token")) {
    return "Login succeeded but server didn’t return a token. Please contact support.";
  }

  // Generic fallback: avoid very long raw messages
  if (raw.length > 140) return "Something went wrong. Please try again.";
  return raw;
}
