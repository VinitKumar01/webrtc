"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export default function ReceiverPage() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

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
      if (video) video.srcObject = null;
    };
  }, []);

  const startReceiving = useCallback(() => {
    if (!socket) {
      console.warn("Socket is possibly null");
      return;
    }

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.ontrack = (event) => {
      if (!videoRef.current) {
        console.warn("Video element not found");
        return;
      }
      videoRef.current.srcObject = event.streams[0] as MediaStream;
    };

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        socket.send(
          JSON.stringify({ type: "iceCandidate", candidate: evt.candidate }),
        );
      }
    };

    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "createOffer") {
        await pc.setRemoteDescription(message.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.send(
          JSON.stringify({
            type: "createAnswer",
            sdp: answer,
          }),
        );
      } else if (message.type === "iceCandidate") {
        await pc.addIceCandidate(message.candidate);
      }
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "receiver" }));
      startReceiving();
    };
  }, [socket, startReceiving]);

  return (
    <div className="h-full w-full flex flex-col justify-center items-center">
      <video ref={videoRef} autoPlay playsInline></video>
    </div>
  );
}
