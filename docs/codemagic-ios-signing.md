# Codemagic iOS — OpenSky HRM

| Item | Value |
| --- | --- |
| **App name (Expo)** | OpenSky HRM |
| **iOS bundle ID** | `com.cipherlabz.openskyhrm` |
| **Apple Team ID** | `XL576225TB` |
| **Not this app** | OpenSky SFA → `com.openskylabz.sfa` |

Source of truth for bundle ID: **`Mobile/app.json`** → `expo.ios.bundleIdentifier` (not `codemagic.yaml` alone). YAML `BUNDLE_ID` must match; CI verifies after `expo prebuild`.

## Codemagic signing (fixes “No matching profiles found for bundle identifier”)

1. **Apple Developer** → Profiles → **+** → App Store Connect → App ID **`com.cipherlabz.openskyhrm`** → your Distribution cert → Generate.
2. **Codemagic** → Team settings → Code signing identities → **iOS provisioning profiles** → **Fetch profiles** → select HRM profile → reference name **`OpenSky_HRM_AppStore`** → **Download selected**.
3. Certificate **`OpenSky SFA Distribution P12`** (same team) is already referenced in `codemagic.yaml`.

```yaml
ios_signing:
  provisioning_profiles:
    - OpenSky_HRM_AppStore
  certificates:
    - OpenSky SFA Distribution P12
```

Until step 2 is done, the build fails at **Set up code signing identities** or at script step 9.

## Environment group

Group name: **`app_store_connect`**

| Variable |
| --- |
| `APP_STORE_CONNECT_ISSUER_ID` |
| `APP_STORE_CONNECT_KEY_IDENTIFIER` |
| `APP_STORE_CONNECT_PUBLISHER_PRIVATE_KEY` |

Optional: `APP_STORE_APPLE_ID` — numeric Apple ID for **OpenSky HRM** in App Store Connect.

## TestFlight “Feedback Email” errors

If publishing fails on beta review contact info, complete **TestFlight → Test Information** for **OpenSky HRM** in App Store Connect, or set `submit_to_testflight: false` until ready.
