# EPSimLab accounts

Release 0.3 adapted LucidTake's Better Auth/D1 account mechanisms into a separate EPSimLab account system. There are no program memberships, institution roles, migrated LucidTake users, shared passwords, or developer authentication bypasses.

## Using accounts

Release 0.4 is open for exploration at **https://app.epsimlab.com**, linked from **https://epsimlab.com**. No account is required to run cases, use the guided tour, pace, measure, or inspect anatomy.

- Choose **Sign in → Create an account** to register directly with a name, email, and 12–128-character password. No administrator approval is required.
- All self-registered accounts are ordinary users. Registration cannot claim an existing invited, disabled, removed, or owner identity. Email ownership is not verified at signup; the database does not mark these emails verified. Recovery remains administrator-assisted.
- **Save study** and **Export** require an account. A guest selecting either can register or sign in without losing the current recording. The study pauses during this flow and the requested save/export completes after sign-in.
- **Save study** stores commands and measurements in the account and on the current device. Saved studies open across devices. There is a 100-study limit, with each save at most 128 KiB. Deleting an account copy does not delete local copies.
- Profiles contain name, sign-in email, and optional phone. Activated emails are stable login identities.
- **Sessions** shows signed-in browsers and allows revocation. Password changes verify the current password and revoke other sessions.
- Signing out or switching between signed-in users clears the visible study workspace. Guest-to-account sign-in preserves the current study. Local account copies remain separated by user ID.
- Superusers may still create invitations. Links remain valid until activation or revocation; replacing a link revokes the previous one. Existing owner invitations remain valid on the new app domain, and links at the old Worker URL redirect there.

## Owner and administration

The protected owner account is for **kipp.william.johnson@gmail.com**. Its password is chosen by the owner during activation; none was copied from LucidTake or set by the agent. The private invitation is kept outside source and published assets in ignored `.auth/owner-production.txt`.

Superusers can invite people, search/edit profiles, promote/demote other accounts, disable/remove/restore access, replace/revoke invitations, revoke sessions, review access/password requests, and view an activity log. Removal is soft: access is revoked while study history remains. The owner cannot be disabled, removed, or demoted. Administrators cannot demote/disable themselves.

**Preview as user** reduces the current session's server permissions without changing identity or exposing anyone else's studies. Exit preview to manage accounts again.

Password recovery is administrator-assisted, matching LucidTake: the public form gives a generic receipt; a superuser verifies the requester and sets a temporary password for a regular user. All existing sessions are revoked, and the person must replace that password before accessing profile, studies, or other authenticated operations. Superusers change their own passwords. Recovery of a locked-out owner requires a trusted database operator; there is no public owner reset or first-user promotion endpoint.

Access/password request notifications use Cloudflare's `ACCOUNT_EMAIL` binding, restricted to the owner Gmail and `notifications@lucidtake.com`, with the display name **EPSimLab**. Requests are saved even if notification delivery fails. No live test email was sent, so mailbox delivery is not yet verified. Invitations and temporary passwords are shared manually, never included in notification messages.

## Implementation and boundaries

- Better Auth 1.7.2, Drizzle 0.45.2, Cloudflare D1. Each deployment needs its own random `BETTER_AUTH_SECRET` of at least 32 characters and exact `BETTER_AUTH_URL`.
- Password hashing and verification use Better Auth's crypto implementation. The raw Better Auth signup route is disabled. A bounded, rate-limited `/api/register` route atomically creates only regular users; invitations and superuser-managed credentials use separate explicit paths.
- Production session cookies are Secure and HttpOnly, with 14-day lifetime. Authorization reads current database account status and role. Role/access changes revoke existing sessions.
- Exact Origin and JSON checks protect mutations; authentication and public request endpoints have database-backed rate limits and input-size limits.
- Invitation tokens are 256-bit random values stored only as SHA-256 hashes. Links use a URL fragment that is removed from browser history on opening, keeping the token out of HTTP URLs and referrers. Activation uses an atomic conditional D1 batch to prevent concurrent reuse.
- Role previews are hashed tokens bound to a specific session. Studies are always scoped to the authenticated user. Client-supplied user IDs and account roles cannot change that identity.
- Auth API exposure is restricted to sign-in and sign-out. Account operations use explicit application routes. There is no impersonation, public admin API from Better Auth's plugin, email-header bypass, or seeded production password.
- API responses are private/no-store; service-worker caching excludes `/api/*`. No secrets, passwords, session tokens, or invitation tokens are written to application audit logs.

## Local setup and bootstrap

The local development API uses port 8787; Vite on 5173 proxies `/api`. `.dev.vars`, `.auth/`, and `.wrangler/` must remain ignored. Production has no `DEV_ORIGIN` setting.

Apply `worker/migrations/0001_accounts.sql` with `npm run db:migrate:local` or `npm run db:migrate:remote`. Never apply `worker/schema.sql` as an account migration: it describes the retired optional anonymous sync.

`node scripts/prepare-owner.mjs` prepares private SQL and an invitation file for the designated production owner. `--local` prepares a separate `owner@example.com` fixture. Files are created with exclusive-write protection and restrictive permissions. Bootstrap SQL inserts only when no owner or matching email exists, and never replaces an existing user's credentials. Apply only the intended file to the intended database. Reapplying an already-used bootstrap is not a recovery mechanism.

## Verification

The 27-test suite includes real Miniflare D1 account integration checks for concurrent/single-use activation, email binding, signup blocking, role forgery, CSRF, owner protection, preview enforcement, per-user study isolation, invitation revocation, private requests, forced password replacement, session invalidation, disabling/restoring accounts, rate limits, and size limits. Existing physiology and saved-session tests still pass.

Browser checks covered local activation, invitation creation, owner administration, user preview, account saving, persistence after reload, and a 390 × 844 layout without horizontal overflow. Physical iPhone keyboard and touch testing remains useful.

A live production fixture verified activation, Secure-cookie sign-in, identity, denial of administrator access to a normal user, study save/load, and logout. The fixture and its studies were removed. The real owner invitation was inspected successfully and remains unconsumed.

References: [Better Auth email/password](https://better-auth.com/docs/authentication/email-password), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), [Cloudflare send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/).

## Domain migration and publication

The existing D1 database, owner account, signing secret, cookie prefix, and saved studies are retained. Authentication now uses the exact `https://app.epsimlab.com` origin. Users sign in again on that origin; cookies and browser-local copies do not transfer across domains. No broad cross-subdomain cookies or trusted-origin wildcards were added.

The old manual access-request endpoint returns 410 with a direct-registration message. Historical requests remain available to administrators; password-help requests still work. No emails are sent by registration.
