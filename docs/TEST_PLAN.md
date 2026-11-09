# CarbonTrail — Test Plan & Initial Test Cases

## 1. Test Plan

### 1.1 Objectives
- Verify core user flows work as expected: registration, email verification, login, activity logging, and organizer login.
- Validate data integrity (correct emission calculations, correct user ownership of activities).
- Confirm offline caching queues activities and syncs when connectivity is restored.
- Ensure security boundaries: protected routes require auth, users can only access/modify their own data, unverified users cannot log in.
- Identify defects early and provide a repeatable baseline for regression testing.

### 1.2 Scope

**In scope**
- Authentication (user): register, verify email (6-digit code), resend code, login, logout.
- Authentication (organizer): login, redirect to organizer dashboard, logout.
- Activity management: create, list, update, delete activities (API + UI flow).
- Offline behavior: queue activity create/update when offline, auto-sync on reconnect/app start.
- Email delivery integration (Gmail SMTP): verification email sends successfully (functional smoke; deliverability is environment-dependent).
- API validation/error handling: invalid inputs, expired/invalid codes, duplicate email, wrong password.
- Basic UI/navigation: auth screens, verify screen, log flow, organizer blank screen.

**Out of scope (for now)**
- Performance/load testing at scale.
- Full security audit/penetration testing.
- Cross-platform exhaustive testing (focus on primary target: Android emulator/device; iOS/web as smoke if available).
- Map tab functionality (placeholder).
- Future organizer features (dashboard is blank by design).
- Automated CI pipeline setup (test cases can be automated later).

### 1.3 Test Strategy
| Level | Approach | Tools/Method |
|---|---|---|
| **Unit (backend)** | Validate utilities (code generation/hashing, emission factors if extracted), schema/validation logic. | Jest/Vitest + Prisma test patterns (future) / manual for now |
| **API / Integration** | Test auth + activity endpoints end-to-end against a test DB. | Postman/Thunder Client, curl/Invoke-RestMethod, or automated API tests |
| **UI / E2E (frontend)** | Validate screen flows, form validation, navigation, offline banner, sync behavior. | Manual on Android emulator + Expo Go/dev build; Detox/Maestro later |
| **Manual exploratory** | Edge cases, error states, network transitions. | Tester-driven sessions |

**Test data**
- Use dedicated test emails (including the organizer emails added to DB: `umama.m.mianoor@gmail.com`, `Saim.29hs@gmail.com`, `kashifjaffari1@gmail.com`).
- Organizers need valid `passwordHash` values set in DB to log in (verify before testing).
- Use a test database/environment; avoid production data corruption.

### 1.4 Test Environment
- **Backend**: Node/Express, Prisma, PostgreSQL (Render DB per `.env` or local test DB), Gmail SMTP configured (`GMAIL_USER`, `GMAIL_APP_PASSWORD`).
- **Frontend**: Expo (SDK ~57), React Native 0.86, Android emulator (e.g., `Medium_Phone_API_36.1`) or physical device.
- **Network simulation**: Emulator network toggle / airplane mode; optional proxy for flaky network.
- **Build/run**:
  - Backend: `cd backend && node node_modules/tsx/dist/cli.mjs src/index.ts` (or `npm run dev`)
  - Frontend: `cd <root> && node node_modules/expo/bin/cli start` (ensure deps installed)
  - Android emulator: ensure ADB reverse if using local backend (`adb reverse tcp:3000 tcp:3000`)

### 1.5 Entry / Exit Criteria
**Entry**
- Feature code merged to test branch, migrations applied, backend starts, frontend builds, test accounts/DB ready.

**Exit (initial cycle)**
- All P0/P1 test cases executed.
- No open P0 defects; P1 defects triaged with workaround or fix plan.
- Core flows (register→verify→login, log activity online/offline, organizer login) pass.

### 1.6 Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Gmail SMTP auth/deliverability issues | Blocks verification testing | Verify App Password/2FA; check spam; have console-log fallback in dev; test with multiple providers |
| Emulator/network toggling inconsistent | Flaky offline tests | Repeat tests; use device if possible; verify queue state in AsyncStorage/logs |
| DB state/migrations drift | False failures | Reset test DB or use transactions/cleanup; document seed data |
| Time-based code expiry (10 min) | Hard to test expiry | Temporarily configure shorter expiry in test env or wait; test boundary logic via API |
| Organizer passwords not set | Cannot test organizer login | Seed organizers with known bcrypt hashes before testing |

### 1.7 Defect Severity
- **P0**: Crash/data loss/security issue; cannot complete core flow (e.g., cannot verify/login, activities lost).
- **P1**: Major feature broken with no workaround (e.g., offline sync never runs).
- **P2**: Functional issue with workaround or minor UX problem.
- **P3**: Cosmetic/low impact.

---

## 2. Initial Test Cases

### 2.1 User Registration & Email Verification

| ID | Title | Priority | Preconditions | Steps | Expected Result |
|---|---|---:|---|---|---|
| AUTH-REG-001 | Register with valid data | P0 | Email not registered; backend running | 1. Open Register. 2. Enter valid name, unique email, password (≥8), confirm, agree to terms. 3. Submit. | API returns success with “Verification code sent”; UI navigates to verify-code screen for that email; no JWT saved; no auto-login. |
| AUTH-REG-002 | Register with duplicate email | P1 | Email already exists in `User` | Submit registration with existing email. | 400/error message “Email already registered”; user not created again. |
| AUTH-REG-003 | Register validation errors | P2 | — | Try: missing fields, invalid email, password < 8, mismatched confirm, terms unchecked. | Client-side validation blocks submit with appropriate messages; no bad request sent (or API rejects cleanly). |
| AUTH-VER-001 | Verify with correct code | P0 | User registered, code received | 1. Enter correct 6-digit code on verify screen. 2. Submit. | “Email verified successfully”; user redirected to login; `emailVerified` becomes true; codes for user invalidated. |
| AUTH-VER-002 | Verify with incorrect code | P1 | Unverified user with active code | Enter wrong 6-digit code. | Error “Invalid verification code”; `attempts` increments; user remains unverified. |
| AUTH-VER-003 | Verify with expired code | P1 | Code expired (`VERIFICATION_CODE_EXP_MIN` elapsed) | Enter correct code after expiry. | Error indicating code expired; user remains unverified. |
| AUTH-VER-004 | Too many failed attempts | P2 | Active code | Enter wrong code ≥ 5 times. | Error prompts requesting new code; existing codes invalidated per implementation. |
| AUTH-VER-005 | Resend verification code | P1 | Unverified user | Tap Resend (respect cooldown). | New code sent; old code invalidated; generic success message shown; cooldown timer works (60s UI). |
| AUTH-VER-006 | Resend for already verified email | P2 | Verified user | Call resend for verified email. | Response indicates already verified / generic non-enumerating message; no new usable flow required. |
| AUTH-VER-007 | Email delivery (Gmail SMTP smoke) | P1 | Gmail SMTP configured | Register with reachable test inbox. | Email arrives from configured Gmail sender with 6-digit code and expiry text; check spam/promotions. |

### 2.2 Login & Session

| ID | Title | Priority | Preconditions | Steps | Expected Result |
|---|---|---:|---|---|---|
| AUTH-LOG-001 | Login verified user | P0 | Verified user exists | Enter correct email/password. | 200 with token + user (`role: "user"`); token saved; navigates to `/home`. |
| AUTH-LOG-002 | Login unverified user blocked | P0 | Registered but not verified | Enter correct credentials. | 403 `EMAIL_NOT_VERIFIED`; UI prompts to verify/resend; no token saved; no access to home. |
| AUTH-LOG-003 | Login wrong password | P1 | User exists | Enter wrong password. | 401 “Invalid credentials”; no token. |
| AUTH-LOG-004 | Login unknown email | P1 | Email not in User/Organizer | Submit login. | 401 “Invalid credentials” (no enumeration). |
| AUTH-LOG-005 | `/me` returns user profile | P1 | Valid token | Call `GET /api/auth/me` with Bearer token. | Returns user fields including `emailVerified`; 401/404 appropriately when unauthenticated/missing. |
| AUTH-LOG-006 | Logout | P2 | Logged in | Trigger logout/clear token (where available). | Token removed; protected actions require login again. |

### 2.3 Organizer Login

| ID | Title | Priority | Preconditions | Steps | Expected Result |
|---|---|---:|---|---|---|
| ORG-001 | Organizer login success | P0 | Organizer row exists with known password hash for test email | Login with organizer email/password. | 200 with token + user (`role: "organizer"`); navigates to `/organizer` (blank dashboard); no “Logged in!” → `/home` path. |
| ORG-002 | Organizer dashboard UI | P1 | Logged in as organizer | View organizer screen. | Blank/placeholder content (“Organizer Dashboard / Coming soon”) displayed; Logout button visible. |
| ORG-003 | Organizer logout | P0 | On organizer screen | Tap Logout. | Token cleared; navigates to `/login`; cannot access organizer screen without re-login. |
| ORG-004 | Organizer wrong password | P1 | Organizer exists | Login with wrong password. | 401 “Invalid credentials”. |
| ORG-005 | Organizer vs user precedence | P2 | Same email not expected; but verify logic | Attempt login where applicable. | Behavior matches implementation (organizer checked first); document if email collision is possible and desired. |

> **Note:** Ensure organizer test accounts have valid bcrypt `passwordHash` values before ORG-001/004. If hashes are empty/placeholder, set them via a controlled seed/update.

### 2.4 Activity Logging (Online)

| ID | Title | Priority | Preconditions | Steps | Expected Result |
|---|---|---:|---|---|---|
| ACT-001 | Create activity (POST) | P0 | Authenticated user | Complete log flow (select activity, details, review) and save while online. | API returns 201 + activity; emission computed server-side; UI shows success and returns to home/history as designed. |
| ACT-002 | List activities | P1 | User has activities | Call `GET /api/auth/activity` (and `?all=1` if used). | Returns only current user’s activities, ordered desc, respects take limit. |
| ACT-003 | Update activity (PATCH) | P1 | User owns activity | Edit an activity and save. | 200 with updated activity; emission recomputed; only owner can update. |
| ACT-004 | Delete activity (DELETE) | P1 | User owns activity | Delete an activity. | 200 “Deleted”; activity removed. |
| ACT-005 | Ownership enforcement | P0 | Two users, activity belongs to A | User B attempts GET/PATCH/DELETE A’s activity (by ID). | 404/not accessible; no modification to A’s data. |
| ACT-006 | Invalid activity payload | P2 | Authenticated | Send missing/invalid fields, unknown `activityId`, non-positive distance. | 400 with validation/“Unknown activity type” error. |
| ACT-007 | Unauthenticated activity access | P0 | No/invalid token | Call activity endpoints without auth. | 401/403 per middleware. |

### 2.5 Offline Caching & Sync

| ID | Title | Priority | Preconditions | Steps | Expected Result |
|---|---|---:|---|---|---|
| OFF-001 | Save activity while offline (create) | P0 | Logged in; device offline | 1. Disable network. 2. Complete log flow and save. | UI shows “Saved Offline” message; operation enqueued in AsyncStorage; no crash. |
| OFF-002 | Save activity while offline (update) | P1 | Existing activity; offline | Edit and save while offline. | Update enqueued as pending operation (per implementation) with correct endpoint/method/payload. |
| OFF-003 | Auto-sync on reconnect | P0 | Pending queued items; backend reachable | Restore network connectivity. | Queue syncs automatically (NetInfo listener); successful items removed; server receives requests; UI pending count decreases. |
| OFF-004 | Sync on app start | P1 | Pending items exist | Close/reopen app with network available. | `syncQueueIfNeeded` runs; pending items attempt sync. |
| OFF-005 | Offline banner/pending indicator | P2 | Offline and/or pending items | Observe UI in offline/pending states. | Banner shows offline message and/or “X activities waiting to sync”; hides when online and queue empty. |
| OFF-006 | Sync stops on auth failure | P1 | Token expired/invalid; pending items | Trigger sync with 401 from API. | Sync stops; item marked failed with appropriate error; user prompted to log in again (per behavior). |
| OFF-007 | Retry/failure handling | P2 | Intermittent server/network errors | Cause failures during sync. | Retry count increments; stops after max retries or on network break; no infinite tight loop. |
| OFF-008 | FIFO/order preservation | P2 | Multiple queued operations | Queue several actions offline, then sync. | Operations processed in order; data consistent on server. |

### 2.6 API & Security Smoke

| ID | Title | Priority | Preconditions | Steps | Expected Result |
|---|---|---:|---|---|---|
| SEC-001 | Passwords not returned | P0 | Any user/organizer | Inspect register/login/me responses and logs. | No `passwordHash` exposed. |
| SEC-002 | Verification code not stored in plaintext (design check) | P1 | Review implementation/DB | Check code storage. | `codeHash` stored; comparison uses secure method. |
| SEC-003 | Input validation on auth endpoints | P1 | — | Send malformed JSON/missing fields. | 400 responses; server remains stable. |
| SEC-004 | CORS/health endpoint | P3 | Backend running | `GET /api/health`. | Returns `{ status: "ok", ... }`. |

---

## 3. Suggested Execution Order (Initial Run)
1. **Environment sanity**: SEC-004, migrations applied, Gmail SMTP config verified.
2. **P0 auth**: AUTH-REG-001, AUTH-VER-001, AUTH-LOG-001, AUTH-LOG-002.
3. **P0 organizer**: ORG-001, ORG-003.
4. **P0 activities**: ACT-001, ACT-005, ACT-007.
5. **P0 offline**: OFF-001, OFF-003.
6. Remaining P1/P2 cases and exploratory testing.

## 4. Open Items / Dependencies
- Set known passwords (bcrypt hashes) for the 3 organizer emails in the `Organizer` table.
- Confirm which environment to test against (local backend vs Render) and update `API_URL`/device networking accordingly (Android emulator may need `10.0.2.2` for local backend).
- Confirm Gmail SMTP sends to non-owner inboxes in the target environment and check deliverability/spam.
- If offline edits to pending items are possible in UI, define expected behavior (not explicitly implemented in current queue logic).
