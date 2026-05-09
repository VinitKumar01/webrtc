"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type message = {
  type: "sender" | "receiver" | "createOffer" | "createAnswer" | "iceCandidate";
  candidate?: string;
  sdp?: string;
};

export default function SenderPage() {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const ws: WebSocket = new WebSocket("ws://localhost:8080");
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
      if (video) video.srcObject = null;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "sender" } as message));
    };
  }, [socket]);

  const getCameraStreamAndSend = useCallback((pc: RTCPeerConnection) => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    });
  }, []);

  const initiateConnection = useCallback(() => {
    if (!socket) {
      console.warn("Socket is possibly null");
      return;
    }

    const peerConnection = new RTCPeerConnection();
    pcRef.current = peerConnection;

    peerConnection.onicecandidate = (evt) => {
      if (evt.candidate) {
        socket.send(
          JSON.stringify({ type: "iceCandidate", candidate: evt.candidate }),
        );
      }
    };

    peerConnection.onnegotiationneeded = async () => {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.send(
        JSON.stringify({
          type: "createOffer",
          sdp: peerConnection.localDescription,
        }),
      );
    };

    socket.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        if (msg.type === "createAnswer" && msg.sdp) {
          await peerConnection.setRemoteDescription(msg.sdp);
        } else if (msg.type === "iceCandidate" && msg.candidate) {
          await peerConnection.addIceCandidate(msg.candidate);
        }
      } catch (err) {
        console.warn("Response is not JSON", err);
      }
    };

    getCameraStreamAndSend(peerConnection);
  }, [socket, getCameraStreamAndSend]);

  return (
    <div className="h-full w-full flex flex-col justify-center items-center">
      <button onClick={initiateConnection}>Send Data</button>
      <video ref={videoRef} muted autoPlay playsInline></video>
    </div>
  );
}
