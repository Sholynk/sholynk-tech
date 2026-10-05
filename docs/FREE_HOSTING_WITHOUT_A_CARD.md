# Hosting when the Oracle card check fails

Oracle Cloud Always Free is still the recommended target for this application because it is the only free tier that combines a long-running Node process, a real persistent disk, and no monthly bill. Sign-up, however, requires a payment card that Oracle can verify, and that check fails for many West African cards.

This document records the exact card rules, the checks that resolve most failures, and what to do if none of them work.

## What Oracle actually requires

From Oracle's own sign-up documentation and Free Tier FAQ:

- Oracle accepts **credit cards and debit cards that function like credit cards**.
- Oracle does **not** accept debit cards that require a PIN, virtual cards, single-use cards, or prepaid cards.
- The card is used for **identity verification**, not billing. Oracle may place a small temporary authorization hold, typically about US$1, which the bank releases in roughly three to five days.
- The card is not charged unless the account is deliberately upgraded to a paid plan.
- Always Free resources stay available after the trial credit expires, provided usage remains inside the free allowances.

Sources:

- [Sign Up for the Free Oracle Cloud Promotion](https://docs.oracle.com/en-us/iaas/Content/GSG/Tasks/signingup_topic-Sign_Up_for_Free_Oracle_Cloud_Promotion.htm)
- [OCI Cloud Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)

In practice a Lagos-based sign-up succeeds when the card is a **USD-denominated, credit-class card issued by a bank or licensed card provider**, with international online payments and 3-D Secure enabled.

### Checks that resolve most failures

Work through these in order. Change one thing at a time and give each attempt a few minutes.

1. **Confirm the card class.** A naira debit card with a Visa or Mastercard logo is not automatically a "card that functions like a credit card". Prepaid wallets, gift cards, single-use virtual cards and cards that require a PIN at the terminal are rejected outright. A domiciliary or dollar card issued by a commercial bank is the type that works.
2. **Enable international online transactions.** This is a separate switch from normal card usage at many Nigerian banks. Ask the bank to enable international e-commerce on the *specific* card, for the specific currency, with merchant-initiated and recurring transactions permitted.
3. **Enable 3-D Secure (OTP or app approval).** Oracle's payment processor runs 3DS. If the OTP never arrives, the approval page times out, or the bank has no 3DS path for foreign merchants, the attempt cannot complete. Stay on the page during the redirect.
4. **Match your bank records exactly.** Name, phone number, and billing address must match what the bank holds. The account email and phone are also used for identity signals. For the state field, use the abbreviation rather than the full name.
5. **Turn off VPNs, proxies and mobile data carriers that geolocate elsewhere.** A VPN is one of the most common triggers for silent rejection.
6. **Do not rotate through cards.** Repeated attempts with different cards, names or addresses look like fraud to the processor and make later manual review harder.
7. **Confirm the address you typed is the address the card is registered to**, and that the postal code is the one the bank has on file rather than a nearest landmark or a different format.
8. **Watch for the bank-side block.** Some banks decline first-time foreign merchant authorizations by default. Ask support to allow the pending authorization from Oracle's processor and to check the declined-transaction log after your next attempt.
9. **Contact Oracle support chat and ask for manual verification.** This is the documented escalation path when sign-up fails and is a legitimate request, not a workaround. State that the card is a bank-issued card, that the bank confirms no block, and that the automatic verification keeps failing. Users in Oracle community threads report that manual verification resolves it.
10. **Wait and retry later.** Oracle's processor is inconsistent in this area. A completely unchanged setup sometimes succeeds hours or days later, especially with a different browser or a clean session.

If the bank cannot enable international online payments or cannot issue a dollar card, this route is closed and the alternatives below apply.

## Alternative free targets, evaluated against this application

This application needs three things at once: a long-running Node process, a writable filesystem for SQLite and uploads, and a way to keep both across restarts and code deployments.

| Target | Card needed | Persistent storage | Runs this code as-is | Verdict |
|---|---|---|---|---|
| Oracle Cloud Always Free VM + block volume | Yes, credit-class card | Yes, real block volume | Yes | Best fit. Blocked only by card verification. |
| Cloudflare Workers + D1 | No | Yes, D1 is managed SQLite | No, needs a compatibility port | Viable and genuinely free, but a real migration project. |
| Render Free web service | No | No, filesystem is ephemeral | Partly | Ruled out: SQLite and uploads are lost on restart, redeploy or spin-down, and free Render Postgres expires after 30 days. |
| Bonto | No | Vendor states storage persists across restarts and deploys | No | Ruled out on resources: the free plan provides 256 MB storage while this project's production install of `node_modules` alone is roughly 175 MB. |
| Railway | No to start | Volumes on paid plans | Partly | $5 one-time credit, then a small monthly credit. Not a standing free home. |
| Fly.io | Yes | Volumes, but no free tier for new accounts | Partly | Free allowance no longer available to new sign-ups. |
| Koyeb / Northflank | Yes | Yes | Yes | Card required, so it does not solve the blocker. |
| Small paid VM (any provider) | Yes | Yes | Yes | Around US$4–6 per month with no code changes. The pragmatic fallback. |

### Why Cloudflare is the only serious no-card persistent option

Cloudflare's Workers Free plan needs no payment method and includes:

- 100,000 Worker requests per day, 10 ms of CPU time per request.
- D1, a managed SQLite database: 5 GB storage, 5 million rows read per day, 100,000 rows written per day, with Time Travel point-in-time recovery for 7 days on the free plan.

Sources:

- [Cloudflare Workers pricing and limits](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)

That is a genuine free, persistent home for the database, and Cloudflare publishes an official tutorial for running Express on Workers. It is still a port rather than a redeploy, because the following parts of this codebase cannot run on the Workers runtime:

| Current dependency or behaviour | Why it breaks on Workers | Porting direction |
|---|---|---|
| `node:sqlite` (`cms/lib/db.js`) | No native SQLite file access on Workers | Bind D1 and rewrite the data layer against the D1 API |
| Local file uploads written to `/data/uploads` through `multer` | No writable local disk | Store media in Cloudflare R2 and keep only its metadata in D1 |
| `sharp` image resizing and intrinsic size detection | Native binary, unavailable | Resize during upload through a Workers-compatible image API, or pre-size at authoring time |
| `pdf-parse` for the PDF import autofill flow | Node-stream/native dependency | Move that flow to a small separate worker/service, or drop it |
| Request-time server-side rendering of full article pages | 10 ms CPU per request on the free plan | Render from D1 with a lighter template, or cache rendered pages |
| `pdf-parse`-style long-running work and any future background jobs | CPU limits per invocation | Use Cron Triggers and Queues instead of in-process work |

A port is feasible, and the API-first structure of this application makes it smaller than it looks, but it should be scheduled as a dedicated migration with its own test pass rather than attempted as a quick fix.

### Recommended order of action

1. Re-attempt Oracle verification with a bank-issued USD or domiciliary card that has international online payments and 3DS enabled, using the checks above, then escalate to Oracle support chat for manual verification.
2. If the bank cannot enable international transactions on any card, and keeping the application unchanged matters most, move to a small paid VM. The Oracle deployment guide in this repository applies to any Ubuntu VM with only the provider-specific networking and storage sections changed.
3. If the requirement is strictly "free and no card", schedule the Cloudflare Workers + D1 port. Keep the current VM/Docker deployment as the reference implementation and keep the SQLite schema as the D1 schema, since D1 is SQLite.

## What must not change regardless of host

Whichever target is chosen, the data rules from the storage map still apply:

- The live database and uploads must live on storage that survives redeploys; a container filesystem is never that.
- Secrets belong in the platform's secret store, never in the repository or an image layer.
- `CMS_DB_FILE` and `CMS_UPLOAD_DIR` must point at the durable location.
- Backups must be copied outside the host account, because a lost account loses its own storage.

See [GITHUB_AND_CLOUD_STORAGE_MAP.md](GITHUB_AND_CLOUD_STORAGE_MAP.md) for the full placement rules.
