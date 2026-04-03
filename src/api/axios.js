import axios from "axios";

const isDev = window.location.hostname === "192.168.2.112" || window.location.hostname === "localhost";

const API_URL = isDev
  ? "http://192.168.2.112:3300/api"
  : "http://77.235.27.71:4000/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

api.interceptors.request.use((config) => {

  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;

});

console.log("API URL:", API_URL);

export const baseURL = () => api.defaults.baseURL;
export const socketURL = () => {
  const currentBaseURL = baseURL();

  if (!currentBaseURL) return "";

  return new URL(currentBaseURL).origin;
};

export default api;
