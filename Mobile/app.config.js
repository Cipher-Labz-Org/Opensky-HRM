/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

const expo = appJson.expo;

module.exports = {
  expo: {
    ...expo,
    ios: {
      ...expo.ios,
      // iOS bundle ID: app.json only (com.cipherlabz.openskyhrm). Do not override from env.
      // Set APPLE_TEAM_ID in Codemagic (Apple Developer → Membership).
      ...(process.env.APPLE_TEAM_ID
        ? { appleTeamId: process.env.APPLE_TEAM_ID.trim() }
        : {}),
    },
  },
};
