# Public demo deployment

## Current addresses · release 0.4

- Landing page: https://epsimlab.com
- Public simulator: https://app.epsimlab.com
- Source: https://github.com/kippjohnson/epsimlab
- `www.epsimlab.com` redirects to the landing page. The old Worker address redirects to the simulator, including existing invitation links.
- Simulator Worker: `ep-lab-simulator`, version `04090674-ed58-4617-8b64-483da8a5f89a`, configured in `wrangler.jsonc`.
- Landing Worker: `epsimlab-site`, version `156a2b35-8c25-48b5-98bc-3d95a4518830`, configured in `wrangler.landing.jsonc`.
- Existing D1 accounts/studies and the signing secret are retained. Accounts use the new exact app origin; existing users sign in again on this domain.
- Anyone can explore. Self-registration is open, and saving/exporting progress requires an account. Registration cannot claim the reserved owner identity or grant superuser access.
- GitHub Actions checks tests, builds and both Worker bundles. Live publishing uses `npm run deploy:all` with the authorized local Cloudflare login; no Cloudflare token is stored in GitHub.

Local development uses `dev.host=127.0.0.1:8787` so Wrangler does not rewrite local Origin headers to the production route hostname. This setting does not change the production trusted origin.

Verification: 27 automated tests passed; desktop and 390 px landing-page checks passed; browser guest-to-registration preserved a paused study at exactly 01:41.500 and saved it to the new account. No source credentials or private invitation links are included in Git.

## Earlier releases

- URL: https://ep-lab-simulator.kippwjo.workers.dev
- Deployed: September 8, 2026
- Cloudflare Worker: `ep-lab-simulator`
- Initial version: `bf8925d1-4731-4e73-936d-aaa2aefd4995`
- Configuration: `wrangler.jsonc`
- Content: diagnostic simulator, schematic 3D heart/catheters, and mobile study workspace.

The owner explicitly approved publishing this demo publicly. Workers Static Assets serves `dist/`; `/api/*` routes run through the Worker. The initial release had no database. Release 0.3 adds dedicated account storage in D1 (see below). No GitHub repository or deployment automation has been created.

## Verification

- Existing production build and 14 tests passed before deployment.
- Wrangler 4.92.0 deployment dry run passed.
- Cloudflare confirmed asset upload and deployment success.
- Opened the public HTTPS page in the browser and confirmed live signal acquisition.
- Default pacing induced the model's expected 190 bpm / 315 ms rhythm.
- Expanded 3D heart/catheters rendered, with no browser errors or warnings recorded during the checks.
- At a 390 px viewport, mobile workspace navigation and 3D access were available without horizontal document overflow.

Physical iPhone testing is the next check. Browser-local studies are independent between the desktop preview and iPhone Safari.

## Updates

Run `npm run deploy` from this project using the authorized Cloudflare login. This rebuilds the app and uploads the Worker and static assets to the same URL. Review changes and run relevant checks before updating the public demo.

## Five-case learning update · September 8, 2026

- Version: `7c177437-39a3-40bb-a027-e15b0352456a`.
- Release: 0.2.0; AVNRT, AVRT, focal AT, typical flutter, AF, seven-step tour, glossary, Guided/Challenge modes, and case-specific evidence feedback.
- Validation: 24 automated tests, TypeScript/production/standalone builds, Wrangler dry-run, desktop/phone browser interaction checks. Public application loads 0.2 and its guided tour; browser warning/error log was empty in the production smoke check.
- URL unchanged: https://ep-lab-simulator.kippwjo.workers.dev
- Assets-only storage configuration unchanged; old AVNRT saves remain compatible.

## Accounts update · September 8, 2026

- Version: `6690f532-88fc-4f0d-9971-35587ee1637d`; release 0.3.0, physiology engine 0.2.0.
- D1: `ep-lab-accounts`, ID `780b2048-3ea1-4b67-851d-ce7d0c8f55b5`, binding `DB`, migration `0001_accounts.sql` applied.
- Separate production `BETTER_AUTH_SECRET` stored using Wrangler secrets; local secret is independent and ignored. Production origin is the HTTPS Worker URL; no development-origin exception is deployed.
- Protected owner invitation: `kipp.william.johnson@gmail.com`, awaiting the owner's private password activation.
- `ACCOUNT_EMAIL` uses LucidTake's existing notification sender and is restricted to the owner's Gmail. Delivery was not tested by sending mail.
- Verified: all 25 tests, typecheck/build, Worker binding types and dry-run, desktop/390 px browser account workflows, and live production activation/sign-in/private study save/load/logout with an ephemeral user subsequently removed.
- Worker startup reported 96 ms. The existing large JavaScript-bundle warning remains; account support does not change the simulator's clinical validation status.
- See [account operations and security](accounts.md).
