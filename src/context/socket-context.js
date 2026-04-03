import { createContext } from "react";

export const SocketContext = createContext({
  socket: null,
  connected: false
});
