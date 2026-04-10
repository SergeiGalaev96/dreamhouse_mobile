import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "capacitor-native-biometric";

const TOKEN_KEY = "token";
const BIOMETRIC_ENABLED_KEY = "biometric_login_enabled";
const BIOMETRIC_SERVER = "dreamhouse-auth";
const BIOMETRIC_USERNAME = "dreamhouse-token";

export const isNativeAuth = () => Capacitor.isNativePlatform();

export const getAuthToken = () => {
  return isNativeAuth()
    ? sessionStorage.getItem(TOKEN_KEY)
    : localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token) => {
  if (!token) return;

  if (isNativeAuth()) {
    sessionStorage.setItem(TOKEN_KEY, token);
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
};

export const removeAuthToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

export const isBiometricLoginEnabled = () => {
  return isNativeAuth() && localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";
};

export const isBiometricAvailable = async () => {
  if (!isNativeAuth()) return false;

  try {
    const result = await NativeBiometric.isAvailable();
    return Boolean(result?.isAvailable);
  } catch (error) {
    console.warn("biometric availability error", error);
    return false;
  }
};

export const saveBiometricToken = async (token) => {
  if (!token || !isNativeAuth()) return;

  if (isBiometricLoginEnabled()) {
    await NativeBiometric.setCredentials({
      username: BIOMETRIC_USERNAME,
      password: token,
      server: BIOMETRIC_SERVER
    });
    return;
  }

  const available = await isBiometricAvailable();
  if (!available) return;

  await NativeBiometric.verifyIdentity({
    title: "\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0432\u0445\u043e\u0434 \u043f\u043e \u0431\u0438\u043e\u043c\u0435\u0442\u0440\u0438\u0438",
    subtitle: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043b\u0438\u0447\u043d\u043e\u0441\u0442\u044c",
    description: "\u0412 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0440\u0430\u0437 \u043c\u043e\u0436\u043d\u043e \u0431\u0443\u0434\u0435\u0442 \u0432\u043e\u0439\u0442\u0438 \u0431\u0435\u0437 \u043f\u0430\u0440\u043e\u043b\u044f",
    reason: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u0430",
    useFallback: true,
    maxAttempts: 3
  });

  await NativeBiometric.setCredentials({
    username: BIOMETRIC_USERNAME,
    password: token,
    server: BIOMETRIC_SERVER
  });

  localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
};

export const unlockBiometricToken = async () => {
  if (!isBiometricLoginEnabled()) {
    throw new Error("Biometric login is not enabled");
  }

  await NativeBiometric.verifyIdentity({
    title: "\u0412\u0445\u043e\u0434 \u0432 DreamHouse",
    subtitle: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043b\u0438\u0447\u043d\u043e\u0441\u0442\u044c",
    description: "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0431\u0438\u043e\u043c\u0435\u0442\u0440\u0438\u044e \u0438\u043b\u0438 \u043a\u043e\u0434 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430",
    reason: "\u0412\u0445\u043e\u0434 \u0432 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435",
    useFallback: true,
    maxAttempts: 3
  });

  const credentials = await NativeBiometric.getCredentials({
    server: BIOMETRIC_SERVER
  });

  if (!credentials?.password) {
    throw new Error("Saved token was not found");
  }

  setAuthToken(credentials.password);
  return credentials.password;
};

export const clearBiometricToken = async () => {
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);

  if (!isNativeAuth()) return;

  try {
    await NativeBiometric.deleteCredentials({
      server: BIOMETRIC_SERVER
    });
  } catch (error) {
    console.warn("biometric credentials cleanup error", error);
  }
};
