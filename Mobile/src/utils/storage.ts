import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

function canUseSecureStore(): boolean {
  return Platform.OS !== "web";
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (!canUseSecureStore()) {
      return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
    return null;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (!canUseSecureStore()) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (!canUseSecureStore()) {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  }
}

export async function clearSecureItems(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => deleteSecureItem(key)));
}
