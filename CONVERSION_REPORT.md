# Conversion report

## generated (72)

- src/lib/router-compat.tsx
- src/app/layout.tsx
- src/app/providers.tsx
- src/app/page.tsx
- src/app/not-found.tsx
- src/app/admin/layout.tsx
- src/app/admin/admin-shell.tsx
- src/app/login/page.tsx (+client/impl) -> views/Login
- src/app/setup/page.tsx (+client/impl) -> views/Setup
- src/app/portal/login/page.tsx (+client/impl) -> views/portal/PortalLogin
- src/app/portal/dashboard/page.tsx (+client/impl) -> views/portal/PortalDashboard
- src/app/intake/page.tsx (+client/impl) -> views/IntakeForm
- src/app/crs-calculator/page.tsx (+client/impl) -> views/CrsCalculator
- src/app/dashboard/page.tsx (+client/impl) -> views/Dashboard
- src/app/leads/page.tsx (+client/impl) -> views/Leads
- src/app/leads/[id]/page.tsx (+client/impl) -> views/leads/LeadDetailPage
- src/app/leads/[id]/legacy/page.tsx (+client/impl) -> views/LeadDetail
- src/app/applications/page.tsx (+client/impl) -> views/applications/ApplicationsPage
- src/app/clients/page.tsx (+client/impl) -> views/Clients
- src/app/clients/[id]/page.tsx (+client/impl) -> views/ClientDetail
- src/app/cases/page.tsx (+client/impl) -> views/Cases
- src/app/cases/[id]/page.tsx (+client/impl) -> views/CaseDetail
- src/app/tasks/page.tsx (+client/impl) -> views/Tasks
- src/app/calendar/page.tsx (+client/impl) -> views/Calendar
- src/app/documents/page.tsx (+client/impl) -> views/Documents
- src/app/calls/page.tsx (+client/impl) -> views/Calls
- src/app/knowledge/canon/page.tsx (+client/impl) -> views/KnowledgeCanon
- src/app/knowledge/ai/page.tsx (+client/impl) -> views/KnowledgeAI
- src/app/ircc/page.tsx (+client/impl) -> views/IRCCInbox
- src/app/inbox/page.tsx (+client/impl) -> views/Inbox
- src/app/messages/page.tsx (+client/impl) -> views/Messages
- src/app/workflows/page.tsx (+client/impl) -> views/Workflows
- src/app/reports/page.tsx (+client/impl) -> views/Reports
- src/app/followups/page.tsx (+client/impl) -> views/FollowupIntegrity
- src/app/invoices/page.tsx (+client/impl) -> views/Invoices
- src/app/payments/page.tsx (+client/impl) -> views/Payments
- src/app/my-commissions/page.tsx (+client/impl) -> views/MyCommissions
- src/app/finance/page.tsx (+client/impl) -> views/Finance
- src/app/digest/page.tsx (+client/impl) -> views/ManagerDigest
- src/app/manager/page.tsx (+client/impl) -> views/manager/ManagerDashboardPage
- src/app/hr/page.tsx (+client/impl) -> views/HR
- src/app/audit/page.tsx (+client/impl) -> views/Audit
- src/app/settings/page.tsx (+client/impl) -> views/Settings
- src/app/admin/page.tsx (+client/impl) -> views/admin/AdminHome
- src/app/admin/pending-approvals/page.tsx (+client/impl) -> views/admin/AdminPendingApprovals
- src/app/admin/countries/page.tsx (+client/impl) -> views/admin/AdminCountries
- src/app/admin/visa-categories/page.tsx (+client/impl) -> views/admin/AdminVisaCategories
- src/app/admin/visa-types/page.tsx (+client/impl) -> views/admin/AdminVisaTypes
- src/app/admin/office-hours/page.tsx (+client/impl) -> views/admin/AdminOfficeHours
- src/app/admin/sla-rules/page.tsx (+client/impl) -> views/admin/AdminSlaRules
- src/app/admin/lead-sources/page.tsx (+client/impl) -> views/admin/AdminLeadSources
- src/app/admin/agent-partners/page.tsx (+client/impl) -> views/admin/AdminAgentPartners
- src/app/admin/referral-partners/page.tsx (+client/impl) -> views/admin/AdminReferralPartners
- src/app/admin/document-checklists/page.tsx (+client/impl) -> views/admin/AdminDocumentChecklists
- src/app/admin/workflows/page.tsx (+client/impl) -> views/admin/AdminWorkflows
- src/app/admin/workflows/[subTypeId]/page.tsx (+client/impl) -> views/admin/AdminWorkflowEditor
- src/app/admin/upsell-triggers/page.tsx (+client/impl) -> views/admin/AdminUpsellTriggers
- src/app/admin/commission-rules/page.tsx (+client/impl) -> views/admin/AdminCommissionRules
- src/app/admin/templates/page.tsx (+client/impl) -> views/admin/AdminTemplates
- src/app/admin/staff/page.tsx (+client/impl) -> views/admin/AdminStaff
- src/app/admin/permissions/page.tsx (+client/impl) -> views/admin/AdminPermissions
- src/app/admin/integrations/page.tsx (+client/impl) -> views/admin/AdminIntegrations
- src/app/admin/backups/page.tsx (+client/impl) -> views/admin/AdminBackups
- package.json
- .npmrc
- next.config.mjs
- tsconfig.json
- .eslintrc.json
- tailwind.config.ts (content globs fixed)
- postcss.config.js
- vitest.config.ts
- README.md

## patched (8)

- AppLayout.tsx: 'import { Outlet } from "@/lib/router-compat";\n' -> ''
- AppLayout.tsx: 'export function AppLayout() {' -> 'export function AppLayout({ children }: { children?: ReactNo'
- AppLayout.tsx: '<Outlet />' -> '{children}'
- AdminLayout.tsx: 'import { NavLink, Outlet, useLocation, Navigate } from "@/li' -> 'import { NavLink, useLocation, Navigate } from "@/lib/router'
- AdminLayout.tsx: 'export function AdminLayout() {' -> 'import type { ReactNode as AdminChildren } from "react";\n\nex'
- AdminLayout.tsx: '<Outlet />' -> '{children}'
- client.ts: 'storage: localStorage,' -> 'storage: typeof window !== "undefined" ? window.localStorage'
- tailwind.config.ts: 'content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,ts' -> 'content: ["./src/**/*.{ts,tsx}"],'

## transformed (49)

- components/StepTemplateDialog.tsx
- components/NotificationBell.tsx
- components/ConvertLeadWizard.tsx
- components/NewClientDialog.tsx
- components/LeadProtectionFlags.tsx
- components/AdminLayout.tsx
- components/ProtectedRoute.tsx
- components/GlobalCreateFab.tsx
- components/NewLeadDialog.tsx
- components/NavLink.tsx
- components/AppSidebar.tsx
- components/CaseProtectionFlags.tsx
- components/NewCaseDialog.tsx
- components/AppLayout.tsx
- components/applications/CaseQuickViewSheet.tsx
- components/applications/CaseQuickActionsMenu.tsx
- components/lead-detail/ApplicationsPanel.tsx
- components/lead-detail/FamilyUnitCard.tsx
- components/family/FamilyUnitSheet.tsx
- pages/Tasks.tsx
- pages/CaseDetail.tsx
- pages/Cases.tsx
- pages/Calls.tsx
- pages/Invoices.tsx
- pages/LeadDetail.tsx
- pages/ExecutiveDashboard.tsx
- pages/Clients.tsx
- pages/IRCCInbox.tsx
- pages/Finance.tsx
- pages/Leads.tsx
- pages/ManagerDigest.tsx
- pages/Setup.tsx
- pages/Settings.tsx
- pages/ClientDetail.tsx
- pages/Login.tsx
- pages/Index.tsx
- pages/StaffDailyView.tsx
- pages/Inbox.tsx
- pages/NotFound.tsx
- pages/Calendar.tsx
- pages/HR.tsx
- pages/FollowupIntegrity.tsx
- pages/admin/AdminWorkflows.tsx
- pages/admin/AdminWorkflowEditor.tsx
- pages/admin/AdminHome.tsx
- pages/admin/AdminSlaRules.tsx
- pages/portal/PortalLogin.tsx
- pages/portal/PortalDashboard.tsx
- pages/leads/LeadDetailPage.tsx

## dropped (21)

- src/App.css — was never imported anywhere
- src/App.tsx — routes regenerated as src/app/** tree (see ROUTES in convert.py)
- src/vite-env.d.ts — Vite-only
- src/main.tsx — replaced by src/app/layout.tsx
- index.html — replaced by src/app/layout.tsx metadata + font links
- vite.config.ts — Vite removed
- vitest.config.ts — recreated (unchanged content) at project root
- tsconfig.app.json — merged into single Next tsconfig.json (loose flags preserved)
- tsconfig.node.json — Vite-only
- vercel.json — SPA rewrite obsolete; Next needs no rewrites
- bun.lock — npm project
- bun.lockb — npm project
- package-lock.json — regenerated on install
- package.json — rewritten for Next (all runtime deps preserved)
- eslint.config.js — rewritten without vite/react-refresh plugins
- src/main.tsx — replaced by src/app/layout.tsx
- src/App.tsx — routes regenerated as src/app/** tree (see ROUTES in convert.py)
- src/App.css — was never imported anywhere
- src/vite-env.d.ts — Vite-only
- .env — unused by code (supabase client hardcodes URL/key); Vite-only names
- README.md — rewritten

## copied (199 files)

See git for full list.