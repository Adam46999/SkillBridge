// Global call overlay that persists across navigation
import React, { createContext, useContext, useState, ReactNode } from "react";
import { View } from "react-native";
import CallControls from "./chats/CallControls";

type CallState = {
  peerId: string;
  peerName?: string;
  conversationId?: string;
  initialRingingFrom?: string;
} | null;

type CallContextType = {
  startCall: (params: NonNullable<CallState>) => void;
  endCall: () => void;
};

const CallContext = createContext<CallContextType>({
  startCall: () => {},
  endCall: () => {},
});

export function useGlobalCall() {
  return useContext(CallContext);
}

export function GlobalCallProvider({ children }: { children: ReactNode }) {
  const [callState, setCallState] = useState<CallState>(null);

  const startCall = (params: NonNullable<CallState>) => {
    setCallState(params);
  };

  const endCall = () => {
    setCallState(null);
  };

  return (
    <CallContext.Provider value={{ startCall, endCall }}>
      {children}
      
      {/* Global call overlay - always mounted */}
      <View
        style={{
          position: "absolute",
          bottom: 80,
          left: 12,
          right: 12,
          zIndex: 9999,
          display: callState ? "flex" : "none",
        }}
        pointerEvents={callState ? "auto" : "none"}
      >
        {callState && (
          <CallControls
            peerId={callState.peerId}
            peerName={callState.peerName}
            conversationId={callState.conversationId}
            initialRingingFrom={callState.initialRingingFrom}
            onClose={endCall}
          />
        )}
      </View>
    </CallContext.Provider>
  );
}
