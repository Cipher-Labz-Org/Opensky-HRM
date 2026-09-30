/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

const expo = appJson.expo;

module.exports = {
  expo: {
    ...expo,
    ios: {
      ...expo.ios,
      // Bundle ID comes from app.json only (not process.env.BUNDLE_ID).
      // Set APPLE_TEAM_ID in Codemagic (Apple Developer → Membership).
      ...(process.env.APPLE_TEAM_ID
        ? { appleTeamId: process.env.APPLE_TEAM_ID.trim() }
        : {}),
    },
  },
};
