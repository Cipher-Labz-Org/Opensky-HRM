# Codemagic iOS code signing — OpenSky HRM (Mobile)

| Item | Current value |
| --- | --- |
| **iOS bundle ID (Mobile / Codemagic)** | `com.openskylabz.sfa` |
| **Apple Team ID** | `XL576225TB` |
| **Codemagic profile** | `OpenSky SFA AppStore Profile` |
| **Codemagic certificate** | `OpenSky SFA Distribution P12` |

The iOS binary is signed with the **SFA** App Store profile already in Codemagic. That profile is for **`com.openskylabs.sfa`**, not `com.cipherlabz.openskyhrm`.

**App Store Connect** must have an app whose bundle ID is **`com.openskylabs.sfa`** (or you must change signing — below).

## Switch back to `com.cipherlabz.openskyhrm`

1. Apple Developer → create **App Store** provisioning profile for App ID **`com.cipherlabz.openskyhrm`**.
2. Codemagic → **Fetch profiles** → download that profile.
3. In repo: set `Mobile/app.json` → `ios.bundleIdentifier` to `com.cipherlabz.openskyhrm` and `codemagic.yaml` → `BUNDLE_ID` to match.
4. Point `ios_signing.provisioning_profiles` at the new profile reference (or use `distribution_type: app_store` + `bundle_identifier`).

## Env vars

- `app_store_credentials` — TestFlight upload API key.
- `APP_STORE_APPLE_ID` — numeric Apple ID for the **same bundle ID** you ship (optional).
