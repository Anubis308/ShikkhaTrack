# ShikkhaTrack

Coaching-centre student support desk on SELISE Blocks. React 18 + Vite + TypeScript. Auth is Blocks IAM (hosted OIDC plus email/password signup for students). Cases, roster, staff, AI logs, and at-risk scores live in the Blocks Data Gateway. There is no custom backend.

Every Blocks API call goes through a single `createBlocksClient()` instance in `src/lib/blocks/client.ts`. OpenAI is the only non-Blocks HTTP call, and every classify / draft / at-risk request is written to the `AiCallLog` collection with a 30-call hourly cap.

## Blocks project

- Tenant / `x-blocks-key`: `Dbe0eefff372a4ed3a61e3eeb8e0d454f`
- App domain: `https://drdajd.slsblx.com`
- API: `https://blocksapi.slsblx.com`
- Public OIDC client id is in `.env` / `.env.example`

## Setup

```bash
npm install
npm run cert
npm run dev
```

Add to your hosts file as Administrator:

```
127.0.0.1  drdajd.slsblx.com
```

Open `https://drdajd.slsblx.com:5173` (not localhost). Trust the cert printed by `npm run cert`.

Set `VITE_OPENAI_API_KEY` in `.env` for AI classify, draft reply, and at-risk scoring. That key is prefixed `VITE_` so Vite embeds it in the browser bundle — it is extractable from the client. The app mitigates spend with `AiCallLog` rate limiting (`gpt-4o-mini`, 30 calls/hour). A later phase can move the call behind a Blocks Cloud Function.

## First-run roles

1. Sign in (or create a student account at `/signup` and activate from email).
2. If you have no role yet you land on **Onboarding**:
   - Students enter a roster roll (demo: `HSC-1187` after seed).
   - The first staff member can **Become branch manager**.
3. As manager, open **Dashboard → Seed demo data** (6 batches, demo students, three cases for HSC-1187 including the hardship + 3rd-in-6-weeks script).
4. Add support staff and teachers on **Team** using the IAM user id from each person's Profile page. Teachers must have a batch.
5. Intake is staff-only (`/cases/new`). Students can follow up on their own cases. Teachers only see academic cases (`ClassAccess`, `ExamSchedule`) for their own batch, and never hardship/fee/scholarship cases.

## Access rules

Gateway collections are **authenticated User** (not Public). Teacher batch + academic-only and student own-record rules are enforced in the query layer and the case detail page. Blocks Data Gateway row-level policies cannot currently express “own batch AND academic categories only” in one rule, so that part is defense-in-depth in the app, not a hidden-button-only UI.

## Demo script

The incoming message:

> sir ami 3 din class miss korechi, baba hospital e, installment ta 5 tarikh e dite parbo na, ar physics er sir recording di na — roll HSC-1187

Staff logs it, AI classifies Fees + ClassAccess with hardship, drafts a hardship-extension reply, staff edits the date, sends. The inbox shows this as the third case in six weeks. Switch to a teacher login: fee/hardship cases for that student are hidden.

## What's included

- `/login`, `/signup`, `/activate`, `/forgot-password`, `/reset-password`, `/login/callback`
- `/onboarding` — claim student roll or bootstrap manager
- `/inbox`, `/cases/new`, `/cases/:id`
- `/my-requests` (student), `/teacher` (teacher), `/dashboard` (manager)
- `/roster`, `/team`, `/profile`

IAM hosted login uses a Secure httpOnly cookie. Session is `blocksClient.auth.userInfo()`. Logout calls `blocksClient.auth.logout()`.
