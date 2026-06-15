# Personal Finance App — Feature Research & Plan

**Scope:** General budgeting/tracking app (competes with Monarch, Copilot, YNAB, Rocket Money, PocketGuard).
**Date:** June 2026

---

## Part 1 — Research Plan

### Where to look

| Source | Why | What it tells you |
|---|---|---|
| **App Store / Play Store reviews** of Monarch, Copilot, YNAB, Rocket Money, PocketGuard | Real complaints from paying users | Churn reasons, missing features, bugs |
| **Reddit** (r/personalfinance, r/budgeting, r/ynab, r/MonarchMoney) | Unfiltered, high-detail user opinion | "I switched because…", feature requests |
| **Comparison/review sites** (NerdWallet, WalletHub, Wall Street Survivor) | Aggregate strengths/weaknesses | Pricing, positioning, feature gaps |
| **Competitor changelogs & roadmaps** | What the market is actively building | Where the puck is going (AI, couples, open banking) |
| **Industry/market reports** (Business of Apps, CoinLaw, market-size reports) | Macro signal | Retention benchmarks, AI/gamification ROI |
| **Mint-shutdown migration content** | A cohort actively shopping for an app | What "free" users now refuse to tolerate (ads, data selling) |

### What to look for (indicators)

1. **Frequency of complaint** — how often a pain point recurs across reviews/threads. High frequency = high-value fix.
2. **Switching triggers** — the specific feature or failure that made someone change apps. These are make-or-break.
3. **Willingness to pay** — features people say they'd pay for vs. expect for free.
4. **Retention/engagement lift** — features with measured impact (e.g. AI +42%, gamified goals +32% day-30 retention).
5. **Table-stakes vs. differentiator** — is it something every app must have, or a wedge to stand out?
6. **Build cost vs. impact** — rough effort to ship relative to the value it creates.

### How to record

Keep a simple **scored backlog** (a spreadsheet works) with one row per feature idea:

`Feature | Source/evidence | Complaint frequency (H/M/L) | Switching trigger? (Y/N) | Impact (1–5) | Effort (1–5) | Category (table-stakes / differentiator / delight) | Notes`

Then sort by Impact ÷ Effort to get a build order. Tag each idea to a primary job-to-be-done ("see all my money," "stop overspending," "hit a goal," "do it with my partner").

---

## Part 2 — What the field is doing

The market got bigger and more competitive after Mint shut down (March 2024). Monarch, Copilot, YNAB, Rocket Money and Empower now compete primarily on **insight and AI**, not raw data display. Subscription is the dominant model — users learned from Mint that "free" meant their data sold ads, and a vocal segment now actively pays to avoid that.

Key signals from the research:

- **Auto-categorization accuracy is the retention floor.** ~92% out-of-the-box accuracy is roughly the bar; below it, users disengage.
- **Insights beat dashboards.** Apps that surface "restaurant spending up 40% vs. your average" outperform apps that just chart transactions.
- **AI and gamification have measured ROI** — AI recommendations ~+42% retention, gamified milestone goals ~+32%, personalized notifications ~3× weekly sessions.
- **Finance apps churn hard** — typical day-30 retention ~4%, but top apps hit 30–40%. First-session quality and onboarding are decisive.
- **Couples/shared budgeting** is an underserved, growing wedge (Monarch wins partly on this; several new apps target only couples).
- **Non-US bank linking is a gap** — only YNAB links UK/Canada/EU banks via Plaid among the big three. Relevant given you're EU-based.
- **The over-building trap:** developers race to add more integrations, asset types and charts; users mostly want the app to answer "am I okay, and what should I do?"

---

## Part 3 — Feature ideas (ranked)

Each idea: what it is → fit to a budgeting/tracking product → how to build it.

### Tier 1 — Table stakes (must ship, or you don't compete)

**1. Reliable account aggregation + high-accuracy auto-categorization**
*Elaboration:* Link banks/cards/investments and auto-label transactions at ≥90% accuracy with easy one-tap correction that the model learns from.
*Fit:* This is the spine of a tracking app — everything else sits on top of clean, categorized data.
*Build:* Aggregation via an open-banking/data provider (Plaid, or Tink/GoCardless for EU coverage). Start categorization with a rules engine + merchant-name lookup; layer an ML model later. Make manual correction trivial and feed it back as training signal.

**2. Manual-entry + CSV import as first-class, not an afterthought**
*Elaboration:* Let users add transactions by hand and bulk-import bank CSVs, working fully without bank linking.
*Fit:* Captures the privacy-conscious / no-bank-login cohort (a real post-Mint segment) and covers banks the aggregator misses — important in the EU.
*Build:* Clean quick-add form, CSV mapper with column auto-detection and a saved template per bank. Low effort, high goodwill.

**3. Budgets with real-time "safe to spend"**
*Elaboration:* Per-category budgets plus a single headline number: what's left to spend after bills and goals.
*Fit:* Directly serves "stop overspending," the core JTBD. PocketGuard's whole pitch is this number.
*Build:* Budget = income − committed bills − goal contributions − spent-so-far, recalculated on each sync. Surface one big number on the home screen.

### Tier 2 — Differentiators (where you win)

**4. Proactive insight engine ("am I okay?")**
*Elaboration:* Auto-generated, plain-language alerts: anomaly spend, trend shifts, upcoming bills, subscription creep, "you'll be short before payday."
*Fit:* This is the current battleground. Turns a passive ledger into something that earns a daily open — and drives the retention that subscriptions need.
*Build:* A rules layer first (period-over-period comparisons, z-score anomaly detection, recurring-charge detection), then an LLM to phrase insights conversationally. Ships incrementally; each rule is independently valuable.

**5. AI assistant / natural-language Q&A**
*Elaboration:* "How much did I spend on eating out last month?" / "Can I afford a €600 flight?" answered in chat.
*Fit:* Lowers the effort of getting value to near zero — the #1 reason casual users disengage. Measured ~+42% retention for AI-recommendation apps.
*Build:* Translate questions to queries over the user's transaction DB (text-to-query or a constrained tool layer), with the LLM only formatting results. Keep money math deterministic in code, not in the model.

**6. Subscription & recurring-bill detection**
*Elaboration:* Auto-find recurring charges, flag price hikes and unused/forgotten subscriptions, with renewal reminders.
*Fit:* Concrete, money-saving "wow" moment in the first session — exactly the first-session value that fixes day-1 churn. This is Rocket Money's hook.
*Build:* Cluster transactions by merchant + amount + cadence to detect recurrence; alert on amount changes. Pure data analysis, no third party needed.

**7. Shared / couples mode**
*Elaboration:* Two people, one shared view, with per-person privacy controls on individual accounts.
*Fit:* Proven wedge (Monarch wins on it; whole apps exist just for couples) and it doubles your acquisition surface.
*Build:* Multi-user households with role/permission flags per account, real-time sync so both see the same numbers. Design the data model for this early — it's painful to retrofit.

### Tier 3 — Delight / retention (add once core is solid)

**8. Goals with micro-milestones + gamification**
*Elaboration:* Savings goals broken into small steps ("12% complete," "€200 to next milestone") with streaks and progress nudges.
*Fit:* Gives a reason to come back between paydays; measured ~+32% retention from gamified goals.
*Build:* Goal model + scheduled progress notifications. Keep it tasteful — over-gamifying a finance app reads as childish to many adults.

**9. Trustworthy, no-ads privacy stance as a feature**
*Elaboration:* Explicit "we don't sell your data, no ads" position, plus export-your-data and easy delete.
*Fit:* Directly answers the loudest post-Mint grievance and justifies a subscription price.
*Build:* Mostly product/policy + a clean data-export endpoint. Cheap to build, strong in marketing.

**10. EU/multi-currency & local bank coverage**
*Elaboration:* Solid open-banking coverage for EU banks and multi-currency handling.
*Fit:* A real gap among the US-centric leaders, and natural given you're EU-based — a defensible niche to start from.
*Build:* Use an EU-focused aggregation provider (Tink, GoCardless/Nordigen, Salt Edge) and store currency per transaction with FX at transaction date.

---

## Recommended build order

1. **Ship the spine first:** aggregation + categorization + manual/CSV + budgets with "safe to spend" (Tier 1).
2. **Then your wedge:** pick one of subscription detection *or* the insight engine as the first-session "wow," plus the AI assistant to lower effort-to-value.
3. **Then retention:** goals/gamification and couples mode.
4. **Position throughout** on privacy/no-ads and EU coverage as your differentiation vs. US incumbents.

The trap to avoid: piling on integrations and chart types. The winning apps answer *"am I okay, and what should I do?"* — optimize for that, not feature count.

---

## Sources

- [Key Features Every Personal Finance App Needs in 2026 — Financial Panther](https://financialpanther.com/key-features-every-personal-finance-app-needs-in-2026/)
- [Personal Finance Apps in the US in 2026 — TechBullion](https://techbullion.com/personal-finance-apps-in-the-us-in-2026-how-budgeting-saving-and-credit-building-tools-are-actually-used/)
- [Best Budget Apps for 2026 — NerdWallet](https://www.nerdwallet.com/finance/learn/best-budget-apps)
- [YNAB vs Monarch vs Copilot (90-day test) — GenWealth](https://genwealth.io/articles/ynab-vs-monarch-vs-copilot-i-tested-all-3-for-90-days-heres)
- [Rocket Money vs Monarch (+ YNAB, Simplifi, Copilot) — Wall Street Survivor](https://www.wallstreetsurvivor.com/rocket-money-vs-monarch/)
- [Finance App Benchmarks 2026 — Business of Apps](https://www.businessofapps.com/data/finance-app-benchmarks/)
- [Personal Finance App Industry Statistics 2026 — CoinLaw](https://coinlaw.io/personal-finance-app-industry-statistics/)
- [Gen Z Fintech User Retention / Gamification — StriveCloud](https://www.strivecloud.io/blog/gen-z-fintech-user-retention)
- [Best Free Budget-App Alternatives After Mint — DefineYourDollars](https://blog.defineyourdollars.com/news/best-free-budget-app-alternatives-after-mint-2025/)
- [Mint Alternatives — Finder](https://www.finder.com/budgeting/mint-alternatives)
- [Personal finance sucks — Peekablog](https://peekablog.substack.com/p/personal-finance-sucks)
