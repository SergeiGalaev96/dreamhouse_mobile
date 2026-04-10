import Router from "./router/router";
import { AuthProvider } from "./auth/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { PushNotificationsProvider } from "./context/PushNotificationsProvider";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { Toaster } from "react-hot-toast";

function AppContent() {
  const { isDark } = useTheme();

  return (
    <div className={isDark ? "dark" : ""}>
      <div className={isDark ? "min-h-screen bg-gray-950 text-white" : "min-h-screen bg-slate-50 text-gray-900"}>
        <AuthProvider>
          <PushNotificationsProvider>
            <SocketProvider>
              <Router />
              <Toaster position="top-center" />
            </SocketProvider>
          </PushNotificationsProvider>
        </AuthProvider>
      </div>
    </div>
  );
}

function App() {

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );

}

export default App;
