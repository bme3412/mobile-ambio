const { withInfoPlist } = require("expo/config-plugins");
// Apple requires this declaration because the linked WebRTC SDK contains camera
// APIs, even though Ambio requests audio tracks only (video: false).
module.exports = (config) =>
  withInfoPlist(config, (mod) => {
    mod.modResults.NSCameraUsageDescription =
      "Ambio’s calling library includes camera support. French conversations use only your microphone; Ambio does not request camera access.";
    return mod;
  });
