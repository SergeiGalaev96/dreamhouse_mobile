import { createContext, useState, useEffect } from "react";
import { getRequest } from "../api/request";
import {
  clearBiometricToken,
  getAuthToken,
  removeAuthToken,
  saveBiometricToken,
  setAuthToken,
  unlockBiometricToken
} from "../utils/authStorage";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = (userData, token) => {

    setAuthToken(token);
    saveBiometricToken(token).catch((error) => {
      console.warn("biometric token save failed", error);
    });
    setUser(userData);

  };

  const logout = async () => {

    removeAuthToken();
    await clearBiometricToken();
    setUser(null);

    window.location.href = "/login";

  };

  const loginWithBiometrics = async () => {

    await unlockBiometricToken();
    const res = await getRequest("/auth/profile");

    if (!res.success) {
      throw new Error(res.message || "Profile restore failed");
    }

    setUser(res.data);
    return res.data;

  };

  const loadProfile = async () => {

    const token = getAuthToken();

    if (!token) {
      setLoading(false);
      return;
    }

    try {

      const res = await getRequest("/auth/profile");

      if (res.success) {
        setUser(res.data);
      }

    } catch (e) {
      console.log("Auth restore failed");
      removeAuthToken();
    }

    setLoading(false);

  };

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, loginWithBiometrics, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );

};
