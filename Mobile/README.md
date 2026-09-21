# OpenSky HRM Mobile

React Native + Expo mobile app for employee and manager self-service against the existing OpenSky HRM .NET API.

## Features

- **Connect**: Scan company QR from Settings (or enter backend URL manually)
- **Auth**: Sign in, change password, forgot password
- **Profile**: View/edit contact details, upload photo
- **Leave**: Balances, apply (with medical PDF when required), history
- **Attendance**: Clock in/out with location, monthly records and summary
- **Approvals** (managers): Pending leave approve/reject
- **Notifications**: Inbox with unread badge (polling)
- **Payslips**: List and detail (JSON line items)

## Prerequisites

- Node.js 20+
- Expo CLI / EAS CLI for store builds
- Running OpenSky HRM API (default local: `http://127.0.0.1:5000`)

## Local development

```bash
cd Mobile
npm install
npm start
```

Use Expo Go or a development build on a device/emulator.

### First launch

1. Open **Settings → Connect mobile app** in the web admin and scan the QR code, **or**
2. Enter your backend URL manually (e.g. `http://10.0.2.2:5000` for Android emulator → host machine)
3. Sign in with your HRIS credentials

## Project structure

```
Mobile/
  app/                 Expo Router screens
  src/
    api/               HTTP client + endpoint modules
    components/ui/     Shared UI kit
    config/            Constants
    store/             Zustand (auth, tenant config)
    theme/             Design tokens
    types/             DTOs mirrored from backend
    utils/             JWT, permissions, formatting
```

## Backend endpoints used

| Area | Routes |
|------|--------|
| Connect | `GET /api/mobile/connection-info`, `GET /api/mobile/connection-qr` |
| Auth | `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/branding` |
| Profile | `GET/PUT /api/Employees/{id}`, `POST /api/Employees/{id}/photo` |
| Leave | `/api/leave/balances`, `/api/leave/types`, `/api/leave/requests` |
| Attendance | `POST /api/Attendance/punch`, `GET /api/Attendance` |
| Approvals | `POST /api/leave/requests/{id}/approve|reject` |
| Notifications | `/api/notifications`, `/api/notifications/unread-count` |
| Payslips | `/api/Payroll/statements/employee/{id}`, `/api/Payroll/statements/{id}` |

## EAS Build (App Store / Play Store)

1. Install EAS CLI: `npm i -g eas-cli`
2. Log in: `eas login`
3. Configure project ID in `app.config.ts` (`extra.eas.projectId`) via `eas init`
4. Build:
   - Preview APK (sideload): `eas build --profile preview --platform android`
   - Production AAB (Play Store): `eas build --profile production --platform android`
   - Production APK: `eas build --profile production-apk --platform android`
   - iOS + Android: `eas build --profile production --platform all`
5. Submit:
   - `eas submit --platform ios`
   - `eas submit --platform android`

### Profiles (`eas.json`)

| Profile | Purpose |
|---------|---------|
| `development` | Dev client, internal distribution |
| `preview` | Internal QA APK |
| `production` | Play Store AAB with auto version increment |
| `production-apk` | Signed production APK (sideload / non-Play) |

## Configuration

- **Tenant URL**: Stored in SecureStore after QR scan; not hardcoded
- **JWT**: ~8h lifetime; 401 clears session (no refresh token)
- **Module gating**: Tabs hidden when module not in `user.licensedModules`
- **API public URL**: Set `Mobile:PublicApiBaseUrl` in backend `appsettings.json` when behind a reverse proxy

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm run android` | Open on Android |
| `npm run ios` | Open on iOS (macOS required for native build) |
| `npm run build:aab` | Production Android App Bundle (`.aab`) |
| `npm run build:apk` | Preview APK |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
