import Router from "./router/router";
import { AuthProvider } from "./auth/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { Toaster } from "react-hot-toast";

function App() {

  return (
    <AuthProvider>
      <SocketProvider>
        <Router />
        <Toaster position="top-center" />
      </SocketProvider>
    </AuthProvider>
  );

}

export default App;