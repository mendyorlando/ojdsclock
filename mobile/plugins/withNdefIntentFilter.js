const { withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

// Android's NFC tag dispatch resolves a scanned tag's own separate way -
// it tries an android.nfc.action.NDEF_DISCOVERED intent-filter FIRST,
// before ever falling back to a plain android.intent.action.VIEW App
// Link. Expo's built-in `android.intentFilters` config always prepends
// "android.intent.action." to whatever action you give it, so it has no
// way to express this NFC-specific action - hence this small plugin,
// which writes the raw <intent-filter> Expo's own config can't.
//
// Without this, tapping the door tag while the app isn't already
// foreground-scanning falls through to whatever the OS's older
// NFC-tag-to-browser convention resolves to (Chrome, on this phone),
// instead of opening the app - even though the android.intent.action.VIEW
// App Link (autoVerify) is correctly verified and works fine for a plain
// link tap. Runs after every `expo prebuild` since the manifest is
// regenerated (and gitignored) each time.
function withNdefIntentFilter(config) {
  return withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);

    mainActivity["intent-filter"] = mainActivity["intent-filter"] || [];
    mainActivity["intent-filter"].push({
      $: { "data-generated-ndef": "true" },
      action: [{ $: { "android:name": "android.nfc.action.NDEF_DISCOVERED" } }],
      category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
      data: [
        {
          $: {
            "android:scheme": "https",
            "android:host": "ojdsclock.vercel.app",
            "android:pathPrefix": "/c/",
          },
        },
      ],
    });

    return config;
  });
}

module.exports = withNdefIntentFilter;
