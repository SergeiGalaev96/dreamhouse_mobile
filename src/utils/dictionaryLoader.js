import { getRequest } from "../api/request";
import { DictionaryConfig } from "../config/dictionaries";

export const loadDictionaries = async (list) => {

  const result = {};

  for (const dictName of list) {

    const config = DictionaryConfig[dictName];

    if (!config) {
      console.warn("Dictionary not found:", dictName);
      continue;
    }

    try {

      const res = await getRequest(config.url);

      if (res.success) {
        result[dictName] = res.data.map(config.map);
      }

    } catch (e) {
      console.error("Dictionary load error:", dictName, e);
    }

  }

  return result;
};