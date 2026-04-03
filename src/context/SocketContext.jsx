import { useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AuthContext } from "../auth/AuthContext";
import { socketURL } from "../api/axios";
import { SocketContext } from "./socket-context";

export const SocketProvider = ({ children }) => {

  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const nextSocket = io(socketURL(), {
      auth: { token },
      transports: ["websocket"]
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(nextSocket);

    nextSocket.on("connect", () => {
      console.log("🟢 socket connected", nextSocket.id);

      nextSocket.emit("register", user.id);
      setConnected(true);
    });

    nextSocket.on("disconnect", () => {
      setConnected(false);
    });

    return () => {
      nextSocket.disconnect();
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
