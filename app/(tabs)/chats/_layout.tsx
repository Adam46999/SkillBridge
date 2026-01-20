import { Stack } from "expo-router";

export default function ChatsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[conversationId]" />
      <Stack.Screen name="CallControls" />
      <Stack.Screen name="FileUploader" />
      <Stack.Screen name="(components)/MessageBubble" />
      <Stack.Screen name="(components)/ChatHeader" />
      <Stack.Screen name="(components)/ChatInput" />
      <Stack.Screen name="(components)/MessagesList" />
      <Stack.Screen name="(components)/TopLoadingHint" />
    </Stack>
  );
}
