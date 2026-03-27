import Router from "./router/router";
import { AuthProvider } from "./auth/AuthContext";
import { Toaster } from "react-hot-toast";

function App() {

  return (
    <AuthProvider>
      <Router />
      <Toaster position="top-center" />
    </AuthProvider>
  );

}

export default App;