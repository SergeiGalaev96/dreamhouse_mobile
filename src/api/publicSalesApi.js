import axios from "axios";
import { baseURL } from "./axios";

const PUBLIC_SALES_TOKEN_KEY = "dreamhouse_public_sales_token";

export const getPublicSalesToken = () =>
  localStorage.getItem(PUBLIC_SALES_TOKEN_KEY) || import.meta.env.VITE_PUBLIC_SALES_TOKEN || "";

export const setPublicSalesToken = (token) => {
  const normalized = String(token || "").trim();
  if (normalized) {
    localStorage.setItem(PUBLIC_SALES_TOKEN_KEY, normalized);
  } else {
    localStorage.removeItem(PUBLIC_SALES_TOKEN_KEY);
  }
};

const publicSalesApi = axios.create({
  baseURL: baseURL(),
  timeout: 10000
});

publicSalesApi.interceptors.request.use((config) => {
  const token = getPublicSalesToken();
  if (token) {
    config.headers["X-Public-Sales-Token"] = token;
  }
  return config;
});

export const publicSalesGet = async (url, params = {}) => {
  const res = await publicSalesApi.get(url, { params });
  return res.data;
};

export const publicSalesPost = async (url, payload = {}) => {
  const res = await publicSalesApi.post(url, payload);
  return res.data;
};

export const publicSalesGetText = async (url) => {
  const res = await publicSalesApi.get(url, {
    responseType: "text",
    transformResponse: [(data) => data]
  });
  return res.data;
};

export const publicSalesFileUrl = (url) => {
  if (!url) return "";
  const token = getPublicSalesToken();
  const appendToken = (value) => {
    if (!token) return value;
    const separator = String(value).includes("?") ? "&" : "?";
    return `${value}${separator}token=${encodeURIComponent(token)}`;
  };

  if (/^https?:\/\//i.test(url)) return appendToken(url);
  const normalizedBase = String(baseURL() || "").replace(/\/$/, "");
  const normalizedPath = String(url).startsWith("/") ? url : `/${url}`;
  return appendToken(`${normalizedBase}${normalizedPath}`);
};

export default publicSalesApi;
