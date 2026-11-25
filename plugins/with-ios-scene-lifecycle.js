/**
 * iOS 27 stops any app at launch that hasn't adopted the UIScene life cycle
 * (crash in `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`).
 *
 * Expo SDK 57 ships the pieces (`ExpoAppSceneDelegate`, `ExpoReactNativeFactoryProvider`),
 * but the generated iOS project doesn't use them yet. This plugin wires them up on every
 * `expo prebuild`, so the fix survives regenerating the ios/ folder:
 *   1. Info.plist: declare a scene manifest whose delegate is Expo's scene delegate.
 *   2. AppDelegate: conform to ExpoReactNativeFactoryProvider and stop creating the window
 *      itself — the scene delegate now creates the window and starts React Native in it.
 */
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: "Default Configuration",
        // Objective-C name of Expo's `ExpoAppSceneDelegate` class.
        UISceneDelegateClassName: "EXExpoAppSceneDelegate",
      },
    ],
  },
};

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return cfg;
  });
}

function withSceneAwareAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift") {
      throw new Error("with-ios-scene-lifecycle: expected a Swift AppDelegate");
    }
    let src = cfg.modResults.contents;

    // 1. Let the scene delegate find the React Native factory.
    if (!src.includes("ExpoReactNativeFactoryProvider")) {
      const before = src;
      src = src.replace(
        /class AppDelegate: ExpoAppDelegate \{/,
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {"
      );
      if (src === before) {
        throw new Error("with-ios-scene-lifecycle: couldn't find `class AppDelegate: ExpoAppDelegate {`");
      }
    }

    // 2. Don't create a window / start React Native here — the scene delegate does it.
    const startBlock =
      /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?\)\s*\n#endif\s*\n/;
    if (startBlock.test(src)) {
      src = src.replace(
        startBlock,
        "    // The window is created and React Native is started by ExpoAppSceneDelegate\n" +
          "    // (UIScene life cycle, required on iOS 27). See plugins/with-ios-scene-lifecycle.js.\n\n"
      );
    } else if (!src.includes("ExpoAppSceneDelegate")) {
      throw new Error("with-ios-scene-lifecycle: couldn't find the window/startReactNative block to remove");
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  return withSceneAwareAppDelegate(withSceneManifest(config));
};
