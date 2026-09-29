# Codemagic iOS code signing — OpenSky HRM

Bundle ID (do not change): `com.cipherlabz.openskyhrm`

`codemagic.yaml` expects these **reference names** in Codemagic (must match exactly):

| Reference name | What to upload/fetch |
| --- | --- |
| `OpenSky SFA AppStore Profile` | App Store provisioning profile (must be for bundle **`com.cipherlabz.openskyhrm`**) |
| `OpenSky_HRM_Distribution` | Apple **Distribution** certificate (.p12 in Codemagic) |

If Codemagic lists a different profile reference, update `provisioning_profiles` in `codemagic.yaml` to that **exact** string (Team settings → Code signing identities → iOS provisioning profiles).

## 1. App Store Connect API key (Team)

**Team settings → Integrations → Developer Portal → Manage keys**

Add the `.p8` key (Issuer ID, Key ID). Required to **Fetch certificate** and **Fetch profiles**.

Application env group `app_store_credentials` is still used for TestFlight upload at the end of the build.

## 2. Distribution certificate

**Team settings → codemagic.yaml settings → Code signing identities → iOS certificates**

- **Fetch certificate** → select **Apple Distribution** for team **CIPHER LABZ (PRIVATE) LIMITED**, or **Generate certificate** if none exists.
- Set reference name: **`OpenSky_HRM_Distribution`**
- If you generated a new cert, download once and **upload** it to Codemagic with that reference name.

## 3. App Store provisioning profile

**Code signing identities → iOS provisioning profiles → Fetch profiles**

Under **App Store profiles**, find:

| Field | Required value |
| --- | --- |
| Bundle ID | `com.cipherlabz.openskyhrm` |
| Type | App Store |
| Certificate | Apple Distribution (green check in Codemagic) |
| Team | CIPHER LABZ (PRIVATE) LIMITED |

Select it, set the reference name to match `codemagic.yaml` (currently **`OpenSky SFA AppStore Profile`**), click **Download selected**.

The reference name is only a Codemagic label; the profile must still be an **App Store** profile for **`com.cipherlabz.openskyhrm`**. A profile for another bundle ID (e.g. another OpenSky app) will fail at Xcode signing.

### If the bundle ID is missing in Fetch profiles

Create the profile in Apple Developer:

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/profiles/list) → **Profiles** → **+**
2. **Distribution** → **App Store Connect**
3. App ID: **`com.cipherlabz.openskyhrm`**
4. Select your **Apple Distribution** certificate
5. Name the profile (e.g. `OpenSky HRM App Store`), **Generate**, download `.mobileprovision`
6. In Codemagic: **Upload** profile; use the same reference name as in `codemagic.yaml`

## 4. Application env vars

In the Opensky-HRM app on Codemagic, set:

- `APP_STORE_APPLE_ID` — numeric Apple ID from App Store Connect (App Information), not the bundle id.

## 5. Rebuild

After certificate + profile show in Code signing identities with the reference names above, start **OpenSky HRM iOS** on branch **master** (or your default branch).

Do not rename references in YAML without updating Codemagic UI to match.
