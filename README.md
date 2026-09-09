# Study2PR Console — source (v5, phase 9)

Next.js 16 (App Router, JavaScript). **Every screen reads the database.** There is no
seed file, no mock array and no invented number anywhere in this folder.

## Run it locally
    npm install
    npm run dev        # http://localhost:3000

Two environment variables are required, in `.env.local` locally and in Vercel on
Production, Preview and Development:

    NEXT_PUBLIC_SUPABASE_URL=https://hetmpmpaxnchykyjapbx.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...

## The one rule this codebase keeps
The browser never touches a table. `anon` and `authenticated` have no INSERT, UPDATE,
DELETE or TRUNCATE on anything, and no SELECT either. Every read and every write goes
through a `SECURITY DEFINER` function that re-checks `app.can_access(...)` for the
signed-in member. If a screen needs data, it needs a function — not a policy.

## Where things are
- `lib/supabase.js`     — the single client. `configured` is false when the keys are missing.
- `components/Session.js`, `components/Gate.js` — sign-in; nothing renders until there is a session.
- `components/Store.js` — the only data layer. One function per RPC, plus `read(screen)`
                          for the eight read-only boards. Nothing is held in memory and
                          pretended to be saved.
- `components/Screen.js` — the shared shape of a read-only screen: `useScreen`, `Head`,
                          `Loading`, `Failed`, `Waiting`, `Table`, `Stat`, `Bars`.
                          `Waiting` is the honest empty state: it names the table that is
                          empty and what fills it.
- `components/Shell.js` — left rail and top bar. The rail collapses to icons and expands
                          on hover; the pin state is remembered in `localStorage`.
                          Nav badges show only counts that came from `fn_nav_counts`.
- `components/AskWhen.js` — parser for the assessment workbook's "Asked when" grammar.
- `app/globals.css`     — every colour is a CSS variable in `:root` and the
                          `prefers-color-scheme:dark` block.

## Screens and the function behind each
| Screen | Reads | Writes |
|---|---|---|
| Dashboard | `fn_dashboard` | — |
| Inbox | `fn_inbox_board` | — |
| Leads | `fn_leads_board`, `fn_lead`, `fn_lead_refs`, `fn_catalogue` | `fn_create_lead`, `fn_lead_event`, `fn_lead_move`, `fn_delete_lead` |
| Assessments | `fn_assessment_form`, `fn_assessments_board`, `fn_assess` | `fn_assessment_save` |
| Clients | `fn_clients_board` | — |
| Files | `fn_files_board` | — |
| Documents | `fn_document_plan`, `fn_documents_board`, `fn_document_files` | `fn_documents_request`, `fn_document_decision`, `fn_document_attach` |
| Appointments | `fn_calendar`, `fn_appointment_types` | `fn_appointment_book`, `fn_appointment_status`, `fn_appointment_type_save` |
| Money | `fn_money_board` | — |
| Reports | `fn_reports` | — |
| HR | `fn_hr_board` | `fn_member_responsibility` |
| Control Centre | `fn_rules_board`, `fn_policy_sources` | `fn_rule_verify`, `fn_rule_deactivate` |
| Settings | `fn_settings` | — |

## Palette
Four colours, each carrying a meaning rather than decorating:

| Token | Light | Dark | Carries |
|---|---|---|---|
| accent | `#1D4ED8` text, `#60A5FA` fill | `#60A5FA` | primary actions, active tabs, new business |
| care / plum | `#6D28D9` | `#C4B5FD` | client care lane, quiet period, watching |
| warn | `#C2410C` | `#FDBA74` | waiting, chasing, deadline approaching |
| bad | `#BE185D` | `#F9A8D4` | blocked, breached, overdue |
| ok | `#1F7A57` | `#6FCFA0` | clear, accepted, QC passed |

Residence banding uses three of these across every module: **ONSHORE** (in the
destination country), **HOME** (in their own passport country), **THIRD COUNTRY**
(neither), and a muted **—** when passport or residence has not been recorded.

## Removed in phase 9
`content/data.js`, `content/eligibility.js`, `components/Role.js`,
`app/inbox/[id]/page.js`, `app/files/[id]/page.js`. They were the last of the mock.
The two empty `[id]` folders left behind are ignored by git.
