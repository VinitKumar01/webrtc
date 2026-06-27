import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

let senderSocket: null | WebSocket = null;
let receiverSocket: null | WebSocket = null;

type message = {
  type: "sender" | "receiver" | "createOffer" | "createAnswer" | "iceCandidate";
  candidate?: string;
  sdp?: string;
};

wss.on("connection", (ws) => {
  ws.on("error", (err) => {
    console.error(err);
  });

  ws.on("message", (data) => {
    try {
      const msg: message = JSON.parse(data.toString());

      if (msg.type === "sender") {
        senderSocket = ws;
      } else if (msg.type === "receiver") {
        receiverSocket = ws;
      } else if (msg.type === "createOffer") {
        if (ws !== senderSocket) {
          console.warn("Only the sender can create an offer");
          return;
        }
        if (receiverSocket?.readyState === WebSocket.OPEN) {
          receiverSocket?.send(
            JSON.stringify({ type: "createOffer", sdp: msg.sdp } as message),
          );
        }
      } else if (msg.type === "createAnswer") {
        if (ws !== receiverSocket) {
          console.warn("Only the receiver can create an answer");
          return;
        }
        if (!msg.sdp) {
          console.warn("Missing SDP!");
          return;
        }
        if (senderSocket?.readyState === WebSocket.OPEN) {
          senderSocket?.send(
            JSON.stringify({ type: "createAnswer", sdp: msg.sdp } as message),
          );
        }
      } else if (msg.type === "iceCandidate") {
        if (!msg.candidate) {
          console.warn("Missing candidate!");
          return;
        }
        if (ws === senderSocket) {
          receiverSocket?.readyState === WebSocket.OPEN &&
            receiverSocket?.send(
              JSON.stringify({
                type: "iceCandidate",
                candidate: msg.candidate,
              } as message),
            );
        } else if (ws === receiverSocket) {
          senderSocket?.readyState === WebSocket.OPEN &&
            senderSocket?.send(
              JSON.stringify({
                type: "iceCandidate",
                candidate: msg.candidate,
              } as message),
            );
        }
      }
    } catch (err) {
      console.log("Invalid JSON", err);
    }
    ws.on("close", () => {
      if (ws === senderSocket) senderSocket = null;
      if (ws === receiverSocket) receiverSocket = null;
    });
  });
});
