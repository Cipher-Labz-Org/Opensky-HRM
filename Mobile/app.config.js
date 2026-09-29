/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

const expo = appJson.expo;

module.exports = {
  expo: {
    ...expo,
    ios: {
      ...expo.ios,
      // Set APPLE_TEAM_ID in Codemagic (10-character Team ID from Apple Developer → Membership).
      ...(process.env.APPLE_TEAM_ID
        ? { appleTeamId: process.env.APPLE_TEAM_ID.trim() }
        : {}),
    },
  },
};
