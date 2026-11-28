"use dom";

/**
 * US22 — the interactive Carbon Map (Leaflet + OpenStreetMap, no API key).
 *
 * This is an Expo DOM component: on Android/iOS it runs inside a web view, and
 * on web it renders as a normal part of the page. It only ever receives area
 * totals (grid-square centres + numbers) — never users or exact locations — and
 * draws each area as a soft circle with its average, so it reads as an area, not a spot.
 */
// Leaflet needs a real browser `window`, so it is loaded only once the map is on
// screen (Expo also pre-renders web pages on the server, where there is none).
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { areaKey, levelFor, type MapArea } from "@/utils/carbon-map";

type Props = {
  areas: MapArea[];
  /** Grid size in degrees (from the API), e.g. 0.1. */
  areaStep: number;
  selectedKey: string | null;
  /** Called when the user taps an area (native action: must be async). */
  onSelect: (key: string | null) => Promise<void>;
  /** Changes when the screen's "show all areas" button is pressed. */
  recenter: number;
  dom?: import("expo/dom").DOMProps;
};

/** Where the map starts when there are no areas yet (Karachi). */
const DEFAULT_CENTER: Leaflet.LatLngTuple = [24.86, 67.01];

/** Space kept clear for the floating cards when zooming to fit: [left/right, top] and [left/right, bottom]. */
const FIT_PADDING_TOP_LEFT: Leaflet.PointTuple = [24, 150];
const FIT_PADDING_BOTTOM_RIGHT: Leaflet.PointTuple = [24, 190];

export default function CarbonMapView({ areas, areaStep, selectedKey, onSelect, recenter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const fittedRef = useRef(false);
  const boundsRef = useRef<Leaflet.LatLngBounds | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Required here, not at the top of the file: effects never run during the
    // server pre-render, so Leaflet only loads in a real browser / web view.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet") as typeof Leaflet;
    leafletRef.current = L;
    // No zoom buttons (pinch / scroll / double-tap zoom instead) and no corner
    // credit: the screen shows "Map data © OpenStreetMap contributors" in its
    // "How this map works" panel, which keeps the map clean.
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).setView(DEFAULT_CENTER, 10);
    // Free OpenStreetMap tiles (no API key), softened to light grey so the
    // coloured areas stand out instead of competing with roads and labels.
    const base = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 15, // past this the ~11 km areas stop being useful
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    base.getContainer()!.style.filter = "grayscale(0.75) brightness(1.04) contrast(0.92)";
    layerRef.current = L.layerGroup().addTo(map);
    // Tapping empty map clears the selection.
    map.on("click", () => void onSelectRef.current(null));
    mapRef.current = map;
    // The container can get its size after mount (tabs, web view): re-measure.
    const t = setTimeout(() => map.invalidateSize(), 200);
    setReady(true);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw (or redraw) one soft circle + value label per area whenever the data or selection changes.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();

    const half = areaStep / 2;
    // Circle radius in metres: 1° of latitude ≈ 111 km, so a 0.1° area ≈ 11 km wide.
    // 0.4 × 11 km ≈ 4.4 km keeps neighbouring areas' circles from touching.
    const radius = areaStep * 111_000 * 0.4;
    const bounds: Leaflet.LatLngBoundsExpression[] = [];
    for (const a of areas) {
      const key = areaKey(a);
      const selected = key === selectedKey;
      const center: Leaflet.LatLngTuple = [a.latitude, a.longitude];
      // The area's full square, used only to zoom the map so every area fits.
      bounds.push([
        [a.latitude - half, a.longitude - half],
        [a.latitude + half, a.longitude + half],
      ]);
      const { color } = levelFor(a.averageKgPerPerson);
      const pick = (e: Leaflet.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e); // don't also trigger the map's "clear" click
        void onSelectRef.current(key);
      };

      // Soft coloured circle covering the area (not a pin, so it never reads as a person's spot).
      L.circle(center, {
        radius,
        color: selected ? "#1A1A1A" : "#FFFFFF",
        weight: selected ? 3 : 2,
        fillColor: color,
        fillOpacity: selected ? 0.6 : 0.42,
      })
        .on("click", pick)
        .addTo(layer);

      // Small label in the middle with the area's estimated average.
      L.marker(center, {
        icon: L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: `<div style="transform:translate(-50%,-50%);display:inline-block;white-space:nowrap;
            background:#fff;color:#1A1A1A;border:1.5px solid ${color};border-radius:999px;
            padding:3px 9px;font:600 12px -apple-system,system-ui,sans-serif;
            box-shadow:0 1px 4px rgba(0,0,0,.18)">${a.averageKgPerPerson} kg</div>`,
        }),
        keyboard: false,
      })
        .on("click", pick)
        .addTo(layer);
    }

    boundsRef.current = bounds.length ? L.latLngBounds(bounds.flat() as Leaflet.LatLngTuple[]) : null;

    // Zoom to show every area the first time data arrives.
    if (!fittedRef.current && boundsRef.current) {
      fitAll(map, boundsRef.current);
      fittedRef.current = true;
    }
  }, [ready, areas, areaStep, selectedKey]);

  // "Show all areas" button: zoom back out to fit every area.
  useEffect(() => {
    if (recenter > 0 && mapRef.current && boundsRef.current) fitAll(mapRef.current, boundsRef.current, true);
  }, [recenter]);

  // zIndex 0 keeps Leaflet's own layers (z-index 400+) inside this box, so the
  // legend and area cards drawn on top of the map stay visible on web.
  return <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 0, background: "#E8EEE8" }} />;
}

/** Zoom so every area is visible, leaving room for the floating top card and bottom panel. */
function fitAll(map: Leaflet.Map, bounds: Leaflet.LatLngBounds, animate = false) {
  map.fitBounds(bounds, {
    paddingTopLeft: FIT_PADDING_TOP_LEFT,
    paddingBottomRight: FIT_PADDING_BOTTOM_RIGHT,
    maxZoom: 12,
    animate,
  });
}
