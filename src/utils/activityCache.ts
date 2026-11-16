import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "carbontrail_activity_cache";
const MAX_CACHED = 200;

/**
 * Last known activities from the server. Used so the history still renders
 * when the app starts without a connection (previously the screen just went
 * empty, which looked like the offline entry had been lost).
 */
export type CachedActivity = {
  id: string;
  activityId: string;
  distance: number;
  unit: string;
  note: string | null;
  createdAt: string;
  emission: number;
};

export async function cacheActivities(
  activities: CachedActivity[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify(activities.slice(0, MAX_CACHED))
    );
  } catch (error) {
    console.error("Error caching activities:", error);
  }
}

export async function getCachedActivities(): Promise<CachedActivity[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CachedActivity[]) : [];
  } catch (error) {
    console.error("Error reading activity cache:", error);
    return [];
  }
}
