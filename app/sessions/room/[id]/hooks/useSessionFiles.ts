// app/sessions/room/[id]/hooks/useSessionFiles.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useRef, useState } from "react";

import type { SessionFileDTO } from "../../../api/sessionsApi";
import { listSessionFiles, uploadSessionFile } from "../../../api/sessionsApi";

async function getToken() {
  return (await AsyncStorage.getItem("token")) || null;
}

export function useSessionFiles(sessionId: string) {
  const [files, setFiles] = useState<SessionFileDTO[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [errorFiles, setErrorFiles] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const tokenRef = useRef<string | null>(null);

  const refresh = useCallback(
    async (silent?: boolean) => {
      if (!sessionId) return;

      try {
        setErrorFiles(null);
        if (!silent) setLoadingFiles(true);

        const tk = tokenRef.current || (await getToken());
        tokenRef.current = tk;
        if (!tk) {
          setFiles([]);
          setErrorFiles("Not logged in");
          return;
        }

        const list = await listSessionFiles(tk, sessionId);
        setFiles(Array.isArray(list) ? list : []);
      } catch (e: any) {
        setErrorFiles(e?.message || "Failed to load files");
      } finally {
        if (!silent) setLoadingFiles(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    void refresh(false);
  }, [refresh]);

  const upload = useCallback(async () => {
    if (!sessionId || uploading) return;

    const tk = tokenRef.current || (await getToken());
    tokenRef.current = tk;
    if (!tk) {
      setErrorFiles("Not logged in");
      return;
    }

    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;

      setUploading(true);
      const up = await uploadSessionFile(tk, sessionId, {
        uri: asset.uri,
        name: asset.name || "file",
        mimeType: asset.mimeType || "application/octet-stream",
      });

      setFiles((prev) => [up, ...prev]);
    } catch (e: any) {
      setErrorFiles(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [sessionId, uploading]);

  return {
    files,
    loadingFiles,
    errorFiles,
    uploading,
    refresh,
    upload,
  };
}
