export type Activity = {
  id: string;
  name: string;
  emoji: string;
  unit: string;
  factor: number;
  category: "Transport" | "Energy" | "Food" | "Waste";
};

export const ACTIVITIES: Activity[] = [
  { id: "car-petrol", name: "Car (Petrol)", emoji: "🚗", unit: "km", factor: 0.192, category: "Transport" },
  { id: "car-electric", name: "Car (Electric)", emoji: "🚗", unit: "km", factor: 0.05, category: "Transport" },
  { id: "bus", name: "Bus", emoji: "🚌", unit: "km", factor: 0.089, category: "Transport" },
  { id: "train", name: "Train", emoji: "🚆", unit: "km", factor: 0.041, category: "Transport" },
  { id: "flight-dom", name: "Flight (Dom.)", emoji: "✈️", unit: "km", factor: 0.255, category: "Transport" },
  { id: "flight-intl", name: "Flight (Intl.)", emoji: "✈️", unit: "km", factor: 0.195, category: "Transport" },
  { id: "motorcycle", name: "Motorcycle", emoji: "🛵", unit: "km", factor: 0.113, category: "Transport" },
  { id: "taxi", name: "Taxi", emoji: "🚕", unit: "km", factor: 0.148, category: "Transport" },
];

export function calcEmission(activity: Activity, value: string, unit: "km" | "miles"): number {
  const d = parseFloat(value) || 0;
  const km = unit === "miles" ? d * 1.60934 : d;
  return Math.round(km * activity.factor * 10) / 10;
}
