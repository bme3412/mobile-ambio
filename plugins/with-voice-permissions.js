const { withInfoPlist } = require("expo/config-plugins");
// The upstream WebRTC plugin adds a camera usage string even when passed false.
// Ambio creates audio tracks only, so omit camera access from the generated app.
module.exports = (config) =>
  withInfoPlist(config, (mod) => {
    delete mod.modResults.NSCameraUsageDescription;
    return mod;
  });
