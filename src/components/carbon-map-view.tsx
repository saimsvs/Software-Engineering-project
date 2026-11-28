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
  /** The area the viewer shares (from Privacy), or null. */
  myArea: { latitude: number; longitude: number } | null;
  /** Whether the viewer's area is one of the shown areas (3+ people). */
  myAreaShown: boolean;
  /** The viewer's own phone position for the blue dot (never sent anywhere), or null. */
  me: { latitude: number; longitude: number } | null;
  dom?: import("expo/dom").DOMProps;
};

/** Where the map starts when there are no areas yet (Karachi). */
const DEFAULT_CENTER: Leaflet.LatLngTuple = [24.86, 67.01];

/** Space kept clear for the floating cards when zooming to fit: [left/right, top] and [left/right, bottom]. */
const FIT_PADDING_TOP_LEFT: Leaflet.PointTuple = [24, 150];
const FIT_PADDING_BOTTOM_RIGHT: Leaflet.PointTuple = [24, 190];

export default function CarbonMapView({ areas, areaStep, selectedKey, onSelect, recenter, myArea, myAreaShown, me }: Props) {
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

  // Draw (or redraw) everything on top of the map whenever the data or selection changes:
  // one soft circle + value label per area, the viewer's own area, and the blue "you" dot.
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
    const myKey = myArea ? areaKey(myArea) : null;
    const select = (key: string) => (e: Leaflet.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e); // don't also trigger the map's "clear" click
      void onSelectRef.current(key);
    };

    for (const a of areas) {
      const key = areaKey(a);
      const selected = key === selectedKey;
      const isMine = key === myKey;
      const center: Leaflet.LatLngTuple = [a.latitude, a.longitude];
      // The area's full square, used only to zoom the map so every area fits.
      bounds.push([
        [a.latitude - half, a.longitude - half],
        [a.latitude + half, a.longitude + half],
      ]);
      const { color } = levelFor(a.averageKgPerPerson);
      const pick = select(key);

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

      // Small label in the middle with the area's estimated average (+ "You" on the viewer's own area).
      L.marker(center, { icon: pill(L, `${a.averageKgPerPerson} kg${isMine ? YOU_CHIP : ""}`, color), keyboard: false })
        .on("click", pick)
        .addTo(layer);
    }

    // The viewer's own area while it has fewer than 3 people: a dashed outline
    // with no numbers (showing them could reveal the one other person's emissions).
    if (myArea && myKey && !myAreaShown) {
      const center: Leaflet.LatLngTuple = [myArea.latitude, myArea.longitude];
      bounds.push([
        [myArea.latitude - half, myArea.longitude - half],
        [myArea.latitude + half, myArea.longitude + half],
      ]);
      const selected = myKey === selectedKey;
      L.circle(center, {
        radius,
        color: "#2E7D32",
        weight: selected ? 3 : 2,
        dashArray: "6 6",
        fillColor: "#2E7D32",
        fillOpacity: selected ? 0.14 : 0.06,
      })
        .on("click", select(myKey))
        .addTo(layer);
      L.marker(center, { icon: pill(L, "Your area", "#2E7D32", "#2E7D32"), keyboard: false })
        .on("click", select(myKey))
        .addTo(layer);
    }

    // "You are here": the phone's own position. It only exists on this phone.
    if (me) {
      const at: Leaflet.LatLngTuple = [me.latitude, me.longitude];
      L.circleMarker(at, { radius: 16, stroke: false, fillColor: "#1E88E5", fillOpacity: 0.18, interactive: false }).addTo(layer);
      L.circleMarker(at, { radius: 7, color: "#FFFFFF", weight: 3, fillColor: "#1E88E5", fillOpacity: 1, interactive: false }).addTo(layer);
    }

    boundsRef.current = bounds.length ? L.latLngBounds(bounds.flat() as Leaflet.LatLngTuple[]) : null;

    // Zoom to show every area the first time data arrives.
    if (!fittedRef.current && boundsRef.current) {
      fitAll(map, boundsRef.current);
      fittedRef.current = true;
    }
  }, [ready, areas, areaStep, selectedKey, myArea, myAreaShown, me]);

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

/** Small "You" tag shown inside the label of the viewer's own area. */
const YOU_CHIP =
  '<span style="margin-left:6px;background:#2E7D32;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:700">You</span>';

/** A white rounded label centred on a point (used for "8.3 kg" and "Your area"). */
function pill(L: typeof Leaflet, html: string, border: string, text = "#1A1A1A") {
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-50%);display:inline-flex;align-items:center;white-space:nowrap;
      background:#fff;color:${text};border:1.5px solid ${border};border-radius:999px;
      padding:3px 9px;font:600 12px -apple-system,system-ui,sans-serif;
      box-shadow:0 1px 4px rgba(0,0,0,.18)">${html}</div>`,
  });
}
