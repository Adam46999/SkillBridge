import { Text, View } from "react-native";

export default function MessageBubble({
  msg,
  mine,
}: {
  msg: any;
  mine: boolean;
}) {
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        backgroundColor: mine ? "#10B981" : "#1F2937",
        padding: 10,
        borderRadius: 12,
        marginVertical: 4,
        maxWidth: "80%",
      }}
    >
      <Text style={{ color: "#fff" }}>{msg.text}</Text>
    </View>
  );
}
