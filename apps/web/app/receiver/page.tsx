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

      if (video) {
        video.srcObject = null;
      }
    };
  }, []);

  const startReceiving = useCallback(() => {
    if (!socket) {
      console.warn("Socket is not connected.");
      return;
    }

    if (pcRef.current) {
      return;
    }

    const peerConnection = new RTCPeerConnection();
    pcRef.current = peerConnection;

    peerConnection.ontrack = (event) => {
      if (!videoRef.current) {
        console.warn("Video element not found.");
        return;
      }

      if (event.streams[0] !== undefined) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

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

    socket.onmessage = async (event) => {
      try {
        const message: Message = JSON.parse(event.data);

        switch (message.type) {
          case "createOffer": {
            await peerConnection.setRemoteDescription(message.sdp);

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            if (socket.readyState === WebSocket.OPEN) {
              socket.send(
                JSON.stringify({
                  type: "createAnswer",
                  sdp: peerConnection.localDescription!,
                } satisfies Message),
              );
            }

            break;
          }

          case "iceCandidate":
            await peerConnection.addIceCandidate(message.candidate);
            break;
        }
      } catch (err) {
        console.error(err);
      }
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    socket.onopen = () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "receiver",
          } satisfies Message),
        );

        startReceiving();
      }
    };
  }, [socket, startReceiving]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <video ref={videoRef} autoPlay playsInline className="max-w-full" />
    </div>
  );
}
