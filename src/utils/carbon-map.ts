/** US22 — shared types and colour scale for the Carbon Map (used by the map screen and the map view). */

/** One area as returned by GET /api/features/carbon-map. */
export type MapArea = {
  latitude: number; // centre of the area's grid square
  longitude: number;
  people: number;
  totalKg: number;
  averageKgPerPerson: number;
};

/** Stable id for an area: its centre, e.g. "24.85:67.05". */
export const areaKey = (a: Pick<MapArea, "latitude" | "longitude">) => `${a.latitude}:${a.longitude}`;

/** Colour bands for the estimated average kg CO₂e per person over the map window. */
export const LEVELS = [
  { label: "Low", max: 25, color: "#2E7D32", range: "under 25 kg", short: "<25" },
  { label: "Medium", max: 75, color: "#F9A825", range: "25–75 kg", short: "25–75" },
  { label: "High", max: Infinity, color: "#C62828", range: "over 75 kg", short: ">75" },
] as const;

export function levelFor(averageKg: number) {
  return LEVELS.find((l) => averageKg < l.max) ?? LEVELS[LEVELS.length - 1];
}

/** "24.85°N, 67.05°E" */
export function formatCoords(a: Pick<MapArea, "latitude" | "longitude">) {
  const lat = `${Math.abs(a.latitude).toFixed(2)}°${a.latitude >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(a.longitude).toFixed(2)}°${a.longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lng}`;
}
