// Three builds of one app, installable side by side on the same phone
// (Expo "app variants": https://docs.expo.dev/build-reference/variants/).
// iOS tells apps apart by bundle id, so each variant gets its own, plus its own
// name and icon so you can see at a glance which one you're in.
//
//   development  "Tabi Dev"      com.iancheung228.lingostickers.dev      dev client, loads JS from Metro
//   preview      "Tabi Preview"  com.iancheung228.lingostickers.preview  release build for testing, staging backend
//   production   "Tabi Stickers" com.iancheung228.lingostickers          the App Store app
//
// APP_VARIANT is set per build profile in eas.json. Unset means production, so
// that `eas submit` / `eas update` run locally can never pick up a dev identity.
// Which BACKEND a build talks to is a separate setting: the EAS environment
// (eas.json `environment`) supplies EXPO_PUBLIC_SUPABASE_URL. See RELEASING.md.

const VARIANTS = {
  development: { name: 'Tabi Dev', suffix: '.dev', scheme: 'lingostickers-dev', icon: './assets/icon-dev.png' },
  preview: { name: 'Tabi Preview', suffix: '.preview', scheme: 'lingostickers-preview', icon: './assets/icon-preview.png' },
  production: { name: null, suffix: '', scheme: null, icon: null },
};

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || 'production';
  const v = VARIANTS[variant];
  if (!v) throw new Error(`Unknown APP_VARIANT "${variant}"; use one of ${Object.keys(VARIANTS).join(', ')}`);
  if (variant === 'production') return withDevClientScheme(config, false);

  const ios = { ...config.ios, bundleIdentifier: config.ios.bundleIdentifier + v.suffix };
  // Universal links: tabistickers.com's apple-app-site-association names only
  // the store app, so the other variants must not claim the domain.
  delete ios.associatedDomains;
  return withDevClientScheme({ ...config, name: v.name, scheme: v.scheme, icon: v.icon, ios }, variant === 'development');
};

// The dev client registers `exp+<slug>://` so Expo CLI and Maestro can open it.
// Only the development build should answer that link.
function withDevClientScheme(config, addGeneratedScheme) {
  const plugins = (config.plugins || []).filter((p) => (Array.isArray(p) ? p[0] : p) !== 'expo-dev-client');
  return { ...config, plugins: [...plugins, ['expo-dev-client', { addGeneratedScheme }]] };
}
