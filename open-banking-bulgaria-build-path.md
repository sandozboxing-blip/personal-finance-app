# Open Banking in Bulgaria — Build Path for Your Finance App

A practical implementation guide. Default recommendation: **GoCardless Bank Account Data** (the former Nordigen API) as your aggregator. It covers Bulgaria, has a free tier, and — critically — lets you operate under *its* AISP license so you don't need your own.

---

## 0. The two decisions before you write code

**Decision 1 — Don't get your own license (yet).**
To read bank data under PSD2 you must be a registered **AISP** (Account Information Service Provider). Getting your own AISP authorization from the БНБ (Bulgarian National Bank) is a months-long, capital-and-compliance-heavy process. You skip all of it by using an aggregator that is already a licensed AISP and acts as your regulated intermediary. GoCardless/Nordigen is licensed in Latvia (by the FCMC) and passported into 31 European countries including Bulgaria — you build on top of their license. Only consider your own license much later, if data costs at scale justify it.

**Decision 2 — Pick the aggregator.**
All of these reach Bulgarian banks over the same PSD2 rails; they differ on price, coverage breadth and extras:

| Provider | Why pick it | Watch-out |
|---|---|---|
| **GoCardless (Nordigen)** | Free tier (~50 connections/mo), widest EU coverage (~2,500 banks), simple REST API, no own-license needed | Free tier is rate-limited; data-only (AIS), no payments |
| **Tink** (Visa) | Enterprise-grade, AIS + PIS, strong data enrichment | Pricier, heavier onboarding |
| **Salt Edge** | Broad global + EU coverage, AIS + PIS, good docs | Paid |
| **TrueLayer / Plaid** | Also cover BG, strong if you expand beyond EU | Paid, more US/UK-centric |

Recommendation: **start on GoCardless free tier**, keep the integration behind your own abstraction layer so you can swap providers later.

---

## 1. Architecture overview

```
[Your app UI]
     │  user taps "Connect bank"
     ▼
[Your backend]  ──(1) get token──────────►  GoCardless Bank Account Data API
     │           ──(2) list BG banks─────►        │
     │           ──(3) create agreement──►        │
     │           ──(4) create requisition►        │ returns a hosted "link" URL
     │                                            │
     ▼                                            ▼
[Redirect user] ───────────────►  Bank's own login + SCA (2-factor consent)
     │  user approves, bank redirects back to your redirect_uri
     ▼
[Your backend]  ──(5) list accounts──────►
                ──(6) balances / transactions / details►
                ──(7) store, categorize, refresh daily──►
```

Keep all secret keys and tokens **server-side only**. The client never touches the aggregator API directly.

---

## 2. The integration flow (GoCardless Bank Account Data)

Endpoints below use base `https://bankaccountdata.gocardless.com/api/v2/`. The sequence is the standard Nordigen flow.

**Step 0 — Sign up.** Create an account in the GoCardless Bank Account Data portal, accept the AISP/agent terms, and generate a **secret_id** and **secret_key**. Build against the **Sandbox** institution first (`SANDBOXFINANCE_SFIN0000`).

**Step 1 — Get an access token.**
`POST /token/new/` with `{ secret_id, secret_key }` → returns `access` (valid ~24h) and `refresh` tokens. Refresh via `POST /token/refresh/`. Cache and reuse; don't mint one per request.

**Step 2 — List Bulgarian institutions.**
`GET /institutions/?country=bg` → array of banks, each with an `id` (e.g. UniCredit Bulbank, DSK Bank, UBB, Postbank), `name`, `logo`, and `transaction_total_days` (how much history that bank exposes). Render these as the bank picker.

**Step 3 — (Optional) Create an end-user agreement.**
`POST /agreements/enduser/` with `institution_id`, `max_historical_days` (e.g. 90 or up to the bank's max, often 730), `access_valid_for_days` (max 90 under PSD2), and `access_scope` (`["balances","details","transactions"]`). Lets you control history depth and consent window. Skip it to accept defaults.

**Step 4 — Create a requisition (the consent link).**
`POST /requisitions/` with `institution_id`, your `redirect` URL, a unique `reference` (your internal user/session id), the `agreement` id (if created), and `user_language`. Returns a requisition `id` and a hosted **`link`** URL.

**Step 5 — Send the user to the bank.**
Redirect the user to that `link`. They log into their bank and complete **SCA** (Strong Customer Authentication — the bank's own 2-factor consent). The bank then redirects to your `redirect` URL.

**Step 6 — Retrieve the linked accounts.**
`GET /requisitions/{id}/` → `accounts: [account_id, ...]`. Persist these account ids against your user.

**Step 7 — Pull the data.** Per account id:
- `GET /accounts/{id}/details/` → IBAN, currency, account holder name, product.
- `GET /accounts/{id}/balances/` → balance(s) with type and reference date.
- `GET /accounts/{id}/transactions/` → booked + pending transactions: amount, currency, dates, counterparty/merchant name, remittance info. Up to ~24 months history depending on the bank.

**Step 8 — Keep it fresh.** Banks cap how often you can call (typically ~4 pulls/account/day under PSD2). Run a daily scheduled job to fetch new transactions; cache aggressively and never re-pull on every screen view.

---

## 3. Consent & SCA lifecycle (the part that bites people)

- **90-day rule:** PSD2 access consent expires every ~90 days. After that, balances/transactions calls start returning errors until the user re-authenticates. **Build the re-consent flow from day one** — detect the expired status, notify the user, and re-run Steps 4–6.
- **Status handling:** A requisition moves through statuses (created → linked → expired/suspended). Watch for `EXPIRED` and bank error codes and surface a clear "reconnect your bank" prompt.
- **Read-only:** AIS access is read-only — you can never move money with it. (Moving money needs PIS, a separate scope you don't need for a tracker.)

---

## 4. Data model (minimum)

```
User ─< BankConnection (requisition_id, institution_id, status, consent_expires_at)
            └─< Account (gc_account_id, iban, currency, name, type)
                   ├─< Balance (amount, type, reference_date)
                   └─< Transaction (gc_tx_id, booking_date, value_date,
                                     amount, currency, counterparty_name,
                                     raw_description, category[your own])
```

Notes: store the bank's transaction id to dedupe on refresh; store `raw_description` untouched and put your categorization in a separate field; keep `consent_expires_at` to drive re-auth reminders; store amounts in minor units (integer cents) to avoid float errors, and keep `currency` per transaction since you'll have BGN, EUR, and others.

---

## 5. Compliance & data-protection checklist

- **GDPR applies fully.** Get explicit consent, state purpose, allow data export and deletion, store only what you need.
- **Encryption:** TLS in transit, encryption at rest for tokens and financial data; secrets in a vault, not in code.
- **Data minimization:** only request the scopes you use. A tracker needs balances + transactions + details, nothing more.
- **Note for 2026:** the EU is moving from PSD2 toward **PSD3 + the Financial Data Access (FIDA) regulation**, which will broaden "open finance." Your aggregator absorbs most of this change, but design your abstraction layer so a framework shift doesn't force a rewrite.
- BGN→EUR: Bulgaria is on track to adopt the euro; build multi-currency and FX-at-transaction-date in from the start so a currency switch is a non-event.

---

## 6. Pricing reality

- **GoCardless/Nordigen:** free production tier (~50 bank connections/month), then paid as you scale; bank-imposed rate limits apply regardless of tier.
- Plan for the day you outgrow the free tier — model cost per connected account per month, since that's what aggregators charge on.

---

## 7. Recommended phased plan

1. **Spike (days):** GoCardless sandbox → run Steps 1–7 against the sandbox bank from your backend. Prove the full token→requisition→transactions loop.
2. **One real bank (week):** connect your own account at a major Bulgarian bank (UniCredit Bulbank or DSK), confirm real history depth and field quality, build the redirect/callback handling.
3. **Connection lifecycle:** add the daily refresh job, dedupe, and the 90-day re-consent flow + reminders.
4. **Coverage + fallback:** add the full BG institution picker; ship **CSV import / manual entry** for banks the aggregator misses or that fail SCA.
5. **Abstraction + scale:** wrap the provider behind your own interface so Tink/Salt Edge can be swapped or added; revisit pricing and (only if justified) your own AISP license.

The whole point: an aggregator turns "integrate every Bulgarian bank under a banking license" into "call one REST API under someone else's license." Start there.

---

## Sources

- [Open Banking in Bulgaria — OpenBankingTracker](https://www.openbankingtracker.com/country/bulgaria)
- [Bulgaria Open Banking / PSD2 status — Fiskil](https://www.fiskil.com/open-finance-tracker/bulgaria)
- [Allianz Bank Bulgaria PSD2 / BISTRA standard](https://www.allianz.bg/en_BG/individuals/PSD2.html)
- [GoCardless Bank Account Data — Overview](https://developer.gocardless.com/bank-account-data/overview)
- [GoCardless Bank Account Data — Quickstart Guide](https://developer.gocardless.com/bank-account-data/quick-start-guide/)
- [GoCardless Bank Account Data — Endpoints](https://developer.gocardless.com/bank-account-data/endpoints/)
- [GoCardless Bank Account Data — Sandbox](https://developer.gocardless.com/bank-account-data/sandbox/)
- [GoCardless acquires Nordigen (coverage: 2,300+ banks, 31 countries)](https://gocardless.com/blog/gocardless-acquire-open-banking-platform-nordigen/)
- [What are AISP & PISP in open banking — GoCardless](https://gocardless.com/guides/posts/what-is-tpp-in-open-banking)
- [Nordigen/GoCardless pricing — Nordigen KB](https://ob.helpscoutdocs.com/article/136-pricing)
