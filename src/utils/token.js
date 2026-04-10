import { getAuthToken, removeAuthToken, setAuthToken } from "./authStorage";

export const setToken = setAuthToken;

export const getToken = getAuthToken;

export const removeToken = removeAuthToken;
