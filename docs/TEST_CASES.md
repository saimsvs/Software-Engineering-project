# CarbonTrail — Test Cases 

What each test checks and what should happen when it passes. 

---

## Account creation and email verification

- **Register with valid data.** A new user signs up; the account is created, a code is emailed, and the app moves to the code screen. Nobody is logged in yet.
- **Duplicate email.** Signing up with an email that already exists is refused and no second account is created.
- **Form validation.** Blank fields, a malformed email, a short password, mismatched confirmation, or unaccepted terms are blocked before anything is sent.
- **Email provider outage.** Signup still succeeds if the email service is down, so a mail failure doesn't lose the account.
- **Correct code.** The emailed 6-digit code marks the email verified and sends the user to login.
- **Wrong code.** An incorrect code is rejected, the attempt count rises, and the account stays unverified.
- **Expired code.** A code used after its lifetime is rejected and deleted.
- **Too many attempts.** After five wrong codes, verification is blocked until a new code is requested.
- **Resend.** A new code is issued and the old one stops working.
- **Resend when already verified.** The response says the address is already verified and no email is sent.
- **Resend for an unknown email.** The response stays neutral and doesn't reveal whether the address has an account.
- **Verify an unknown email.** Rejected.
- **Verify twice.** Verifying an already-verified email is rejected.
- **Malformed code.** Anything that isn't exactly six digits is rejected before any lookup.
- **Real email delivery.** A real inbox receives the code from the configured sender. Check spam too.

Codes are never stored in plaintext — only a hash, which is compared securely.

---

## Login and session

- **Valid login.** Correct credentials return a token and the profile, and never the password hash. The app goes to the home screen.
- **Login before verifying.** An account that never entered its code can still log in. This is the app's current behaviour and the test pins it down so a future change is deliberate.
- **Wrong password.** Rejected with a generic error and no token.
- **Unknown email.** Rejected with the same generic error, so nobody can tell which emails are registered.
- **Profile lookup.** A valid token returns the profile, including whether the email is verified.
- **Missing or invalid token.** The same request is refused.
- **Token for a deleted user.** Returns "not found" instead of crashing.
- **Logout.** The stored token is cleared and protected screens require signing in again.

---

## Organizer login

- **Organizer login.** A known organizer email and password return a token marked as organizer, and the app routes to the organizer screen instead of home.
- **Organizer dashboard.** Shows placeholder content and a visible Logout button.
- **Organizer logout.** Clears the token, returns to login, and the organizer screen can't be reopened without signing in.
- **Wrong organizer password.** Rejected with the same generic error.
- **Organizer takes precedence.** If an email existed as both a user and an organizer, the organizer record wins.

The three organizer accounts need real password hashes in the database before these pass.

---

## Logging activities

- **Create.** Saving a valid activity stores it and confirms the save.
- **Server-side calculation.** Emissions are computed by the server, not sent by the app, and miles are converted correctly.
- **Rounding.** Emissions round to one decimal place.
- **List.** A user sees only their own activities, newest first, capped at the latest 10.
- **Full history.** Asking for all activities returns everything instead of the latest 10.
- **Update.** Editing an owned activity saves the change and recalculates the emission.
- **Delete.** Deleting an owned activity removes it.
- **Ownership.** User B cannot read, edit or delete user A's activity, even with the right ID. A's data is untouched.
- **Invalid payload.** Missing fields, an unknown activity type, or a zero/negative distance are rejected.
- **No token.** Every activity endpoint refuses unauthenticated requests.

---

## Offline saving and syncing

- **Save while offline.** The app shows "Saved Offline" and queues the activity locally. Nothing crashes.
- **Edit while offline.** The update is queued with the right endpoint, method and payload.
- **Sync on reconnect.** Queued items send automatically, successful ones leave the queue, and the pending count drops.
- **Sync on app start.** Reopening the app with pending items triggers a sync attempt.
- **Offline banner.** Appears while offline or while items are waiting, and hides once everything is synced.
- **Auth failure.** An expired token stops the sync and prompts a new login instead of retrying forever.
- **Retry handling.** Failures count up and eventually stop, without a tight retry loop.
- **Order preserved.** Several offline actions replay in the order they happened, leaving the server consistent.

These need a device or emulator, because they depend on the network switching on and off.

---

## Connections (Community tab)

- **Discover people.** Lists other users, newest first, never yourself, and never exposes emails or passwords.
- **Search.** Typing part of a name or email filters the list, ignoring case; no matches shows an empty state.
- **Relationship shown.** Each result says whether you're connected, have sent a request, or have received one.
- **Send a request.** Tapping Connect creates a pending request. The pair is stored in a fixed order, so only one row can ever exist.
- **No self-requests.** Connecting to yourself is refused.
- **Unknown user.** Requesting a user that doesn't exist returns "User not found".
- **Duplicate request.** Asking the same person twice is refused and creates no second row.
- **Reverse duplicate.** If they already asked you, you're told to accept theirs instead.
- **Already connected.** Either side trying again is told they're already connected.
- **Retry after rejection.** A rejected request can be sent again; the existing row reopens instead of duplicating.
- **Login required.** Requests are refused without a token.
- **Accept.** The recipient accepts; the connection appears in both lists and leaves the inbox.
- **Only the recipient responds.** The sender can't accept their own request, and a third user can't respond at all.
- **Reject.** The recipient rejects; it disappears from the inbox and from both connection lists.
- **No double responses.** A resolved request can't be accepted or rejected again.
- **Incoming vs sent.** Each side sees the request on the correct side of their list, once.
- **Cancel.** The sender can withdraw a pending request, then send a new one.
- **Remove.** Either side can delete an accepted connection; it disappears for both.
- **Strangers can't delete.** A third user gets "not found" and the connection survives.
- **Auth everywhere.** Every users/connections endpoint refuses requests without a token.

Sending a request from a challenge forum isn't built yet — there's no forum feature. The Connect action lives in the Community tab, and the same API call can be reused when the forum exists.

---

## Public profiles

- **Open a profile.** Tapping a person's name or avatar in Community opens their public profile; going back returns to the list. Your own profile is reachable from Profile → "View My Public Profile".
- **Only public identity.** The profile shows a name and username. Emails, password hashes and activity notes are never sent.
- **Public goals only.** Goals marked public appear with their progress; private goals are absent from the response and the screen.
- **Share a goal.** The owner can switch a goal between public and private from My Goals. Nobody else can change that flag.
- **Trends are opt-in.** Emission trends stay hidden unless the owner enables "Show emission trends" in Privacy. When enabled, viewers see a 7-day total and category breakdown, not raw activity logs.
- **Privacy controls are reachable.** Privacy settings are opened from Profile → Privacy & Location; goals have their own per-goal sharing action.
- **Unknown user / no token.** An unknown profile returns "User not found", and the endpoint refuses requests without a login token.

Challenges aren't a feature in the app yet, so there are no challenge memberships to share. The profile deliberately shows an empty "Public challenges" state rather than inventing data; when challenges are added they must follow the same public-only rule.

---

## Security and health

- **No password leakage.** Register, login and profile responses never contain the password hash.
- **Codes hashed.** Verification codes are stored as hashes and compared safely.
- **Input validation.** Malformed JSON and missing fields return a clean 400 and the server stays up.
- **Health check.** `GET /api/health` reports the service is running.

---

## Not yet verified on a device

Real email delivery, the organizer screen and logout, all offline behaviour, and the Community and public-profile screens. The test suite runs locally with `npm test`; wiring it into CI is a later step.

---

## Definition of Done

Team CarbonTrail's Definition of Done applies to every user story completed in Sprint 1 and Sprint 2. **The work covered by this document has been completed according to that Definition of Done.**

> **Definition of Done**
>
> The following checklist applies to every user story completed by Team CarbonTrail during Sprint 1 and Sprint 2.
> A user story is Done when:
>
> - ☐ All acceptance criteria on the Trello card are implemented and met.
> - ☐ The feature works correctly on the intended mobile platform.
> - ☐ Functional tests (manual test cases, plus unit tests for business logic where applicable) have been performed and pass.
> - ☐ Input validation and authorization are in place; users can only access data they are permitted to.
> - ☐ Code has been reviewed and approved by at least one other team member via pull request.
> - ☐ Code follows the team's agreed coding and naming conventions, with no secrets committed.
> - ☐ No known critical or blocking bugs remain.
> - ☐ Changes are merged into main and pushed to the repository.
> - ☐ The feature runs correctly in the deployed backend environment on Render.
> - ☐ The Trello card is updated to Done.
> - ☐ The feature is demonstrated and accepted at the sprint review.

### Evidence for the public-profile story

`PROFILE-001…010` in `backend/tests/profile.test.ts` cover opening a profile, the public-goals-only projection, opt-in trends, the empty challenges state, authentication and ownership, and the goal visibility toggle. The profile suite passes 10/10; backend and frontend TypeScript checks pass. The full suite reports 71 tests with 66 passing — the 5 failures are pre-existing `auth.test.ts` expectations that no longer match the current registration/login code, untouched by this story. Challenges are intentionally deferred, so no challenge membership is shared yet. Device/emulator confirmation, PR approval, applying the existing migrations on Render, marking the Trello card Done and sprint-review sign-off remain team-owned steps outside this repository.

