"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Message =
  | {
      type: "sender" | "receiver";
    }
  | {
      type: "createOffer" | "createAnswer";
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: "iceCandidate";
      candidate: RTCIceCandidateInit;
    };

export default function SenderPage() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    return () => {
      pcRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (video) {
        video.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.onopen = () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "sender",
          } satisfies Message),
        );
      }
    };
  }, [socket]);

  const getCameraStreamAndSend = useCallback(async (pc: RTCPeerConnection) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
  }, []);

  const initiateConnection = useCallback(async () => {
    if (!socket) {
      console.warn("Socket is not connected.");
      return;
    }

    if (pcRef.current) {
      return;
    }

    const peerConnection = new RTCPeerConnection();
    pcRef.current = peerConnection;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "iceCandidate",
            candidate: event.candidate.toJSON(),
          } satisfies Message),
        );
      }
    };

    peerConnection.onnegotiationneeded = async () => {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "createOffer",
            sdp: peerConnection.localDescription!,
          } satisfies Message),
        );
      }
    };

    socket.onmessage = async (event) => {
      try {
        const msg: Message = JSON.parse(event.data);

        switch (msg.type) {
          case "createAnswer":
            await peerConnection.setRemoteDescription(msg.sdp);
            break;

          case "iceCandidate":
            await peerConnection.addIceCandidate(msg.candidate);
            break;
        }
      } catch (err) {
        console.error(err);
      }
    };

    try {
      await getCameraStreamAndSend(peerConnection);
      setIsConnecting(true);
    } catch (err) {
      console.error("Failed to access camera:", err);
      peerConnection.close();
      pcRef.current = null;
    }
  }, [socket, getCameraStreamAndSend]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      {!isConnecting && <button onClick={initiateConnection}>Send Data</button>}

      <video ref={videoRef} autoPlay playsInline muted className="mt-4" />
    </div>
  );
}
