trello - https://trello.com/b/FjpMu5UH/software-engineering-project

## ⚙️ Backend Setup & Environment Variables

The API server lives in `backend/` and is deployed on **Render** (deploys from `main`). It expects the following environment variables — see `backend/.env.example` for a copyable template:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Render external database URL) |
| `JWT_SECRET` | ✅ | Signs login tokens — use a long random string |
| `JWT_EXPIRES_IN` | optional | Token lifetime, default `7d` |
| `GMAIL_USER` | ✅ (for real emails) | Gmail address that sends verification codes |
| `GMAIL_APP_PASSWORD` | ✅ (for real emails) | 16-char Gmail app password (NOT the account password) |
| `EMAIL_FROM` | optional | "From" name/address in outgoing mail |
| `APP_NAME` | optional | Display name in emails, default `Carbon Footprint` |
| `VERIFICATION_CODE_EXP_MIN` | optional | Code expiry in minutes, default `10` |
| `PORT` | set by Render | Server port |

### Email verification (Gmail SMTP)

Verification emails are sent through Gmail SMTP using [nodemailer](https://nodemailer.com/). To set up the app password:

1. Enable **2-Step Verification** on the sending Google account (Google Account → Security)
2. Search **"App passwords"** in the same Security page and generate one
3. Put the Gmail address and the 16-char app password in Render → Environment (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) — or in `backend/.env` locally

If these variables are missing, the server does not crash: it falls back to printing verification codes to the logs (`VERIFICATION EMAIL (DEV MODE ...)` banner) so registration still works during development.

> Local development: copy `backend/.env.example` to `backend/.env` and fill in real values. The `.env` file is gitignored — never commit credentials.

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

