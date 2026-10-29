trello - https://trello.com/b/FjpMu5UH/software-engineering-project

## 🌱 Emission Factors & Data Sources

All CO₂e calculations in CarbonTrail are based on the **UK Government DEFRA (Department for Energy Security & Net Zero) GHG Conversion Factors for 2024**:
https://www.gov.uk/government/collections/ghg-conversion-factors-service

The emission for a logged activity is computed **server-side** as:

```
emission (kg CO₂e) = amount × factor
```

with miles converted to km (`1 mile = 1.60934 km`) before applying the factor. Factors are defined in `src/data/activities.ts` (client preview) and mirrored in `backend/src/routes/auth.ts` (authoritative server calculation — the client value is never trusted).

| Category  | Activity        | Unit | Factor (kg CO₂e per unit) |
|-----------|-----------------|------|---------------------------|
| Transport | Car (Petrol)    | km   | 0.192                     |
| Transport | Car (Electric)  | km   | 0.050                     |
| Transport | Bus             | km   | 0.089                     |
| Transport | Train           | km   | 0.041                     |
| Transport | Flight (Dom.)   | km   | 0.255                     |
| Transport | Flight (Intl.)  | km   | 0.195                     |
| Transport | Motorcycle      | km   | 0.113                     |
| Transport | Taxi            | km   | 0.148                     |
| Energy    | Electricity     | kWh  | 0.207                     |
| Energy    | Natural Gas     | m³   | 2.040                     |
| Energy    | Heating Oil     | L    | 2.540                     |
| Food      | Beef Meal       | meal | 2.700                     |
| Food      | Chicken Meal    | meal | 1.400                     |
| Food      | Veggie Meal     | meal | 0.700                     |
| Food      | Milk            | L    | 0.320                     |
| Waste     | General Waste   | kg   | 0.500                     |
| Waste     | Plastic Waste   | kg   | 1.500                     |
| Waste     | Paper Waste     | kg   | 0.900                     |

