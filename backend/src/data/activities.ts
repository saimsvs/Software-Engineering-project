export const ACTIVITY_IDS = [
  // Transport
  "car-petrol",
  "car-electric",
  "bus",
  "train",
  "flight-dom",
  "flight-intl",
  "motorcycle",
  "taxi",

  // Energy
  "electricity",
  "natural-gas",
  "heating-oil",

  // Food
  "beef-meal",
  "chicken-meal",
  "veggie-meal",
  "milk",

  // Waste
  "general-waste",
  "plastic-waste",
  "paper-waste",
] as const;

export const CHALLENGE_TARGET_UNITS = [
  "activities",
  "days",
  "km",
  "kWh",
  "meal",
  "L",
  "m³",
  "kg",
] as const;

export const CHALLENGE_TARGET_DIRECTIONS = [
  "at_least",
  "at_most",
] as const;

export const ACTIVITY_UNITS: Record<string, string> = {
  // Transport
  "car-petrol": "km",
  "car-electric": "km",
  bus: "km",
  train: "km",
  "flight-dom": "km",
  "flight-intl": "km",
  motorcycle: "km",
  taxi: "km",

  // Energy
  electricity: "kWh",
  "natural-gas": "m³",
  "heating-oil": "L",

  // Food
  "beef-meal": "meal",
  "chicken-meal": "meal",
  "veggie-meal": "meal",
  milk: "L",

  // Waste
  "general-waste": "kg",
  "plastic-waste": "kg",
  "paper-waste": "kg",
};