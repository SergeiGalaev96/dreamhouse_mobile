import { useContext, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { AuthContext } from "../auth/AuthContext";
import { postRequest } from "../api/request";

export const PushNotificationsProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const registeredTokenRef = useRef(null);

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) return;

    let mounted = true;
    let listeners = [];

    const registerPushNotifications = async () => {
      try {
        const permission = await PushNotifications.requestPermissions();

        if (permission.receive !== "granted") {
          console.warn("push permission not granted", permission);
          return;
        }

        const registrationListener = await PushNotifications.addListener("registration", async (token) => {
          if (!mounted || !token?.value || registeredTokenRef.current === token.value) return;

          registeredTokenRef.current = token.value;

          await postRequest("/pushTokens/register", {
            token: token.value,
            platform: Capacitor.getPlatform()
          });

          console.log("push token registered");
        });

        const errorListener = await PushNotifications.addListener("registrationError", (error) => {
          console.error("push registration error", error);
        });

        const receivedListener = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("push received", notification);
        });

        const actionListener = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          console.log("push action", action);
        });

        listeners = [
          registrationListener,
          errorListener,
          receivedListener,
          actionListener
        ];

        await PushNotifications.register();
      } catch (error) {
        console.error("push setup error", error);
      }
    };

    registerPushNotifications();

    return () => {
      mounted = false;
      listeners.forEach(listener => listener.remove());
    };
  }, [user]);

  return children;
};
