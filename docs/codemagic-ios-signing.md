# Codemagic iOS code signing — OpenSky HRM

| Item | Value |
| --- | --- |
| **HRM bundle ID** | `com.cipherlabz.openskyhrm` |
| **Apple Team ID** | `XL576229TS` (Cipher Labz) |
| **Wrong profile (do not use for HRM)** | `OpenSky SFA AppStore Profile` → `com.openskylabs.sfa` |

`codemagic.yaml` uses **automatic** signing file selection:

```yaml
ios_signing:
  distribution_type: app_store
  bundle_identifier: com.cipherlabz.openskyhrm
```

Codemagic must have an **App Store** provisioning profile whose App ID is **`com.cipherlabz.openskyhrm`**. The SFA profile cannot sign the HRM app.

## Fix “No provisioning profile for bundle id com.cipherlabz.openskyhrm”

### Apple Developer

1. [Identifiers](https://developer.apple.com/account/resources/identifiers/list) — confirm **App ID** `com.cipherlabz.openskyhrm` exists (same as App Store Connect).
2. [Profiles](https://developer.apple.com/account/resources/profiles/list) → **+** → **Distribution** → **App Store Connect**.
3. Select App ID **`com.cipherlabz.openskyhrm`**, your **Apple Distribution** certificate, name it (e.g. `OpenSky HRM App Store`), **Generate**.

### Codemagic

1. **Team settings → Integrations → Developer Portal** — App Store Connect API key (for **Fetch profiles**).
2. **Code signing identities → iOS provisioning profiles → Fetch profiles**.
3. Under **App Store profiles**, select the row for **`com.cipherlabz.openskyhrm`**, set any **reference name**, **Download selected**.
4. Ensure **iOS certificates** includes your **Apple Distribution** cert (e.g. `OpenSky SFA Distribution P12` on the same team is fine).

Re-run **OpenSky HRM iOS** on **`master`**.

## Application env vars

- `app_store_credentials` — App Store Connect API key for TestFlight upload.
- `APP_STORE_APPLE_ID` — numeric Apple ID from App Store Connect (optional; build number fallback uses Codemagic `BUILD_NUMBER` if unset).
