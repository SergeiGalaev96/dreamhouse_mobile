import { useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AuthContext } from "../auth/AuthContext";
import { socketFallbackURLs } from "../api/axios";
import { SocketContext } from "./socket-context";
import { getAuthToken } from "../utils/authStorage";

const registerSocketUser = (socket, userId) => {
  socket.emit("register", userId, (response) => {
    console.log("socket register", response);
  });
};

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;

    const token = getAuthToken();
    if (!token) return;

    const urls = socketFallbackURLs();
    let disposed = false;
    let activeSocket = null;

    const connectSocket = (urlIndex = 0) => {
      const socketUrl = urls[urlIndex];

      if (!socketUrl) {
        console.error("socket connect error: no more fallback URLs", urls);
        return;
      }

      console.log("socket connecting", socketUrl);

      const nextSocket = io(socketUrl, {
        auth: { token },
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 2,
        timeout: 5000
      });

      activeSocket = nextSocket;

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSocket(nextSocket);

      nextSocket.on("connect", () => {
        console.log("socket connected", socketUrl, nextSocket.id);

        registerSocketUser(nextSocket, user.id);
        setConnected(true);
      });

      nextSocket.on("connect_error", (error) => {
        console.error("socket connect error", socketUrl, error.message);

        if (!disposed && !nextSocket.connected && urls[urlIndex + 1]) {
          console.warn("socket fallback", urls[urlIndex + 1]);
          nextSocket.disconnect();
          connectSocket(urlIndex + 1);
        }
      });

      nextSocket.on("disconnect", (reason) => {
        console.log("socket disconnected", socketUrl, reason);
        setConnected(false);
      });
    };

    connectSocket();

    return () => {
      disposed = true;
      activeSocket?.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
