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
          console.warn("Sender can't create an offer");
          return;
        }
        receiverSocket?.send(
          JSON.stringify({ type: "createOffer", sdp: msg.sdp } as message),
        );
      } else if (msg.type === "createAnswer") {
        if (ws !== receiverSocket) {
          console.warn("Receiver can't create an answer");
          return;
        }
        senderSocket?.send(
          JSON.stringify({ type: "createAnswer", sdp: msg.sdp } as message),
        );
      } else if ((msg.type = "iceCandidate")) {
        if (ws === senderSocket) {
          receiverSocket?.send(
            JSON.stringify({
              type: "iceCandidate",
              candidate: msg.candidate,
            } as message),
          );
        } else if (ws === receiverSocket) {
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
  });
});
