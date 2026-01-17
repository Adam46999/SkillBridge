import React, { useRef } from "react";
import { View, Button, Platform } from "react-native";
import { uploadConversationFile } from "../../../lib/api";

type Props = {
  conversationId: string;
  token: string;
};

export default function FileUploader({ conversationId, token }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null as any);

  const onPickWeb = async () => {
    if (Platform.OS !== "web") return;
    const el = inputRef.current;
    if (!el) return;
    el.click();
  };

  const onFileChange = async (ev: any) => {
    const file = ev?.target?.files?.[0];
    if (!file) return;
    try {
      await uploadConversationFile(token, conversationId, file);
      // TODO: show success and refresh
      alert("Uploaded");
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  };

  if (Platform.OS === "web") {
    return (
      <View>
        <input
          ref={inputRef}
          type="file"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
        <Button title="Upload File" onPress={onPickWeb} />
      </View>
    );
  }

  return (
    <View>
      <Button title="Upload File (native not implemented)" onPress={() => {}} />
    </View>
  );
}
