import { useRef } from "react";
import { TextInput } from "react-native";

export function useAuthFieldFocus<T extends string>(keys: readonly T[]) {
  const refs = useRef<Record<T, TextInput | null>>({} as any);

  const register = (key: T) => (ref: TextInput | null) => {
    refs.current[key] = ref;
  };

  const focusNext = (key: T) => {
    const idx = keys.indexOf(key);
    const nextKey = keys[idx + 1];
    if (nextKey && refs.current[nextKey]) {
      refs.current[nextKey]?.focus();
    }
  };

  return { register, focusNext };
}
