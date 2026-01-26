import React, { useRef, useImperativeHandle, forwardRef, Ref } from "react";
import { View, Platform } from "react-native";
import { uploadConversationFile } from "../../../lib/api";

type Props = {
  conversationId: string;
  token: string;
  onUploaded?: () => void;
};

export type FileUploaderHandle = {
  triggerUpload: () => void;
};

const FileUploader = forwardRef<FileUploaderHandle, Props>((props, ref) => {
  const { conversationId, token, onUploaded } = props;
  const inputRef = useRef<HTMLInputElement | null>(null as any);

  useImperativeHandle(ref, () => ({
    triggerUpload: () => {
      if (Platform.OS === "web" && inputRef.current) {
        inputRef.current.click();
      }
    },
  }));

  const onFileChange = async (ev: any) => {
    const file = ev?.target?.files?.[0];
    if (!file) return;
    
    // Check file size (limit to 10MB for small files)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert("File is too large. Maximum size is 10MB.");
      return;
    }

    try {
      await uploadConversationFile(token, conversationId, file);
      // Clear the input so the same file can be uploaded again
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      // Call the callback to refresh messages
      onUploaded?.();
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
      </View>
    );
  }

  return null;
});

FileUploader.displayName = "FileUploader";

export default FileUploader;
