import api from "./axios";
import { getAuthToken } from "../utils/authStorage";

const getAuthHeaders = () => {
  const token = getAuthToken();

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
};

export const getRequest = async (url, params = {}) => {

  const res = await api.get(url, {
    params,
    headers: getAuthHeaders()
  });

  return res.data;

};

export const postRequest = async (url, payload = {}) => {

  const res = await api.post(url, payload, {
    headers: getAuthHeaders()
  });

  return res.data;

};

export const putRequest = async (url, payload = {}) => {

  const res = await api.put(url, payload, {
    headers: getAuthHeaders()
  });

  return res.data;

};

export const deleteRequest = async (url) => {

  const res = await api.delete(url, {
    headers: getAuthHeaders()
  });

  return res.data;

};
