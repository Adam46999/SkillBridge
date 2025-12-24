// app/shared/profileCompletion.ts
// ✅ Single-source-of-truth: re-export from /lib to avoid duplicated logic.
// This keeps old imports working if any screen still imports from app/shared.

export { getProfileCompletionStatus } from "../../lib/profileCompletion";
export type { ProfileCompletionStatus } from "../../lib/profileCompletion";

