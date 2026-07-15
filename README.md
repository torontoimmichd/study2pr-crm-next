# Study2PR CRM — Next.js

Internal CRM for Study2PR (crm.study2pr.in). Next.js App Router + Supabase.
Converted from the original Vite + React SPA with identical page logic.

## Commands

- `npm install`
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run test` — vitest

## Structure

- `src/app/` — routes (thin wrappers; every page renders client-side, exactly like the original SPA)
- `src/views/` — the actual pages (formerly `src/pages/` in the Vite app, logic unchanged)
- `src/components/`, `src/hooks/`, `src/lib/`, `src/integrations/` — unchanged
- `src/lib/router-compat.tsx` — react-router API shim over next/navigation
- `supabase/` — edge functions + migrations (unchanged)

## Notes

- Supabase URL/anon key are hardcoded in `src/integrations/supabase/client.ts` (same as before).
- Sessions stay in localStorage — logins carry over per browser, no user re-auth needed beyond same-origin rules.
- Future work may move pages to server components one at a time; `router-compat` is only for ported code.
