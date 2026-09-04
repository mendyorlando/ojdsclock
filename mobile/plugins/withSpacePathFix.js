const { withXcodeProject } = require("@expo/config-plugins");

// This project's path (".../Clocking In App/webapp/mobile") has spaces in
// it, which breaks an unquoted variable in Expo's own generated
// "Bundle React Native code and images" Xcode build phase: it runs the
// resolved react-native-xcode.sh path via unquoted backtick command
// substitution, so bash word-splits on the spaces and fails with
// "No such file or directory: /Users/.../Documents/Claude". Fixes it by
// capturing the resolved path into a quoted variable first. Runs after
// every `expo prebuild` since ios/ is regenerated (and gitignored) each
// time - without this, the iOS build fails immediately for anyone
// working from a path with spaces in it.
//
// Uses withXcodeProject (not withDangerousMod) so this runs after the
// phase Expo itself adds actually exists in the in-memory project - a
// raw-file dangerous mod runs too early to see it. The `xcode` package
// preserves this field's own internal escaping as literal backslash
// characters rather than fully decoding it, so the needle/replacement
// below intentionally contain literal `\"` / `\n` two-character
// sequences (not real quote/newline characters) to match that.
const NEEDLE =
  '`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`';

const REPLACEMENT =
  'RN_XCODE_SCRIPT=\\"$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\"\\n\\"$RN_XCODE_SCRIPT\\"';

function withSpacePathFix(config) {
  return withXcodeProject(config, (config) => {
    const phases = config.modResults.hash.project.objects["PBXShellScriptBuildPhase"] || {};

    for (const key of Object.keys(phases)) {
      const phase = phases[key];
      if (!phase || typeof phase.shellScript !== "string") continue;
      if (!phase.shellScript.includes(NEEDLE)) continue;

      phase.shellScript = phase.shellScript.split(NEEDLE).join(REPLACEMENT);
      console.log("[withSpacePathFix] Patched the react-native-xcode.sh invocation for paths with spaces.");
    }

    return config;
  });
}

module.exports = withSpacePathFix;
