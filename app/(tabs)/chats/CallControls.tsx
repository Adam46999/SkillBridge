import React, { useEffect, useRef, useState } from "react";
import { View, Button, Platform, Alert, Text } from "react-native";
import {
  sendOffer,
  sendAnswer,
  sendIceCandidate,
  sendRing,
  sendReject,
  sendCallStarted,
  sendCallEnded,
  onOffer,
  onCallStarted,
  onAnswer,
  onIceCandidate,
  onRing,
  onReject,
  onCallEnded,
} from "../../../lib/chat/socket";

type Props = { peerId: string; peerName?: string; conversationId?: string; initialRingingFrom?: string; onClose?: () => void };

export default function CallControls({ peerId, peerName, conversationId, initialRingingFrom, onClose }: Props) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [callActive, setCallActive] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<{ from: string; sdp: any } | null>(null);
  const incomingOfferRef = useRef<{ from: string; sdp: any } | null>(null);
  const acceptingRef = useRef(false);
  const callStartedSentRef = useRef(false);
  const lastLocalCallStartedAtRef = useRef<number | null>(null);
  const receivedCallStartedRef = useRef(false);
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ringtoneRef = useRef<{ ctx: AudioContext; osc: OscillatorNode } | null>(null);
  const pendingIceRef = useRef<any[]>([]);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pulse, setPulse] = useState(false);
  const pulseRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  // 🔧 Track call state more aggressively
  const callAnsweredRef = useRef(false);
  const callConnectedRef = useRef(false);

  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<string>("0:00");
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function dumpPcStats(tag: string) {
    try {
      const pc = pcRef.current;
      if (!pc) return;
      const stats = await pc.getStats();
      stats.forEach((report: any) => {
        if (["candidate-pair", "local-candidate", "remote-candidate", "transport", "inbound-rtp", "outbound-rtp"].includes(report.type)) {
          console.log(`[webrtc][stats][${tag}]`, report.type, report.id, report);
        }
      });
    } catch (e) {
      console.warn("[webrtc][stats] failed to getStats", e);
    }
  }

  function startRingtone() {
    try {
      if (ringtoneRef.current) return;
      if (callAnsweredRef.current || callConnectedRef.current) return; // 🔧 Don't start if call is answered/connected
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.value = 0.02;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      ringtoneRef.current = { ctx, osc } as any;
      console.log("[webrtc] ringtone started");
    } catch (e) {
      console.warn("[webrtc] failed to start ringtone", e);
    }
  }

  function stopRingtone() {
    try {
      if (!ringtoneRef.current) return;
      console.log("[webrtc] stopping ringtone");
      try {
        ringtoneRef.current.osc.stop();
      } catch {}
      try {
        ringtoneRef.current.ctx.close();
      } catch {}
      ringtoneRef.current = null;
    } catch {}
  }

  // 🔧 COMPLETELY REWRITTEN: Nuclear option for stopping ALL ringing
  function stopAllRinging(reason?: string) {
    console.log(`[webrtc] stopAllRinging called - reason: ${reason || 'unknown'}`);
    
    // 🔧 STEP 1: Stop all audio immediately
    try {
      stopRingtone();
    } catch {}

    // 🔧 STEP 2: Clear ALL intervals and timeouts
    if (pulseRef.current) {
      try {
        clearInterval(pulseRef.current);
        console.log("[webrtc] pulse interval cleared");
      } catch {}
      pulseRef.current = null;
    }

    if (ringTimeoutRef.current) {
      try {
        clearTimeout(ringTimeoutRef.current);
        console.log("[webrtc] ring timeout cleared");
      } catch {}
      ringTimeoutRef.current = null;
    }

    // 🔧 STEP 3: Reset UI state
    try {
      setRinging(false);
      setPulse(false);
    } catch {}

    console.log("[webrtc] all ringing stopped");
  }

  useEffect(() => {
    if (Platform.OS !== "web") return;

    if (initialRingingFrom) {
      try {
        const testCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const st = testCtx.state;
        try {
          testCtx.close();
        } catch {}
        if (st === "suspended") {
          setNeedsAudioUnlock(true);
        } else {
          setRinging(true);
          startRingtone();
          if (!pulseRef.current) pulseRef.current = setInterval(() => setPulse((p) => !p), 600);
        }
      } catch {
        setRinging(true);
        startRingtone();
        if (!pulseRef.current) pulseRef.current = setInterval(() => setPulse((p) => !p), 600);
      }
    }

    const offOffer = onOffer(async ({ fromUserId, sdp }) => {
      try {
        if (incomingOfferRef.current && incomingOfferRef.current.from === fromUserId) {
          incomingOfferRef.current = { from: fromUserId, sdp };
          setIncomingOffer({ from: fromUserId, sdp });
          return;
        }
        
        console.log("[webrtc] incoming offer from", fromUserId);
        incomingOfferRef.current = { from: fromUserId, sdp };
        setIncomingOffer({ from: fromUserId, sdp });

        // 🔧 Only start ringing if call not already answered/connected
        if (!callAnsweredRef.current && !callConnectedRef.current) {
          setRinging(true);
          startRingtone();
          if (!pulseRef.current) pulseRef.current = setInterval(() => setPulse((p) => !p), 600);

          // Clear any existing timeout and set new one
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = setTimeout(() => {
            if (!callAnsweredRef.current && !callConnectedRef.current) {
              console.log("[webrtc] ring timeout reached - stopping ringing");
              stopAllRinging("offer timeout");
            }
          }, 30000);
        }
      } catch (err) {
        console.error("Failed handling incoming offer", err);
      }
    });

    const offAnswer = onAnswer(async ({ fromUserId, sdp }) => {
      try {
        console.log("[webrtc] answer received from", fromUserId);
        
        // 🔧 IMMEDIATELY mark as answered and stop ringing
        callAnsweredRef.current = true;
        stopAllRinging("answer received");

        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        if (pendingIceRef.current && pendingIceRef.current.length) {
          for (const c of pendingIceRef.current) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch {}
          }
          pendingIceRef.current = [];
        }
      } catch (err) {
        console.error("Failed applying answer", err);
      }
    });

    const offIce = onIceCandidate(async ({ fromUserId, candidate }) => {
      try {
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
          if (candidate) pendingIceRef.current.push(candidate);
          return;
        }
        if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Failed adding remote ICE", err);
      }
    });

    const offRing = onRing(({ fromUserId }) => {
      console.log("[webrtc] ring received from", fromUserId);
      
      // 🔧 Only ring if not already answered/connected
      if (!callAnsweredRef.current && !callConnectedRef.current) {
        setRinging(true);
        startRingtone();

        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = setTimeout(() => {
          if (!callAnsweredRef.current && !callConnectedRef.current) {
            console.log("[webrtc] ring timeout reached - stopping ringing");
            stopAllRinging("ring timeout");
          }
        }, 30000);

        if (!pulseRef.current) {
          pulseRef.current = setInterval(() => setPulse((p) => !p), 600);
        }
      }
    });

    const offCallStart = onCallStarted((p) => {
      try {
        const from = String(p.fromUserId || "").trim();
        if (!from) return;
        if (conversationId && String(p.conversationId || "") !== String(conversationId)) return;
        
        console.log("[webrtc] call started event received");
        receivedCallStartedRef.current = true;
        callConnectedRef.current = true;
        
        // 🔧 IMMEDIATE ringing stop when call starts
        stopAllRinging("call started");
      } catch {}
    });

    const offReject = onReject(({ fromUserId }) => {
      console.log("[webrtc] call rejected by", fromUserId);
      stopAllRinging("call rejected");
      Alert.alert("Call rejected", "The other user declined the call.");
      cleanup();
      try {
        if (onClose) onClose();
      } catch {}
      incomingOfferRef.current = null;
    });

    const offCallEnd = onCallEnded((p) => {
      try {
        if (!conversationId) return;
        if (String(p.conversationId || "") !== String(conversationId)) return;

        console.log("[webrtc] call ended event received");
        stopAllRinging("call ended");
        cleanup();
        try {
          if (onClose) onClose();
        } catch {}
        incomingOfferRef.current = null;
      } catch {}
    });

    return () => {
      offOffer();
      offAnswer();
      offIce();
      offRing && offRing();
      offCallStart && offCallStart();
      offReject && offReject();
      offCallEnd && offCallEnd();

      stopAllRinging("component unmounting");
    };
  }, [conversationId, initialRingingFrom, onClose]);

  useEffect(() => {
    if (callActive) {
      if (!callStartTime) setCallStartTime(Date.now());
      if (!elapsedRef.current) {
        elapsedRef.current = setInterval(() => {
          const start = callStartTime || Date.now();
          const sec = Math.floor((Date.now() - start) / 1000);
          const mm = Math.floor(sec / 60);
          const ss = sec % 60;
          setElapsed(`${mm}:${ss.toString().padStart(2, "0")}`);
        }, 1000);
      }
    } else {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
      setElapsed("0:00");
      setCallStartTime(null);
    }

    return () => {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    };
  }, [callActive, callStartTime]);

  function cleanup() {
    console.log("[webrtc] cleanup called");
    stopAllRinging("cleanup");
    
    // 🔧 Reset ALL state
    callAnsweredRef.current = false;
    callConnectedRef.current = false;
    callStartedSentRef.current = false;
    receivedCallStartedRef.current = false;
    acceptingRef.current = false;

    const pc = pcRef.current;
    if (pc) {
      try {
        pc.close();
      } catch {}
      pcRef.current = null;
    }

    const s = localStreamRef.current;
    if (s) {
      for (const t of s.getTracks()) t.stop();
      localStreamRef.current = null;
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCallActive(false);

    if (failTimerRef.current) {
      clearTimeout(failTimerRef.current);
      failTimerRef.current = null;
    }
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  }

  const startCall = async () => {
    if (Platform.OS !== "web") return Alert.alert("WebRTC is implemented for web only");
    if (!peerId) return Alert.alert("No peer selected");

    try {
      console.log("[webrtc] starting call to", peerId);
      
      // Test TURN connectivity first
      console.log("[webrtc] Testing TURN server connectivity...");
      
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          {
            urls: [
              "turn:100.51.157.166:3478",
              "turn:100.51.157.166:3478?transport=tcp",
            ],
            username: "skillbridge",
            credential: "skillbridge123",
          },
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      pcRef.current = pc;

      pc.ontrack = (ev) => {
        console.log("[webrtc][caller] ontrack", ev.streams);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
        if (!callStartTime) setCallStartTime(Date.now());
        callConnectedRef.current = true;
        stopAllRinging("media received");
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          const c = ev.candidate;
          console.log("[webrtc][caller] ICE candidate:", {
            type: c.type,
            protocol: c.protocol,
            address: c.address,
            port: c.port,
            relatedAddress: c.relatedAddress,
            relatedPort: c.relatedPort,
            candidate: c.candidate
          });
          sendIceCandidate(peerId, ev.candidate);
        } else {
          console.log("[webrtc][caller] ICE gathering complete");
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[webrtc][caller] connectionState", pc.connectionState);
        if (pc.connectionState === "connected") {
          callConnectedRef.current = true;
          stopAllRinging("connection established");
        }
        if (pc.connectionState === "disconnected") {
          if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = setTimeout(() => {
            console.warn("[webrtc][caller] connectionState remained disconnected -> hanging up");
            dumpPcStats("caller-disconnected");
            hangUp();
          }, 10000);
        }
        if (pc.connectionState === "failed") {
          if (failTimerRef.current) clearTimeout(failTimerRef.current);
          failTimerRef.current = setTimeout(() => {
            console.warn("[webrtc][caller] connectionState failed -> dumping stats and hanging up");
            dumpPcStats("caller-failed-before-hangup");
            hangUp();
          }, 3000);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[webrtc][caller] iceConnectionState", pc.iceConnectionState);
        if ((pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") && !callStartedSentRef.current) {
          callStartedSentRef.current = true;
          callConnectedRef.current = true;
          try {
            lastLocalCallStartedAtRef.current = Date.now();
            if (conversationId) sendCallStarted(conversationId, peerId);
          } catch {}
          stopAllRinging("ICE connected");
        }
        if (pc.iceConnectionState === "failed") {
          console.warn("[webrtc][caller] iceConnectionState failed -> dumping stats");
          dumpPcStats("caller-ice-failed");
        }
      };

      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      for (const track of localStream.getTracks()) pc.addTrack(track, localStream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendOffer(peerId, pc.localDescription);
      sendRing(peerId, conversationId);

      // Only start ringing if not already connected
      if (!callConnectedRef.current) {
        setRinging(true);
        startRingtone();

        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = setTimeout(() => {
          if (!callStartedSentRef.current && !receivedCallStartedRef.current && !callConnectedRef.current) {
            console.log("[webrtc] outgoing call timeout - stopping ringing");
            stopAllRinging("outgoing call timeout");
            cleanup();
          }
        }, 30000);

        if (!pulseRef.current) pulseRef.current = setInterval(() => setPulse((p) => !p), 600);
      }

      setCallActive(true);
    } catch (err) {
      console.error("Failed to start call", err);
      Alert.alert("Call failed", String(err));
    }
  };

  const hangUp = () => {
    console.log("[webrtc] hang up called");
    stopAllRinging("hang up");

    if (acceptingRef.current) {
      console.log("[webrtc][client] hangUp suppressed during accept");
      acceptingRef.current = false;
      return;
    }

    try {
      if (conversationId) {
        const start = callStartTime || Date.now();
        const durationSec = Math.floor((Date.now() - start) / 1000);
        console.log("[webrtc][client] sendCallEnded ->", { conversationId, to: peerId, durationSec });

        try {
          const lastStart = lastLocalCallStartedAtRef.current;
          if (lastStart && Date.now() - lastStart < 2000 && (!durationSec || durationSec < 2)) {
            console.warn("[webrtc][client] suppressing local sendCallEnded due to recent local call-start", { dt: Date.now() - lastStart, durationSec });
            lastLocalCallStartedAtRef.current = null;
            callStartedSentRef.current = false;
            return;
          }
        } catch {}

        try {
          dumpPcStats("hangup");
        } catch {}
        sendCallEnded(conversationId, peerId, durationSec);
      }
    } catch (e) {
      console.error("Failed sending call-end", e);
    }

    cleanup();
    try {
      if (onClose) onClose();
    } catch {}
  };

  if (Platform.OS !== "web") {
    return (
      <View>
        <Text>WebRTC call support is available on web only in this build.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8, position: 'relative' }}>
      <div style={{ display: "flex", gap: 8, position: "fixed", top: 80, left: 16, zIndex: 1000 }}>
        <video ref={localVideoRef as any} autoPlay muted playsInline style={{ width: 160, height: 120, backgroundColor: "#000", borderRadius: 8 }} />
        <video ref={remoteVideoRef as any} autoPlay playsInline style={{ width: 320, height: 240, backgroundColor: "#000", borderRadius: 8 }} />
      </div>

      {/* 🎨 FIXED POSITIONING: incoming call modal positioned at the very top */}
      {incomingOffer && (
        <div style={{ position: "fixed", left: 16, right: 16, top: 20, zIndex: 9999 }}>
          <div style={{ background: "#081025", padding: 12, borderRadius: 12, border: "1px solid #16324a", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: "#0ea5a4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#042f2e",
                  fontWeight: 800,
                  transform: pulse ? "scale(1.08)" : "scale(1)",
                  transition: "transform 0.25s",
                }}
              >
                {peerName ? peerName.charAt(0).toUpperCase() : "?"}
              </div>
              <div style={{ color: "#E2E8F0", fontWeight: 800 }}>
                {peerName ?? incomingOffer.from}
                <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Incoming call</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  try {
                    if (acceptingRef.current) return;
                    acceptingRef.current = true;
                    
                    console.log("[webrtc] accepting call");
                    
                    // 🔧 NUCLEAR OPTION: Stop everything immediately
                    callAnsweredRef.current = true;
                    callConnectedRef.current = true;
                    stopAllRinging("call accepted");

                    const from = incomingOffer.from;
                    const sdp = incomingOffer.sdp;
                    incomingOfferRef.current = null;
                    setIncomingOffer(null);

                    console.log("[webrtc] accepting call - creating peer connection");
                    
                    const pc = new RTCPeerConnection({
                      iceServers: [
                        { urls: "stun:stun.l.google.com:19302" },
                        { urls: "stun:stun1.l.google.com:19302" },
                        {
                          urls: [
                            "turn:100.51.157.166:3478",
                            "turn:100.51.157.166:3478?transport=tcp",
                          ],
                          username: "skillbridge",
                          credential: "skillbridge123",
                        },
                      ],
                      iceCandidatePoolSize: 10,
                      bundlePolicy: "max-bundle",
                      rtcpMuxPolicy: "require",
                    });
                    pcRef.current = pc;

                    pc.ontrack = (ev) => {
                      console.log("[webrtc][callee] ontrack", ev.streams);
                      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = ev.streams[0];
                      if (!callStartTime) setCallStartTime(Date.now());
                      stopAllRinging("media received");
                    };

                    pc.onicecandidate = (ev) => {
                      if (ev.candidate) {
                        const c = ev.candidate;
                        console.log("[webrtc][callee] ICE candidate:", {
                          type: c.type,
                          protocol: c.protocol,
                          address: c.address,
                          port: c.port,
                          relatedAddress: c.relatedAddress,
                          relatedPort: c.relatedPort,
                          candidate: c.candidate
                        });
                        sendIceCandidate(from, ev.candidate);
                      } else {
                        console.log("[webrtc][callee] ICE gathering complete");
                      }
                    };

                    pc.onconnectionstatechange = () => {
                      console.log("[webrtc][callee] connectionState", pc.connectionState);
                      if (pc.connectionState === "connected") {
                        if (!callStartTime) setCallStartTime(Date.now());
                        callConnectedRef.current = true;
                        stopAllRinging("connection established");
                      }
                      if (pc.connectionState === "failed") {
                        console.warn("[webrtc][callee] connectionState failed");
                        setTimeout(() => {
                          try {
                            dumpPcStats("callee-failed");
                          } catch {}
                          hangUp();
                        }, 2000);
                      }
                    };

                    pc.oniceconnectionstatechange = () => {
                      console.log("[webrtc][callee] iceConnectionState", pc.iceConnectionState);
                      if (pc.iceConnectionState === "failed") {
                        console.warn("[webrtc][callee] iceConnectionState failed -> dumping stats and hanging up");
                        try {
                          dumpPcStats("callee-ice-failed");
                        } catch {}
                        hangUp();
                      }

                      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                        stopAllRinging("ICE connected");
                      }
                    };

                    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

                    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                    localStreamRef.current = localStream;
                    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

                    for (const track of localStream.getTracks()) pc.addTrack(track, localStream);

                    if (pendingIceRef.current && pendingIceRef.current.length) {
                      for (const c of pendingIceRef.current) {
                        try {
                          await pc.addIceCandidate(new RTCIceCandidate(c));
                        } catch {}
                      }
                      pendingIceRef.current = [];
                    }

                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    sendAnswer(from, pc.localDescription);

                    // 🔧 Triple-check ringing is stopped
                    stopAllRinging("answer sent");

                    setCallActive(true);
                    acceptingRef.current = false;
                  } catch (e) {
                    console.error("Failed to accept call", e);
                    acceptingRef.current = false;
                    callAnsweredRef.current = false;
                    callConnectedRef.current = false;
                  }
                }}
                style={{ padding: "8px 12px", background: "#10B981", color: "#fff", borderRadius: 8, border: "none" }}
              >
                Accept
              </button>
              <button
                onClick={() => {
                  try {
                    const from = incomingOffer.from;
                    console.log("[webrtc][client] sendReject ->", from);
                    sendReject(from);
                  } catch {}
                  incomingOfferRef.current = null;
                  setIncomingOffer(null);
                  stopAllRinging("call rejected");
                  try {
                    if (onClose) onClose();
                  } catch {}
                }}
                style={{ padding: "8px 12px", background: "#EF4444", color: "#fff", borderRadius: 8, border: "none" }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {needsAudioUnlock && (
        <div style={{ position: "absolute", left: 16, bottom: 120 }}>
          <div style={{ background: "#081025", padding: 10, borderRadius: 10, border: "1px solid #16324a" }}>
            <div style={{ color: "#E2E8F0", marginBottom: 8 }}>Enable sound to hear the ringtone</div>
            <button
              onClick={() => {
                try {
                  setNeedsAudioUnlock(false);
                  if (!callAnsweredRef.current && !callConnectedRef.current) {
                    setRinging(true);
                    startRingtone();
                    if (!pulseRef.current) pulseRef.current = setInterval(() => setPulse((p) => !p), 600);
                  }
                } catch (e) {
                  console.error("Failed enabling sound", e);
                }
              }}
              style={{ padding: "6px 10px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8 }}
            >
              Enable sound
            </button>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: "auto", top: 250, left: 16, zIndex: 1000 }}>
        <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <Button title={ringing ? "Ringing…" : callActive ? "In Call" : "Start Call"} onPress={startCall} disabled={callActive || ringing} />
          <Button title={callActive || ringing ? "Hang Up" : "Close"} onPress={hangUp} color="#c33" />
        </div>
        {callActive && (
          <div style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600 }}>
            Duration {elapsed}
          </div>
        )}
      </div>
    </View>
  );
}
