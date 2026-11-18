import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export type Activity = {
  id: string;
  name: string;
  icon: IconName;
  unit: string;
  factor: number;
  category: "Transport" | "Energy" | "Food" | "Waste";
};

export const ACTIVITIES: Activity[] = [
  // Transport — factor per km
  { id: "car-petrol", name: "Car (Petrol)", icon: "car-outline", unit: "km", factor: 0.192, category: "Transport" },
  { id: "car-electric", name: "Car (Electric)", icon: "battery-charging-outline", unit: "km", factor: 0.05, category: "Transport" },
  { id: "bus", name: "Bus", icon: "bus-outline", unit: "km", factor: 0.089, category: "Transport" },
  { id: "train", name: "Train", icon: "train-outline", unit: "km", factor: 0.041, category: "Transport" },
  { id: "flight-dom", name: "Flight (Dom.)", icon: "airplane-outline", unit: "km", factor: 0.255, category: "Transport" },
  { id: "flight-intl", name: "Flight (Intl.)", icon: "airplane-outline", unit: "km", factor: 0.195, category: "Transport" },
  { id: "motorcycle", name: "Motorcycle", icon: "speedometer-outline", unit: "km", factor: 0.113, category: "Transport" },
  { id: "taxi", name: "Taxi", icon: "car-sport-outline", unit: "km", factor: 0.148, category: "Transport" },

  // Energy — factor per unit
  { id: "electricity", name: "Electricity", icon: "flash-outline", unit: "kWh", factor: 0.207, category: "Energy" },
  { id: "natural-gas", name: "Natural Gas", icon: "flame-outline", unit: "m³", factor: 2.04, category: "Energy" },
  { id: "heating-oil", name: "Heating Oil", icon: "water-outline", unit: "L", factor: 2.54, category: "Energy" },

  // Food — factor per meal / serving
  { id: "beef-meal", name: "Beef Meal", icon: "restaurant-outline", unit: "meal", factor: 2.7, category: "Food" },
  { id: "chicken-meal", name: "Chicken Meal", icon: "fast-food-outline", unit: "meal", factor: 1.4, category: "Food" },
  { id: "veggie-meal", name: "Veggie Meal", icon: "leaf-outline", unit: "meal", factor: 0.7, category: "Food" },
  { id: "milk", name: "Milk", icon: "pint-outline", unit: "L", factor: 0.32, category: "Food" },

  // Waste — factor per kg
  { id: "general-waste", name: "General Waste", icon: "trash-outline", unit: "kg", factor: 0.5, category: "Waste" },
  { id: "plastic-waste", name: "Plastic Waste", icon: "cube-outline", unit: "kg", factor: 1.5, category: "Waste" },
  { id: "paper-waste", name: "Paper Waste", icon: "document-text-outline", unit: "kg", factor: 0.9, category: "Waste" },
];

export function calcEmission(activity: Activity, value: string, unit: string): number {
  const d = parseFloat(value) || 0;
  const amount = unit === "miles" ? d * 1.60934 : d;
  return Math.round(amount * activity.factor * 10) / 10;
}
