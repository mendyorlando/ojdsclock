const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// expo-updates ships its own "[CP-User] Generate updates resources for
// expo-updates" Xcode build phase, generated fresh into
// ios/Pods/Pods.xcodeproj by every `pod install` - config plugins (which
// only touch the main app's own .xcodeproj, before pod install even runs)
// can't reach it, so this project's other space-path fix
// (withSpacePathFix.js, for the app target's own "Bundle React Native
// code and images" phase) doesn't cover it. Same root cause though: that
// phase runs `bash -l -c "$PODS_TARGET_SRCROOT/../scripts/create-updates-
// resources-ios.sh"` - the outer shell expands the path inside its own
// quotes just fine, but `-c` then re-parses that resulting VALUE as a
// brand new command line with no quotes left in it, so bash word-splits
// on this project's own path (".../Clocking In App/...") and fails
// archiving with "No such file or directory". Simply dropping `-c` fixes
// it: `bash -l SCRIPT_PATH` runs the path as a script argument (passed
// through as one real argv element, not restringified and reparsed), the
// same fix pattern this repo already verified against a minimal
// reproduction before applying it here. Fixed via a post_install hook
// spliced into the generated Podfile, which does have access to the Pods
// project (a raw Podfile edit would otherwise be wiped by the next
// `expo prebuild`).
const NEEDLE = `      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end`;

const REPLACEMENT = `      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
    installer.pods_project.targets.each do |target|
      target.build_phases.each do |phase|
        if phase.respond_to?(:name) && phase.name == "[CP-User] Generate updates resources for expo-updates"
          phase.shell_script = phase.shell_script.gsub(
            'bash -l -c "$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh"',
            'bash -l "$PODS_TARGET_SRCROOT/../scripts/create-updates-resources-ios.sh"'
          )
        end
      end
    end
  end`;

function withUpdatesSpacePathFix(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      const contents = fs.readFileSync(podfilePath, "utf8");
      if (!contents.includes(NEEDLE)) {
        console.warn("[withUpdatesSpacePathFix] Could not find the expected Podfile post_install block - skipping.");
        return config;
      }
      fs.writeFileSync(podfilePath, contents.replace(NEEDLE, REPLACEMENT));
      console.log("[withUpdatesSpacePathFix] Patched expo-updates' build phase for paths with spaces.");
      return config;
    },
  ]);
}

module.exports = withUpdatesSpacePathFix;
