import axios from "axios";
import { getAuthToken } from "../utils/authStorage";
import { Capacitor } from "@capacitor/core";

const LOCAL_API_URL = "http://192.168.2.112:3300/api";
const EXTERNAL_API_URL = "http://77.235.27.71:4000/api";
const LOCAL_REPORTS_URL = "http://192.168.2.112:8080";
const EXTERNAL_REPORTS_URL = "http://77.235.27.71:8080";

const isNative = Capacitor.isNativePlatform();
const isDev = !isNative && (
  window.location.hostname === "192.168.2.112" || window.location.hostname === "localhost"
);

const API_URL = import.meta.env.VITE_API_URL || (
  isDev
    ? LOCAL_API_URL
    : EXTERNAL_API_URL
);

const API_FALLBACK_URLS = [API_URL].filter(Boolean);

const REPORTS_URL = import.meta.env.VITE_REPORTS_URL || (
  isDev
    ? LOCAL_REPORTS_URL
    : EXTERNAL_REPORTS_URL
);

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000
});

api.interceptors.request.use((config) => {

  const token = getAuthToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;

});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = error.config;

    if (error.response || !originalConfig) {
      return Promise.reject(error);
    }

    const currentBaseURL = originalConfig.baseURL || api.defaults.baseURL;
    const currentIndex = API_FALLBACK_URLS.indexOf(currentBaseURL);
    const nextIndex = (originalConfig._apiFallbackIndex ?? currentIndex) + 1;
    const nextBaseURL = API_FALLBACK_URLS[nextIndex];

    if (!nextBaseURL) {
      return Promise.reject(error);
    }

    console.warn(`API unavailable: ${currentBaseURL}. Retrying with ${nextBaseURL}`);

    api.defaults.baseURL = nextBaseURL;
    originalConfig.baseURL = nextBaseURL;
    originalConfig._apiFallbackIndex = nextIndex;

    return api.request(originalConfig);
  }
);

console.log("API URL:", API_URL);

export const baseURL = () => api.defaults.baseURL;
export const reportsURL = () => REPORTS_URL;
export const reportsFallbackURLs = () => {
  const currentBaseURL = baseURL();
  const currentReportsURL = currentBaseURL
    ? `${new URL(currentBaseURL).protocol}//${new URL(currentBaseURL).hostname}:8080`
    : "";

  return [
    currentReportsURL,
    REPORTS_URL
  ].filter((url, index, list) => url && list.indexOf(url) === index);
};
export const socketFallbackURLs = () => {
  const currentSocketURL = new URL(baseURL()).origin;
  const urls = API_FALLBACK_URLS.map(url => new URL(url).origin);

  return [
    currentSocketURL,
    ...urls
  ].filter((url, index, list) => url && list.indexOf(url) === index);
};
export const socketURL = () => {
  const currentBaseURL = baseURL();

  if (!currentBaseURL) return "";

  return new URL(currentBaseURL).origin;
};

export default api;
