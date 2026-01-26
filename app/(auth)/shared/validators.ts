export function validateEmail(email: string) {
  const v = email.trim();
  const ok = /^\S+@\S+\.\S+$/.test(v);
  return { ok, value: v, error: ok ? null : "Please enter a valid email." };
}

export function validateUsername(username: string) {
  const v = username.trim().toLowerCase();
  const ok = v.length >= 3 && /^[a-z0-9_]+$/.test(v);
  return { ok, value: v, error: ok ? null : "Username must be at least 3 characters and contain only letters, numbers, and underscores." };
}

export function validatePassword(password: string) {
  const v = password;
  const ok = v.length >= 6;
  return { ok, value: v, error: ok ? null : "Password must be at least 6 characters." };
}

export function validateFullName(fullName: string) {
  const v = fullName.trim();
  const ok = v.length >= 2;
  return { ok, value: v, error: ok ? null : "Please enter your full name." };
}
