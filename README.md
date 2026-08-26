# OpenSky HRM

Enterprise HRIS (Human Resource Information System) with a **Next.js** frontend and a **.NET 8** REST API backed by **PostgreSQL**

---

## Tech stack

### Frontend (`Frontend/`)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| UI | React 18, TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Components | Radix UI |
| Rich text | TipTap |
| Dates | date-fns, react-day-picker |
| PDF export | jsPDF, jspdf-autotable |
| Hosting | Vercel |

### Backend (`Backend/`)

| Layer | Technology |
|-------|------------|
| Runtime | .NET 8 (ASP.NET Core Web API) |
| Architecture | Clean / layered (4 projects) |
| ORM | Entity Framework Core 8 |
| Database | PostgreSQL (Npgsql) |
| Auth | JWT Bearer, BCrypt |
| Background jobs | Hangfire (PostgreSQL storage) |
| API docs | Swagger (Swashbuckle) |
| Email | SendGrid or SMTP |
| Excel | ClosedXML |
| Container | Docker |

---

## Architecture

```
Browser (Next.js)
       │
       ├─ Local dev:  /hrm-backend/*  →  http://127.0.0.1:5000
       ├─ Vercel:     /api/*           →  upstream API (API_URL)
       └─ Tenant host: direct call to customer backend URL
       │
       ▼
OpenSkyHRM.Api          ← Controllers, JWT, CORS, Swagger, Hangfire
       │
OpenSkyHRM.Application  ← Services, interfaces, background jobs
       │
OpenSkyHRM.Persistence  ← EF Core, migrations, seeders, auditing
       │
OpenSkyHRM.Domain       ← Entities, enums, shared abstractions
       │
       ▼
PostgreSQL (app data + hangfire schema)
```

### Backend projects

| Project | Responsibility |
|---------|----------------|
| `OpenSkyHRM.Domain` | Core entities and enums |
| `OpenSkyHRM.Persistence` | `AppDbContext`, migrations, seeders |
| `OpenSkyHRM.Application` | Business logic services and Hangfire jobs |
| `OpenSkyHRM.Api` | HTTP API, authentication, startup configuration |

### Frontend layout

| Path | Purpose |
|------|---------|
| `app/` | Next.js routes (marketing, login, `/app/*` modules) |
| `components/` | UI, forms, navigation, module widgets |
| `lib/` | API client, utilities, licensing helpers |
| `config/` | Routes, tenants, constants |

### Deployment model

- **One customer per database** — each instance has its own PostgreSQL database and backend
- **Shared frontend** on Vercel; tenant hostnames map to dedicated backend URLs via `Frontend/config/tenant-backends.json`.
- **Module licensing** is enforced per instance (see `Backend/docs/licensing.md`).

---

## Prerequisites

- **Node.js** 20+
- **.NET SDK** 8.0+
- **PostgreSQL** 14+ (local or remote)
- **Git**

Optional 

- Docker (API container or local MailHog/Mailpit for email testing)
- SendGrid API key (production email)

---

## Local development

### 1. Database

Create a PostgreSQL database (defaults in `appsettings.Development.json`):

```
Host=localhost;Port=5432;Database=openskyhrm_dev;Username=postgres;Password=postgres
```

The API creates the database and applies EF migrations on startup when PostgreSQL is reachable.

### 2. Backend

```bash
cd Backend/OpenSkyHRM.Api
dotnet restore
dotnet run
```

API runs at **http://localhost:5000**. Swagger UI: **http://localhost:5000/swagger**.

On first run the API seeds:

- Default security roles
- Bootstrap admin user (see [Default login](#default-login) below)
- Licensing catalog and entitlements
- Demo data (Development environment only)

#### Optional: local SMTP (MailHog / Mailpit)

Copy the example file and run a local SMTP catcher:

```bash
cp appsettings.Local.example.json appsettings.Local.json
```

Or use the `http-MailHog` launch profile in `launchSettings.json`.

See `Backend/Scripts/setup-local-smtp.ps1` for a helper script.

#### Optional: SendGrid

```bash
dotnet user-secrets set SendGrid:ApiKey "<your-key>"
```

Or set `SENDGRID_API_KEY` / `SendGrid__ApiKey` in the environment.

### 3. Frontend

```bash
cd Frontend
npm install
cp .env.example .env.local
npm run dev
```

App runs at **http://localhost:3000**.

By default, omit `NEXT_PUBLIC_API_URL` in `.env.local` — the frontend proxies API calls through `/hrm-backend/*` to `http://127.0.0.1:5000` (see `next.config.js`).

To point directly at the API instead:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:5000
```

### Default login

After a fresh database seed (Development):

| Field | Value |
|-------|-------|
| Username | `Admin` |
| Password | `Admin@123` |

Change this password after first login in any non-local environment.

---

## Environment variables

### Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Browser-facing API base URL (optional locally; uses proxy if unset) |
| `API_URL` | Server-side upstream for Vercel rewrites |
| `NEXT_PUBLIC_USE_SAME_ORIGIN_API` | Force same-origin `/api/*` proxy |
| `NEXT_PUBLIC_*_API_URL` | Per-tenant backend overrides for local hostname testing |

### Backend

| Variable / config key | Description |
|-----------------------|-------------|
| `ConnectionStrings:DefaultConnection` | PostgreSQL connection string |
| `ConnectionStrings:HangfireConnection` | Hangfire storage (defaults to app DB) |
| `Jwt:Key`, `Jwt:Issuer`, `Jwt:Audience` | JWT signing and validation |
| `SendGrid:ApiKey` or `Smtp:Host` | Outbound email |
| `Cors:Origins` | Allowed frontend origins |

Use `appsettings.Local.json` (gitignored) for machine-specific overrides. Copy from `appsettings.Local.example.json`.

---

## HR modules

| Group | Modules |
|-------|---------|
| Core | Dashboard, People Hub, Employee 360, Recruitment, Employee Tasks |
| Workforce | Leave, Approvals, Attendance, Payroll, Performance, Learning |
| Intelligence | Reports, Org Structure, Analytics, Settings, Billing |
| Admin | User management, email templates, email delivery log |

Navigation and API endpoints are gated by **RBAC roles** and **module licensing**.

---

## Background jobs (Hangfire)

Recurring jobs registered at startup:

- Biometric ADMS processing
- Attendance reconciliation
- Leave accrual
- Payroll batch export
- Report generation
- Analytics snapshot refresh
- Training, license expiry, and birthday reminders

Hangfire uses a dedicated `hangfire` schema in PostgreSQL.

---

## Docker

Build and run the API from `Backend/`:

```bash
docker build -f OpenSkyHRM.Api/Dockerfile -t openskyhrm-api .
docker run -p 8080:8080 \
  -e ConnectionStrings__DefaultConnection="Host=host.docker.internal;Port=5432;Database=openskyhrm_dev;Username=postgres;Password=postgres" \
  openskyhrm-api
```

---

## Production deployment

### Frontend (Vercel)

1. Connect the `Frontend/` directory to Vercel.
2. Set `API_URL` to the production backend URL.
3. For tenant domains, register hostname → backend mappings in `config/tenant-backends.json`.

### Backend (IIS / Docker / Kestrel)

1. Publish the API: `dotnet publish -c Release`.
2. Configure connection strings, JWT key, CORS origins, and email provider.
3. See example configs: `appsettings.Production.*.example.json`.

Each customer instance gets its own database and backend deployment.

---

## Testing

```bash
cd Backend/OpenSkyHRM.Application.Tests
dotnet test
```

---

## Project structure

```
OpenskyHRM/
├── Frontend/                 # Next.js app
├── Backend/
│   ├── OpenSkyHRM.Api/
│   ├── OpenSkyHRM.Application/
│   ├── OpenSkyHRM.Persistence/
│   ├── OpenSkyHRM.Domain/
│   ├── OpenSkyHRM.Application.Tests/
│   └── docs/                 # Licensing, customer reset, etc.
├── vercel.json
└── README.md
```

---

## Further reading

- [Per-instance licensing](Backend/docs/licensing.md)
- [Customer data reset](Backend/docs/customer-reset.md)

---

## License

Proprietary — OpenSky HRM. All rights reserved.
