import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "carbontrail_token";

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
