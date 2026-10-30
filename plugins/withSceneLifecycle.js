// Adopts the UIScene lifecycle so the app launches on iOS 27.
//
// iOS 27 kills, at launch, any app linked against the iOS 27 SDK that has no
// scene manifest (UIKit's _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
// Expo only ships a fix from SDK 57.0.23 (`enableSceneSupport` in
// expo-build-properties); SDK 54's template creates its window in the
// AppDelegate, which is exactly the pattern iOS 27 rejects.
//
// OPT-IN, via EXPO_SCENE_LIFECYCLE=1 at prebuild. It is meant for local
// Xcode 27 simulator builds. EAS builds don't set it, so production startup is
// unchanged until it has been tested on a device — turn it on for EAS (env in
// eas.json) only once EAS builds with Xcode 27, or replace it with the official
// flag when upgrading the SDK.
//
// Startup order: the AppDelegate still creates the window and starts React
// Native in didFinishLaunching, exactly as the template does, because
// expo-dev-launcher fatalErrors if it finds no window at that point. The scene
// delegate only attaches that window to the scene once the scene connects.
//
// Deep links: once a scene exists, URLs and user activities arrive at the scene
// delegate instead of the AppDelegate. The SceneDelegate below forwards each one
// to the AppDelegate method that used to receive it, so RCTLinkingManager and
// Expo's subscribers (expo-router, expo-dev-client) see no difference. A link
// that cold-starts the app is forwarded the same way once the scene connects.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const MARKER = '// withSceneLifecycle';

// The template block this replaces, verbatim from the SDK 54 AppDelegate.
const WINDOW_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

const SCENE_DELEGATE = `
${MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let window = appDelegate.window else { return }
    // The AppDelegate already created this window and started React Native in
    // it, because expo-dev-launcher looks the window up during
    // didFinishLaunching, before any scene exists, and fatalErrors if there is
    // none. The scene's only job is to give that window a screen to live on.
    window.windowScene = windowScene
    self.window = window
    window.makeKeyAndVisible()
    // A link that cold-starts the app arrives here, not in launchOptions, so
    // hand it to the same path a link into a running app takes.
    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }
    if let activity = connectionOptions.userActivities.first {
      self.scene(scene, continue: activity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let context = URLContexts.first,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: context.options.openInPlace,
    ]
    if let source = context.options.sourceApplication {
      options[.sourceApplication] = source
    }
    _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;

    if (!contents.includes(WINDOW_BLOCK)) {
      // The template changed (SDK upgrade?). Fail loudly: the scene delegate
      // below assumes the AppDelegate still creates the window and starts React Native.
      throw new Error('withSceneLifecycle: AppDelegate window block not found; re-check against the new template');
    }
    cfg.modResults.contents = contents + SCENE_DELEGATE;
    return cfg;
  });
}

module.exports = function withSceneLifecycle(config) {
  if (process.env.EXPO_SCENE_LIFECYCLE !== '1') return config;
  return withSceneDelegate(withSceneManifest(config));
};
