// app/sessions/request.tsx
import RequestSessionScreen from "./screens/request/RequestSessionScreen";

export default function Request() {
  return <RequestSessionScreen />;
}

export const options = {
  title: "Request session",
  headerTitle: "Request session",
  headerShown: false,
};
