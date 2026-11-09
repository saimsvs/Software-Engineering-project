trello - https://trello.com/b/FjpMu5UH/software-engineering-project

## ⚙️ Backend Setup & Environment Variables

The API server lives in `backend/` and is deployed on **Render** (deploys from `main`). It expects the following environment variables — see `backend/.env.example` for a copyable template:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Render external database URL) |
| `JWT_SECRET` | ✅ | Signs login tokens — use a long random string |
| `JWT_EXPIRES_IN` | optional | Token lifetime, default `7d` |
| `GMAIL_USER` | optional | Gmail address that sends verification codes (SMTP) |
| `GMAIL_APP_PASSWORD` | optional | 16-char Gmail app password (NOT the account password) |
| `EMAIL_FROM` | optional | "From" name/address in outgoing mail |
| `BREVO_API_KEY` | ✅ (on Render) | Brevo HTTPS email API key — required because Render blocks outbound SMTP |
| `RESEND_API_KEY` | optional | Alternative HTTPS fallback (needs a verified domain) |
| `APP_NAME` | optional | Display name in emails, default `Carbon Footprint` |
| `VERIFICATION_CODE_EXP_MIN` | optional | Code expiry in minutes, default `10` |
| `PORT` | set by Render | Server port |

### Email verification

The server tries email providers in this order, stopping at the first success:

| Order | Provider | Transport | Notes |
|---|---|---|---|
| 1 | **Brevo** | HTTPS API (port 443) | Used on Render — free tier 300 emails/day |
| 2 | Resend | HTTPS API (port 443) | Requires a verified domain |
| 3 | Gmail SMTP | Ports 587 / 465 | Works locally; **blocked on Render** |
| 4 | Dev mode | — | Prints the code to the logs if nothing is configured |

> ⚠️ **Render blocks outbound SMTP.** Connections to `smtp.gmail.com` on ports 587 and 465 time out from Render (`ETIMEDOUT`, `command: 'CONN'`), so Gmail SMTP only works when running the backend locally. On Render, use **Brevo**.

**Setting up Brevo (free, no domain required):**

1. Create an account at [brevo.com](https://www.brevo.com)
2. Go to **Senders & IPs → Senders → Add a sender** and add your Gmail address, then click the verification link sent to that inbox
3. Go to **SMTP & API → API Keys → Generate a new API key** and copy it
4. Add `BREVO_API_KEY` (and `EMAIL_FROM` with the verified address) in Render → Environment

**Optional — Gmail SMTP for local development:** enable 2-Step Verification on the Google account, then Google Account → Security → **App passwords** → generate a 16-char password and set `GMAIL_USER` / `GMAIL_APP_PASSWORD` in `backend/.env`.

If no provider is configured, the server does not crash: it falls back to printing verification codes to the logs (`VERIFICATION EMAIL (DEV MODE ...)` banner) so registration still works during development.

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

