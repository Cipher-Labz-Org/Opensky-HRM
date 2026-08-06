const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <!-- Local Kestrel / LAN IP backends use HTTP during development. -->
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">127.0.0.1</domain>
    <domain includeSubdomains="true">10.0.2.2</domain>
  </domain-config>
</network-security-config>
`;

/**
 * Ensures Android allows HTTP (cleartext) to LAN/dev backends.
 * usesCleartextTraffic alone is not enough on some OEM/API levels when a
 * networkSecurityConfig is present or defaults restrict cleartext.
 */
function withCleartextTraffic(config) {
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const xmlDir = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/res/xml");
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, "network_security_config.xml"), NETWORK_SECURITY_CONFIG);
      return cfg;
    },
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$["android:usesCleartextTraffic"] = "true";
    app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    return cfg;
  });

  return config;
}

module.exports = withCleartextTraffic;
