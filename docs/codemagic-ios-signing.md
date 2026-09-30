# Codemagic iOS — OpenSky HRM

| Item | Value |
| --- | --- |
| **App name (Expo)** | OpenSky HRM |
| **iOS bundle ID** | `com.cipherlabz.openskyhrm` |
| **Apple Team ID** | `XL576225TB` |
| **Not this app** | OpenSky SFA → `com.openskylabz.sfa` |

Source of truth for bundle ID: **`Mobile/app.json`** → `expo.ios.bundleIdentifier`. YAML `BUNDLE_ID` must match; CI verifies after `expo prebuild`.

## Codemagic signing

In **`codemagic.yaml`**, use automatic App Store matching (no manual `provisioning_profiles` / `certificates` lists):

```yaml
ios_signing:
  distribution_type: app_store
  bundle_identifier: com.cipherlabz.openskyhrm
```

In **Codemagic → Code signing identities**, keep an App Store profile for **`com.cipherlabz.openskyhrm`** (e.g. `OpenSky_HRM_AppStore_2026`) and a valid Distribution certificate. The SFA profile (`com.openskylabz.sfa`) can stay on the team; CI selects by `bundle_identifier`.

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
