import { createContext, useState, useEffect } from "react";
import { getRequest } from "../api/request";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = (userData, token) => {

    localStorage.setItem("token", token);
    setUser(userData);

  };

  const logout = () => {

    localStorage.removeItem("token");
    setUser(null);

    window.location.href = "/login";

  };

  const loadProfile = async () => {

    const token = localStorage.getItem("token");

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
      localStorage.removeItem("token");
    }

    setLoading(false);

  };

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );

};