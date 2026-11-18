# CarbonTrail — Test Plan & Initial Test Cases

## 1. Test Plan

### 1.1 Objectives
- Verify core user flows work as expected: registration, email verification, login, activity logging, and organizer login.
- Validate data integrity (correct emission calculations, correct user ownership of activities).
- Confirm offline caching queues activities and syncs when connectivity is restored.
- Ensure security boundaries: protected routes require auth, users can only access/modify their own data, verification codes are never stored in plaintext.
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
- Connections: discover/search users, send request, accept/reject, list connections, remove connection, duplicate prevention.

**Out of scope (for now)**
- Performance/load testing at scale.
- Full security audit/penetration testing.
- Cross-platform exhaustive testing (focus on primary target: Android emulator/device; iOS/web as smoke if available).
- Map tab functionality (placeholder).
- Future organizer features (dashboard is blank by design).
- CI pipeline wiring (the automated suite runs locally with `npm test`; hooking it to GitHub Actions is a later step).

### 1.3 Test Strategy
| Level | Approach | Tools/Method |
|---|---|---|
| **Unit (backend)** | Validate utilities (code generation/hashing) and server-side emission math. | **Automated:** Vitest (`backend/tests/crypto.test.ts`) |
| **API / Integration** | Test auth, organizer and activity endpoints end-to-end, with Prisma and the email provider replaced by in-memory fakes. | **Automated:** Vitest + Supertest (`backend/tests/*.test.ts`) |
| **UI / E2E (frontend)** | Validate screen flows, form validation, navigation, offline banner, sync behavior. | Manual on Android emulator + Expo Go/dev build; Detox/Maestro later |
| **Manual exploratory** | Edge cases, error states, network transitions, real email delivery. | Tester-driven sessions |

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

#### 1.4.1 Automated test suite (implemented)

Run from the repo root:

```bash
npm test              # one-shot run (API + unit tests)
npm run test:watch    # re-run affected tests while editing
```

or from `backend/`:

```bash
npm test              # vitest run
npm run test:watch    # vitest
```

Notes:
- **No database, SMTP account or running server is required.** `backend/tests/setup.ts` swaps the Prisma client for an in-memory fake (`backend/tests/helpers/fakePrisma.ts`) and stubs `sendVerificationCode`, so the suite is hermetic and safe to run anywhere.
- The Express app is exercised through **Supertest**, so real routing, middleware, validation (Zod), JWT signing and emission calculation are all under test.
- Because the fake stores data in memory, tests also assert persisted state directly (e.g. code hashes, `emailVerified`, activity ownership).
- JWT signing uses a fixed `test-secret`; `.env` values for the database/SMTP are never reached.
- Not covered automatically (kept manual below): real email delivery, offline queue/sync behaviour on a device, and all UI navigation.

| Test file | Covers |
|---|---|
| `backend/tests/crypto.test.ts` | Code generation, SHA-256 hashing, timing-safe comparison |
| `backend/tests/auth.test.ts` | Registration, verification, resend, login, `/me`, organizer login |
| `backend/tests/activity.test.ts` | Activity create/list/update/delete, emission math, ownership, auth |
| `backend/tests/connections.test.ts` | User discovery/search, requests, accept/reject, duplicate prevention, removal |
| `backend/tests/health.test.ts` | Health endpoint smoke test |

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
| AUTH-LOG-002 | Login with an unverified account (current behaviour) | P1 | Registered but not verified | Enter correct credentials. | **Behaviour changed in `a912ee3`:** login succeeds (200 + token, `role: "user"`) because verification is enforced only in the register→verify flow. Revisit if login is meant to block unverified users. |
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

### 2.7 Connections

User story: *As a user, I want to connect with other users so that I can interact with people interested in sustainability.*

Sending a request from a challenge forum is **not implemented yet** (no challenge/forum feature exists); the Connect action lives in the Community tab for now.

| ID | Title | Priority | Preconditions | Steps | Expected Result |
|---|---|---:|---|---|---|
| CONN-001 | Discover other users | P0 | Two or more accounts exist | Open Community with an empty search box. | Lists other users (never yourself) newest-first, with no email or password fields. |
| CONN-002 | Search by name or email | P0 | Accounts exist | Type part of a name or email. | Case-insensitive matches only; no results shows an empty state. |
| CONN-003 | Relationship state in results | P1 | A request exists between two users | Search for that user. | Result shows `request_sent` / `request_received` / `connected` with a connection id. |
| CONN-004 | Send a connection request | P0 | Two accounts | Tap Connect on a user. | 201 with a pending connection; both users are stored in canonical order (`userAId < userBId`). |
| CONN-005 | Cannot connect to yourself | P1 | Logged in | Request your own id. | 400 "You cannot send a connection request to yourself". |
| CONN-006 | Request to unknown user | P2 | Logged in | Request a non-existent id. | 404 "User not found". |
| CONN-007 | Duplicate request (same direction) | P0 | Pending request A→B | A requests B again. | 409 `REQUEST_ALREADY_SENT`; still exactly one row. |
| CONN-008 | Duplicate request (reverse direction) | P0 | Pending request A→B | B requests A. | 409 `REQUEST_ALREADY_RECEIVED`; still exactly one row. |
| CONN-009 | Duplicate after connecting | P1 | A and B are connected | Either requests again. | 409 `ALREADY_CONNECTED`. |
| CONN-010 | Re-request after rejection | P2 | B rejected A | A requests B again. | 201; the existing row is reopened as pending. |
| CONN-011 | Auth required to send | P0 | No token | POST `/api/connections`. | 401. |
| CONN-012 | Accept a request | P0 | Pending request A→B | B accepts. | 200 accepted; appears in both users' connections; removed from pending inbox. |
| CONN-013 | Requester cannot accept own request | P1 | Pending request A→B | A accepts. | 403; request stays pending. |
| CONN-014 | Unrelated user cannot respond | P0 | Pending request A→B; C logged in | C accepts/rejects. | 404; request unchanged. |
| CONN-015 | Reject a request | P0 | Pending request A→B | B rejects. | 200 rejected; disappears from inbox and from connections. |
| CONN-016 | Cannot re-respond to a resolved request | P2 | Request already accepted/rejected | Respond again. | 400 "This request is no longer pending". |
| CONN-017 | Incoming vs sent lists | P1 | Pending request A→B | B lists requests; A lists sent. | B sees the incoming request, A sees it under sent, each list excludes the other side. |
| CONN-018 | Cancel a pending request | P1 | Pending request A→B | A deletes it. | 200; row removed; A can request again. |
| CONN-019 | Remove a connection | P1 | A and B connected | Either user deletes the connection. | 200; gone from both connections lists. |
| CONN-020 | Unrelated user cannot delete | P1 | Connection A↔B; C logged in | C deletes the connection. | 404; connection unchanged. |
| CONN-021 | Auth on all endpoints | P0 | No token | Call users/connections endpoints. | 401 on every endpoint. |

### 2.8 Automation Coverage Map

Legend: **A** = automated (`npm test`), **M** = manual (device/emulator or real email).

| Automated (A) | Manual (M) |
|---|---|
| AUTH-REG-001…004 | AUTH-VER-007 (real email delivery via Gmail SMTP) |
| AUTH-VER-001…006, 008…010 | ORG-002, ORG-003 (organizer screen + logout UI) |
| AUTH-LOG-001…007 | ACT UI flow inside the app (the API is automated) |
| ORG-001, ORG-004, ORG-005 | OFF-001…008 (offline queue + sync on device) |
| ACT-001…007 | SEC-001–004 spot-check against the deployed API |
| CONN-001…021 | Community tab interaction (tap-through, keyboard, pull-to-refresh) |
| SEC-002 (hash-at-rest), SEC-004 | Exploratory / usability sessions |

Automated test names mirror the case IDs (`AUTH-REG-001`, `ACT-005`, …) so a failing run maps straight back to this document.

---

## 3. Suggested Execution Order (Initial Run)
1. **Run the automated suite**: `npm test` (covers the API/unit cases listed as **A** above).
2. **Environment sanity**: migrations applied, Gmail SMTP config verified.
3. **Manual P0**: AUTH-VER-007, ORG-002, ORG-003, OFF-001, OFF-003.
4. Remaining P1/P2 manual cases and exploratory testing.

## 4. Open Items / Dependencies
- Set known passwords (bcrypt hashes) for the 3 organizer emails in the `Organizer` table.
- Confirm which environment to test against (local backend vs Render) and update `API_URL`/device networking accordingly (Android emulator may need `10.0.2.2` for local backend).
- Confirm Gmail SMTP sends to non-owner inboxes in the target environment and check deliverability/spam.
- If offline edits to pending items are possible in UI, define expected behavior (not explicitly implemented in current queue logic).
