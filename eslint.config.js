// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions is Deno, not React Native. Its modules are imported
    // by URL (`https://esm.sh/...`), which the Node resolver cannot follow —
    // producing 15 `import/no-unresolved` errors that are all false. Left in,
    // they hid every genuine warning behind a failing exit code.
    ignores: ["dist/*", "supabase/functions/**"],
  }
]);
