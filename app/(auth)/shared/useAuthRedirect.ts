import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

/**
 * If token exists -> redirect to "/"
 * Returns ready=false while checking storage (to avoid flicker)
 */
export function useAuthRedirect() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!mounted) return;

        if (token) {
          router.replace("/"); // go to tabs/home
          return;
        }
      } finally {
        if (mounted) setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return { ready };
}
