export type Activity = {
  id: string;
  name: string;
  emoji: string;
  unit: string;
  factor: number;
  category: "Transport" | "Energy" | "Food" | "Waste";
};

export const ACTIVITIES: Activity[] = [
  // Transport — factor per km
  { id: "car-petrol", name: "Car (Petrol)", emoji: "🚗", unit: "km", factor: 0.192, category: "Transport" },
  { id: "car-electric", name: "Car (Electric)", emoji: "🚗", unit: "km", factor: 0.05, category: "Transport" },
  { id: "bus", name: "Bus", emoji: "🚌", unit: "km", factor: 0.089, category: "Transport" },
  { id: "train", name: "Train", emoji: "🚆", unit: "km", factor: 0.041, category: "Transport" },
  { id: "flight-dom", name: "Flight (Dom.)", emoji: "✈️", unit: "km", factor: 0.255, category: "Transport" },
  { id: "flight-intl", name: "Flight (Intl.)", emoji: "✈️", unit: "km", factor: 0.195, category: "Transport" },
  { id: "motorcycle", name: "Motorcycle", emoji: "🛵", unit: "km", factor: 0.113, category: "Transport" },
  { id: "taxi", name: "Taxi", emoji: "🚕", unit: "km", factor: 0.148, category: "Transport" },

  // Energy — factor per unit
  { id: "electricity", name: "Electricity", emoji: "💡", unit: "kWh", factor: 0.207, category: "Energy" },
  { id: "natural-gas", name: "Natural Gas", emoji: "🔥", unit: "m³", factor: 2.04, category: "Energy" },
  { id: "heating-oil", name: "Heating Oil", emoji: "🛢️", unit: "L", factor: 2.54, category: "Energy" },

  // Food — factor per meal / serving
  { id: "beef-meal", name: "Beef Meal", emoji: "🥩", unit: "meal", factor: 2.7, category: "Food" },
  { id: "chicken-meal", name: "Chicken Meal", emoji: "🍗", unit: "meal", factor: 1.4, category: "Food" },
  { id: "veggie-meal", name: "Veggie Meal", emoji: "🥗", unit: "meal", factor: 0.7, category: "Food" },
  { id: "milk", name: "Milk", emoji: "🥛", unit: "L", factor: 0.32, category: "Food" },

  // Waste — factor per kg
  { id: "general-waste", name: "General Waste", emoji: "🗑️", unit: "kg", factor: 0.5, category: "Waste" },
  { id: "plastic-waste", name: "Plastic Waste", emoji: "🥤", unit: "kg", factor: 1.5, category: "Waste" },
  { id: "paper-waste", name: "Paper Waste", emoji: "📄", unit: "kg", factor: 0.9, category: "Waste" },
];

export function calcEmission(activity: Activity, value: string, unit: string): number {
  const d = parseFloat(value) || 0;
  const amount = unit === "miles" ? d * 1.60934 : d;
  return Math.round(amount * activity.factor * 10) / 10;
}
