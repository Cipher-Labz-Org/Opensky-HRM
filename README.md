# OpenSky HRM – SaaS Application Architecture

Next.js 14+ (App Router) project with TypeScript and Tailwind. Structure is prepared for a scalable SaaS platform; authentication, database, API routes, and tenant provisioning are **not** implemented.

## Tech Stack

- **Next.js 14+** (App Router)
- **TypeScript**
- **React Server Components** (default where possible)
- **Tailwind CSS** (design tokens aligned with `hris_ui_pack` reference HTML)

## Recommended Project Folder Structure

```
OpenskyHRM/
├── app/
│   ├── layout.tsx                 # Root layout + LayoutSwitcher
│   ├── globals.css                # Tailwind + CSS variables
│   ├── page.tsx                   # Homepage (/)
│   ├── pricing/
│   │   └── page.tsx               # /pricing
│   ├── contact/
│   │   └── page.tsx               # /contact
│   ├── dashboard/
│   │   └── page.tsx               # /dashboard
│   ├── settings/
│   │   └── page.tsx               # /settings
│   ├── billing/
│   │   └── page.tsx               # /billing
│   └── tenant/
│       └── [tenant]/              # Placeholder for multi-tenant
│           ├── layout.tsx         # Tenant layout (renders children only)
│           ├── page.tsx           # /tenant/[id]
│           ├── dashboard/
│           │   └── page.tsx
│           └── settings/
│               └── page.tsx
├── components/
│   ├── layout/
│   │   └── LayoutSwitcher.tsx     # Picks marketing vs app shell by path
│   ├── ui/                        # Buttons, cards, inputs
│   ├── navigation/                # Sidebar, topbar
│   ├── dashboard/                 # Dashboard-specific widgets
│   └── forms/                     # Form fields, sections
├── config/
│   ├── app.ts                     # App config
│   ├── routes.ts                  # Route path constants
│   └── constants.ts               # APP_NAME, SUPPORT_EMAIL, DEFAULT_THEME
├── contexts/
│   └── tenant-context.tsx         # Placeholder tenant context
├── hooks/
│   ├── use-auth.ts                # Placeholder
│   ├── use-tenant.ts              # Placeholder
│   └── use-theme.ts               # Placeholder
├── store/
│   └── index.ts                   # Global state placeholder
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Layout Architecture

| Layout        | Use case                          | Notes                                      |
|---------------|------------------------------------|--------------------------------------------|
| **Root**      | Font (Inter), metadata, global CSS | Single root layout for the app             |
| **Marketing** | Home, Pricing, Contact             | Public header + footer, no sidebar         |
| **App**       | Dashboard, Settings, Billing       | Sidebar + main content (aligned with HRIS UI) |
| **Tenant**    | `/tenant/[tenant]/...`             | Placeholder; only renders children         |

The root layout uses **LayoutSwitcher** (client component) to pick marketing vs app shell by pathname. Marketing = header + footer; App = sidebar + main.

## Shared Components

- **`components/ui`** – `Card`, `Button` (reusable, Tailwind + CSS variables).
- **`components/navigation`** – `AppSidebar`, `AppTopbar` (used by app layout).
- **`components/dashboard`** and **`components/forms`** – Directories ready for future widgets and form components.

## Configuration Layer

- **`config/constants.ts`** – `APP_NAME`, `SUPPORT_EMAIL`, `DEFAULT_THEME`.
- **`config/routes.ts`** – Central route paths for links and navigation.
- **`config/app.ts`** – Aggregates app config for future env/feature flags.

## Tenant Context (Placeholder)

- **`contexts/tenant-context.tsx`** – `TenantProvider`, `useTenantContext()`, `TenantInfo` type. No tenant loading or theme yet; structure only.

## Hooks (Placeholders)

- **`hooks/use-auth.ts`** – Returns `{ user, isAuthenticated, isLoading }` (all placeholder).
- **`hooks/use-tenant.ts`** – Wraps tenant context.
- **`hooks/use-theme.ts`** – Returns `{ theme, setTheme }` (placeholder).

## State Management

- **`store/index.ts`** – Empty placeholder for future global state (e.g. Zustand/Redux).

## Architectural Decisions

1. **LayoutSwitcher** – One root layout; a client component picks marketing shell (header/footer) or app shell (sidebar + main) from the pathname so `/`, `/pricing`, `/contact` get the public shell and `/dashboard`, `/settings`, `/billing` get the app shell.
2. **Tenant under `tenant/[tenant]`** – Prepares for per-tenant routes; layout is minimal so it can later load tenant, theme, and data scope.
3. **Server components by default** – Pages and layouts are RSC unless they need client state or hooks.
4. **Config and routes in `config/`** – Single place for app constants and route paths to keep navigation and env-driven config consistent.
5. **UI aligned with `hris_ui_pack`** – CSS variables and Tailwind match the reference HTML (sidebar, cards, topbar, colors) for a consistent look.

## What Is Not Implemented

- Authentication  
- Database  
- API routes  
- Backend services  
- Tenant provisioning  
- Subdomain / wildcard DNS / domain detection  

## Running the Project

From the project root (the folder that contains `package.json`):

```bash
npm install
npm run dev
```

Then open in your browser: **http://localhost:3000**

- **Home:** http://localhost:3000  
- **Marketing:** http://localhost:3000/pricing, http://localhost:3000/contact  
- **App (with sidebar):** Open **http://localhost:3000/app** or **http://localhost:3000/app/dashboard**, then use the sidebar:
  - **Core:** Dashboard, People Hub, Employee 360, Recruitment, Onboarding
  - **Workforce:** Leave & Absence, Time & Attendance, Payroll Bridge, Performance, Learning & Skills
  - **Intelligence:** Org Structure, Analytics, Policy & Settings, Billing
- **Short URLs** (`/dashboard`, `/people`, etc.) redirect to `/app/dashboard`, `/app/people`, etc. via `next.config.js`.
- **Tenant placeholder:** http://localhost:3000/tenant/acme  

If the page is blank, hard-refresh (Ctrl+Shift+R or Cmd+Shift+R) or try a different browser.
