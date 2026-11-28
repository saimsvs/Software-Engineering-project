import * as Location from "expo-location";
import { apiFetch } from "@/utils/api";

/** Must match AREA_STEP in backend/src/routes/features.ts (0.1° ≈ an 11 km square). */
const AREA_STEP = 0.1;

export type Area = { latitude: number; longitude: number; sizeKm: number };

/** Snap a coordinate to the centre of its grid cell, so the exact position never leaves the phone. */
function snapToArea(value: number) {
  const cell = Math.floor(value / AREA_STEP);
  return Math.round((cell * AREA_STEP + AREA_STEP / 2) * 100) / 100;
}

/** Ask the OS for "while using the app" location permission. Returns true if granted. */
export async function askLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Location.requestForegroundPermissionsAsync();
  return asked.granted;
}

/**
 * Read the phone's position at low accuracy (about 1 km), round it to its map
 * area and send only that area to the server. Only call this after the user
 * has turned on location sharing and granted permission.
 */
export async function contributeArea(): Promise<Area> {
  const granted = (await Location.getForegroundPermissionsAsync()).granted;
  if (!granted) throw new Error("PERMISSION");

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  const response = await apiFetch("/api/features/location", {
    method: "POST",
    body: JSON.stringify({
      latitude: snapToArea(position.coords.latitude),
      longitude: snapToArea(position.coords.longitude),
    }),
  });
  if (!response.ok) throw new Error("SERVER");
  return (await response.json()).area;
}

/**
 * US22 "you are here": the phone's own position, for the blue dot on the map.
 * Never asks for permission (returns null unless it was already given) and is
 * never sent anywhere — it only lives on this phone while the map is open.
 */
export async function getMyPositionIfAllowed(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted) return null;
    // A recent cached fix is instant; otherwise ask the phone for a fresh one.
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null; // location turned off, timed out, etc. — just don't show the dot
  }
}

/** "24.85°N, 67.05°E" */
export function formatArea(a: Area) {
  const lat = `${Math.abs(a.latitude).toFixed(2)}°${a.latitude >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(a.longitude).toFixed(2)}°${a.longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lng}`;
}
