# UTMB / MyUTMB account integration

## Goal

Connect one NORTHBOUND user account to that user's MyUTMB account so NORTHBOUND can display and reconcile the user's UTMB Index, UTMB Score, Running Stones and race results.

## Verified product facts

- UTMB describes MyUTMB as the place to view detailed past-race statistics, UTMB Index, Running Stones and upcoming UTMB World Series events.
- UTMB's account onboarding explains that results are linked to a MyUTMB profile and that missing or incorrect result links must be resolved with UTMB.
- UTMB's privacy notice identifies Keycloak-based session cookies on `accounts.utmb.world`. This confirms the use of a managed authentication session, but does **not** establish that UTMB offers a public OAuth client, API, or permission for third-party automated access.

Official references:
- https://utmb.world/myutmb/get-started
- https://utmb.world/en/privacy-policy
- https://utmb.world/

## Security decision

**Never ask for, receive, log, or store a MyUTMB password in NORTHBOUND or Supabase.** Do not ask a user to paste passwords, cookies, access tokens, or browser session data into chat or app forms.

Preferred connection order:

1. Obtain written confirmation from UTMB of an approved API or partner integration and its permitted scopes.
2. If UTMB supports third-party OpenID Connect/OAuth clients, use Authorization Code Flow with PKCE and exact redirect URI registration. Use the system browser for sign-in; the password is entered only on a UTMB-controlled page.
3. Keep any confidential client secret and refresh token server-side only. Encrypt tokens at rest, restrict access to the owning NORTHBOUND user, redact credentials from logs, and support disconnect/revocation and data deletion.
4. If no approved API/OAuth access exists, use a public profile URL and user-triggered import of an official export or result file. Do not automate private-page scraping, replay session cookies, defeat bot protection, or circumvent access controls.

## Proposed user experience

- Settings / Integrations: **Connect MyUTMB**.
- Explain which data will be read before the user starts.
- Complete authentication only on the official UTMB domain if UTMB authorizes the flow.
- Show connection state, last successful sync, and per-field source/time.
- Import preview before changing the user's race history; match results to events/routes using stable identifiers where possible.
- Never overwrite manually entered results silently. Conflicts become review proposals.
- Disconnect action revokes provider authorization where supported and deletes stored credentials.
- If automatic access is unavailable, offer **Open MyUTMB** and an import-from-file flow instead.

## Data model (only after access is approved)

Store a provider connection record scoped to the authenticated NORTHBOUND user:
- provider = `utmb`
- provider subject / profile identifier
- granted scopes
- encrypted refresh token, only if officially issued
- access-token expiry, not the raw password
- last successful sync timestamp and sync status

Store imported result records with:
- provider result identifier (when available)
- event name and official result URL
- race date, distance/category, finish time and placing when supplied
- UTMB Index / UTMB Score values with their category and calculation date
- Running Stones value and observation date
- raw-source reference / provenance and last-seen timestamp

Use Row Level Security so a user can access only their own connection and imported records. Keep profile score, per-race score, UTMB Index and Running Stones as separate concepts; never infer or fabricate a missing value.

## Delivery phases and acceptance criteria

### Phase 1 — Provider approval and protocol discovery
- Ask UTMB whether an API or third-party OIDC/OAuth integration is available for this use case.
- Obtain endpoint documentation, allowed scopes, rate limits, branding/data reuse terms and revocation requirements.
- Do not ship a password form or private-data scraper.

### Phase 2 — Secure connection
- Implement only against documented, approved endpoints.
- Validate OAuth state, PKCE verifier, issuer, audience, signature, nonce and redirect URI as applicable.
- Store secrets only in Supabase server-side secrets / encrypted server-side storage; never in frontend code, local storage, or Git.
- Add RLS and disconnect/data deletion tests.

### Phase 3 — Read-only synchronization
- Fetch only fields explicitly authorized by UTMB.
- Validate and normalize provider responses; preserve provenance and observed timestamps.
- Deduplicate by provider result ID; otherwise use a cautious composite match and require review for ambiguous matches.
- Do not change a manually recorded result without explicit user confirmation.

### Phase 4 — NORTHBOUND display
- Display UTMB Index, best UTMB Score, per-race score and Running Stones separately.
- Show last sync time and stale/error state.
- Add a manual refresh action subject to provider rate limits.

## Current status

**Discovery/specification only. No UTMB credentials or account have been connected.** The public documentation confirms MyUTMB features and Keycloak session cookies, but no public developer API or third-party client registration has yet been verified. Implementation of private-account synchronization is blocked until UTMB confirms an approved access method.

## Request to UTMB

Please confirm whether UTMB provides a documented API or authorized third-party OpenID Connect/OAuth integration for a personal endurance-planning application. The intended scope is read-only access to the connected user's own public/profile statistics, UTMB Index, UTMB Scores, Running Stones and race results. Please provide technical documentation, client registration process, permitted scopes, rate limits, data-use terms and revocation requirements.
