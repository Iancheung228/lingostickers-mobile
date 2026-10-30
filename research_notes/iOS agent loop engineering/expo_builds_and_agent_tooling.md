# Expo builds and agent tooling for an autonomous dev loop (SDK 54, CNG, local Swift module)

Researched 2026-10-28. The current Expo docs now show SDK 58 in their examples (`create-expo-app@latest --template default@sdk-58`). This project is pinned to SDK 54, so anything marked "latest SDK" needs checking against SDK 54. All fetches went to live pages. Where I reasoned from sources instead of reading the answer directly, I've put it under "Inferences".

## 1. Local vs cloud builds, credits, and when a rebuild is needed

### Takeaway
Once full Xcode is installed, `npx expo run:ios` (simulator) and `eas build --local` both build on the Mac and spend no EAS cloud build. EAS cloud builds, simulator profiles included, still go through the Free plan's 15-iOS-build allowance. A JS/TS-only change never needs a rebuild because Metro serves it to the dev client. Anything under `modules/subject-cutout` (Swift), a new native dependency, or an app config or config plugin change does need one.

### Cited Findings
- `npx expo run:ios` "compiles and installs the native binary on your device or emulator, then starts the Metro bundler". `--device` lets you pick a physically connected device or a simulator. `--configuration Release` makes an unsigned release build — [Expo: Local app development](https://docs.expo.dev/guides/local-app-development/)
- `run:ios` runs `npx expo prebuild` automatically when `ios/` is missing and skips it when `ios/` exists. Running prebuild again "layers the changes on top of existing files". `npx expo prebuild --clean` regenerates from scratch. Native directories are gitignored in new projects, and config changes belong in app config or config plugins — [Expo: Local app development](https://docs.expo.dev/guides/local-app-development/)
- Rebuild matrix from that page: a first build, a new native library or a config plugin change means `npx expo run:ios`. A JS/TS-only change means `npx expo start` and pressing `i`, because Metro "serves your updated JavaScript bundle without recompiling native code". Changes to native code or config need a rebuild — [Expo: Local app development](https://docs.expo.dev/guides/local-app-development/)
- Expo's official `expo-dev-client` skill says a dev client is needed only for local Expo modules, Apple targets, native modules not in Expo Go, config plugins, push or universal links. It labels local builds "(free, requires Xcode for iOS)": `eas build -p ios --profile development --local`. Simulator install is `xcrun simctl install booted ./App.app` after extracting the `.app` from the `.tar.gz`. Device install is `ideviceinstaller -i build.ipa` or the Xcode Devices window — [expo/skills expo-dev-client SKILL.md](https://raw.githubusercontent.com/expo/skills/main/plugins/expo/skills/expo-dev-client/SKILL.md)
- `eas build --local` runs the EAS build process on your own machine and contacts EAS servers only to confirm the project exists and to fetch managed credentials. You supply Node, the package manager, fastlane and CocoaPods yourself. Its limits: one platform at a time, `node`/`cocoapods`/`image` version fields in eas.json are ignored, no caching, and EAS env vars with "Secret" visibility aren't available (set them locally). Debug env vars are `EAS_LOCAL_BUILD_SKIP_CLEANUP=1`, `EAS_LOCAL_BUILD_WORKINGDIR` and `EAS_LOCAL_BUILD_ARTIFACTS_DIR`. The page itself doesn't say whether local builds count toward credits — [Expo: Local builds](https://docs.expo.dev/build-reference/local-builds/)
- To make a simulator profile, set `"ios": { "simulator": true }` on a build profile, then build with `eas build -p ios --profile <name>` and install with `eas build:run -p ios --latest`. It needs no Apple Developer account and no TestFlight. The page doesn't address quota — [Expo: Build for iOS Simulators](https://docs.expo.dev/build-reference/simulators/)
- EAS Free plan ($0): "Up to 15 Android and 15 iOS builds", 60 CI/CD Workflow minutes, 5 concurrent jobs with at most 1 on macOS, a 45-min build timeout and the low-priority queue. Starter is $19/mo with $45 build credit and a 2-hr timeout. Production is $199/mo with $225 credit. Pay-as-you-go per build: iOS medium $2, iOS large $4, Android medium $1, Android large $2 — [expo.dev/pricing](https://expo.dev/pricing)
- Workflow minute prices (non-build jobs): Linux medium $0.018/min, macOS medium $0.075/min, macOS large $0.150/min. Maestro E2E jobs cost $0.05 per job plus minutes (listed for Starter and Production). Cloud "simulator minutes" cost $0.10/min. Starter and Production include 60 min/month "until 2027". On Free they're listed as "Coming soon" — [expo.dev/pricing](https://expo.dev/pricing)

### Inferences
- An EAS simulator-profile build is still a cloud build on an EAS macOS worker, so it should count as one of the 15 iOS builds. Nothing on the pricing page exempts it. `eas build --local` and `expo run:ios` don't run on EAS workers, and Expo's own skill calls local builds "free".
- What full Xcode unlocks on this Mac, which today has only Command Line Tools: the iOS SDK and `xcodebuild` (which `run:ios` and `eas build --local` both need), the Simulator app with its iOS runtimes and `xcrun simctl`, and on-device signing and installs. That makes the whole loop free and local: `npx expo run:ios` once per native change (for example editing Swift in `modules/subject-cutout`), then `npx expo start --dev-client` with Fast Refresh for every JS change. It also lets Expo MCP local automation, agent-device and Maestro run against a local simulator. Without Xcode, every native iteration costs an EAS build or a CI macOS runner.
- Apple Vision's `VNGenerateForegroundInstanceMaskRequest` path and camera capture can't be fully exercised on the simulator, which has no camera (see §5). The cutout module still needs a physical-device check, possible through `run:ios --device` once Xcode is installed.
- Physical device + `run:ios --device` requires code signing. A free Apple ID personal team can sign local debug installs, but I found no Expo page in this session confirming the details. See Gaps.

### Gaps
- No Expo page states outright that `eas build --local` or simulator-profile cloud builds are excluded from, or included in, the 15/month count. The pricing page also doesn't say whether "15 builds" resets monthly. The project's own skills.md and memory say it does.
- I didn't check how large the Xcode and iOS runtime downloads are, or the minimum Xcode version for SDK 54 / RN 0.81 (likely Xcode 16.x; unverified).
- Signing local device builds with a free Apple ID wasn't confirmed against an Expo source.

## 2. Expo's AI and agent tooling (MCP server, Claude Code plugin, skills, llms.txt, Simulators)

### Takeaway
Expo ships a remote MCP server at `https://mcp.expo.dev/mcp` (OAuth with an Expo account). It has 32 server tools covering docs, EAS builds and workflows, TestFlight and stores, and Observe. With the `expo-mcp` dev package and `EXPO_UNSTABLE_MCP_SERVER=1 npx expo start`, it adds 6 local tools for screenshots, tap-by-testID, find view, logs, devtools and the router sitemap. The local tools work on SDK 54+ but only on an iOS simulator on macOS. The Claude Code plugin `expo@claude-plugins-official` bundles the Expo Skills and registers that MCP server.

### Cited Findings
- Expo MCP setup: `claude mcp add --transport http expo https://mcp.expo.dev/mcp`, then `/mcp` to sign in with OAuth. An Expo account is required. `search_documentation` requires an EAS **paid** plan. "Local capabilities are only available in SDK 54 and later." Page last modified Oct 28, 2026 — [Expo MCP Server](https://docs.expo.dev/eas/ai/mcp/)
- Server tools (32): `add_library`, `read_documentation` (one page as Markdown, ~5,000 tokens per call, paginated), `search_documentation` (paid), `learn`. Workflows: `workflow_create/info/list/logs/run/cancel/validate`. Builds: `build_list/info/logs/submit/run/cancel`. Stores: `testflight_crashes`, `testflight_feedback`, `appstore_reviews`, `appstore_reply_review`, `appstore_delete_review_response`, `playstore_crashes/reviews/reply_review`. Observe: `observe_versions/metrics_summary/metrics/routes/event_names/events/session` — [Expo MCP Server](https://docs.expo.dev/eas/ai/mcp/)
- Local tools (6) need `npx expo install expo-mcp --dev`, `npx expo whoami || npx expo login`, then `EXPO_UNSTABLE_MCP_SERVER=1 npx expo start`. They are `expo_router_sitemap`, `open_devtools`, `collect_app_logs` (iOS syslog and/or JS console over a short window), `automation_tap` (by coordinates or testID; testID recommended as "more resilient"), `automation_take_screenshot` (full screen or one view by testID) and `automation_find_view` (position, size, visibility). Limits: one dev-server connection at a time. You must reconnect MCP each time the dev server starts or stops. iOS local capabilities work only on simulators, not physical devices, and only on macOS — [Expo MCP Server](https://docs.expo.dev/eas/ai/mcp/)
- Claude Code plugin: `claude plugin install expo@claude-plugins-official`, with `--scope project` to limit it to one project. It installs Expo Skills and registers the Expo MCP server, so `/mcp` is still needed for auth. Expo's recommended project files are AGENTS.md (pointing to the project's SDK version docs) and `.claude/settings.json` enabling the plugin. Reading AGENTS.md directly needs Claude Code v2.1.277+. Example tasks Expo lists include reading EAS Build logs, adding SwiftUI components and taking screenshots to verify UI — [Expo: Claude Code](https://docs.expo.dev/agents/claude.md)
- The skills live in [github.com/expo/skills](https://github.com/expo/skills) under `plugins/expo/skills/<name>/SKILL.md`. They also ship as the Codex plugin `expo@openai-curated` and through `npx skills add expo/skills`. The list: expo-animation, expo-app-clip, expo-brownfield, expo-data-fetching, expo-design-system, **expo-dev-client**, expo-dom, expo-examples, **expo-module** (Expo Modules API native modules; doesn't cover migrating to Modules API 2.0 macros, which is in the separate `expo-experiments` plugin's `expo-migrate-module`), expo-native-ui, expo-overview, expo-project-structure, expo-router, expo-ui, **expo-upgrade**, expo-web-to-native, eas-app-stores, eas-hosting, eas-observe, **eas-simulator** (experimental), eas-update, eas-update-insights, **eas-workflows**. No skill states which SDK versions it supports — [Expo Skills](https://docs.expo.dev/skills/)
- Docs for LLMs: the full index is at [docs.expo.dev/llms.txt](https://docs.expo.dev/llms.txt), and any docs URL returns Markdown when you append `.md` — [Expo: Claude Code](https://docs.expo.dev/agents/claude.md)
- **Expo Simulators** (EAS cloud iOS Simulator / Android Emulator) is a "limited-access preview" for select partners with a waitlist. It is "not included" in free or paid plans. It's meant for agent loops: implement, start a remote device, drive it with agent-device / Argent / Appium, inspect, return evidence (screenshots, recordings, logs), stop. Supports Fast Refresh with dev builds — [Expo Simulators intro](https://docs.expo.dev/preview/simulators/introduction.md)
- eas-simulator skill: commands are `eas simulator:availability|start|exec|get|list|events|stop`. They're experimental and hidden, and need eas-cli ≥ 20.3.0. Max session is 40 min on Free and 115 min on paid. The device boots blank. Live edits need a dev build. Android is still in development. The session env file holds a token and must be gitignored — [eas-simulator SKILL.md](https://raw.githubusercontent.com/expo/skills/main/plugins/expo/skills/eas-simulator/SKILL.md)
- agent-device (by Callstack, MIT): a CLI built for agents. `snapshot -i` returns an accessibility tree with refs like `@e1`. Other commands: `press @e2 --settle`, `screenshot ./artifacts/x.png`, `open/close`, `close --shutdown` in CI. It also covers logs, network, traces and perf. Local iOS use **requires macOS with Xcode**. Physical devices need pairing and signing setup. Install with `npm i -g agent-device@latest` (Node ≥ 22.12) and check with `agent-device doctor`; the skill installs via `npx skills add callstack/agent-device` — [Expo: agent-device](https://docs.expo.dev/agents/agent-device.md)

### Inferences
- For this project, the Expo MCP local tools fit the "agent sees and taps the UI" step, but only after full Xcode is installed, and only on a simulator, which can't exercise the camera or scan flow. They depend on `testID`s, so adding testIDs to the key controls (scan, study card grade buttons, sheets) is a prerequisite.
- `search_documentation` is paywalled. On Free, `read_documentation` plus `llms.txt` / the `.md` suffix covers docs access. Pin reads to `/versions/v54.0.0/` because the default docs now show SDK 58.
- The plugin's skills track the latest SDK. The project's AGENTS.md pin to v54 should take precedence, and `expo-upgrade` should not be invoked by accident.

### Gaps
- I couldn't confirm that the `expo-mcp` package version compatible with SDK 54 is still published or maintained; the docs only say "SDK 54 and later".
- Expo Simulators pricing for Free accounts isn't published (it's waitlisted). Whether this account has access is unknown; `eas simulator:availability` would answer it.
- The pages I read don't say whether the plugin contains hooks.

## 3. EAS Workflows (CI) for E2E, and GitHub Actions macOS as a remote build alternative

### Takeaway
EAS Workflows can chain an iOS simulator-profile `build` job into a `maestro` job. On Free that uses one of the 15 iOS builds per run, plus Workflow minutes (60 included). Maestro jobs are listed at $0.05/job plus minutes on paid plans. A GitHub Actions macOS runner costs $0.062/min and can run `expo prebuild` + `xcodebuild` / `eas build --local` without spending EAS credits.

### Cited Findings
- Maestro on EAS: put flows in `.maestro/`, add an `e2e-test` profile with `"ios": {"simulator": true}`, and create `.eas/workflows/e2e-test-ios.yml` with a `type: build` job (platform ios, profile e2e-test) and a `type: maestro` job whose `build_id` comes from the build job's outputs and whose `flow_path` lists the flows. Trigger it on pull_request or with `eas workflow:run .eas/workflows/e2e-test-ios.yml`. The page gives no cost or plan information — [Expo: E2E tests with EAS Workflows](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- Maestro job $0.05/job + CI/CD minutes (Starter/Production). Free plan gets 60 Workflow minutes. macOS medium is $0.075/min. Free concurrency is at most 1 macOS job — [expo.dev/pricing](https://expo.dev/pricing)
- GitHub Actions standard macOS 3/4-core (M1 or Intel) costs $0.062/min (SKU `actions_macos`). Linux 2-core x64 is $0.006/min. Minutes round up per job — [GitHub: Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)

### Inferences
- A type-check + lint + Jest gate on Linux (cheap, or free within GitHub's included minutes) on every push, plus a macOS job only when native files change, keeps costs low. One way to detect native changes is to diff `modules/`, `app.json`/`app.config`, `package.json` native deps or `@expo/fingerprint`. As a rough example, a 15–25 min iOS simulator build on a GitHub macOS runner is about $0.93–$1.55, comparable to the $2 EAS pay-as-you-go iOS medium build but outside the 15-build cap.

### Gaps
- I didn't fetch GitHub's free included-minutes table or any 2026 billing changes. Historically macOS minutes counted at a 10× multiplier against included minutes on private repos; this is unverified for 2026.
- It isn't documented whether `type: build` jobs inside Workflows count against the 15-build allowance (very likely yes, since they're ordinary EAS builds).
- The pricing page doesn't say whether Maestro jobs are available on the Free plan.

## 4. Testing approach for an agent loop (Jest + RNTL, Maestro, Detox)

### Takeaway
The best-supported agent pattern found was: exploratory driving through an MCP (Expo MCP local tools, Maestro MCP or agent-device), then freezing what works into a Maestro flow in `.maestro/` that can be re-run locally and on EAS. testIDs anchor Expo MCP tapping and screenshots. Jest / React Native Testing Library and Detox weren't researched from primary sources in this session.

### Cited Findings
- Maestro MCP ships in the Maestro CLI: `claude mcp add maestro -- maestro mcp`. Claude Code can then list devices, run `inspect_screen`, run inline YAML, take screenshots and save flows. The recommended loop: explore with inline YAML, save to `.maestro/`, re-run with the `files` input or `maestro test .maestro/x.yaml`. Gotchas: each `run` call takes exactly one of `yaml`/`files`/`dir`, and saved flows break when labels or layout change. iOS support is simulator-only, with physical Android supported. Article dated Sep 1, 2026 — [Maestro blog: Mobile UI testing with coding agents](https://maestro.dev/blog/mobile-ui-testing-with-coding-agents)
- Expo MCP recommends tapping by testID because it's "more resilient to layout changes" — [Expo MCP Server](https://docs.expo.dev/eas/ai/mcp/)
- Expo has a guide on verifying a change with an agent against a cloud simulator, with agent-device or Argent as the controller — [Expo Simulators: verify a change with an agent](https://docs.expo.dev/preview/simulators/how-to/verify-a-change-with-an-agent/)
- Community tools (not official): DaveDev42's `expo-mcp` (an MCP server plus a QA agent that gives PASS/FAIL/INCONCLUSIVE verdicts, plus Maestro flow tools), `rn-dev-agent` (Lykhoyda), and a community skill saying all interactive elements should carry a testID for expo-mcp tap/find — [glama: DaveDev42/expo-mcp](https://glama.ai/mcp/servers/DaveDev42/expo-mcp); [skills.sh claude-mobile-ios-testing](https://skills.sh/krzemienski/claude-mobile-expo/claude-mobile-ios-testing)

### Inferences
- For this codebase, pure-logic Node tests (already used for `lib/review.ts`-style logic and the `scripts/test-*.mts` harnesses) are the fastest gate. A small set of Maestro flows (sign-in, study session grading, sheet dismissal) would cover regressions an agent can't see from types. The cutout and camera path has to stay a manual device check.
- Note that the Expo MCP name collides with DaveDev42's community `expo-mcp`. The official dev package is installed via `npx expo install expo-mcp --dev`; confirm the npm publisher before installing.

### Gaps
- I didn't fetch primary sources on Jest/RNTL setup for SDK 54 (`jest-expo` preset) or on Detox + Expo (config plugin, prebuild requirement). Both should be researched separately if they're needed.
- I found no measured comparison of Maestro vs Detox for agent loops.

## 5. Keeping the agent's feedback fast (Metro logs, doctor, lint, simulator limits)

### Takeaway
The cheap gates are `npx expo-doctor` (project health and dependency compatibility), `npx expo install --fix` (aligns deps to the SDK), `npx expo lint`, `tsc`, and the project's `deno check`. Runtime feedback comes from Metro output and the Expo MCP `collect_app_logs` / agent-device logs. The simulator lacks the camera and motion hardware.

### Cited Findings
- `npx expo-doctor` checks app config, package.json, dependency compatibility (validated against React Native Directory by default) and app config sync when native dirs exist; it can be configured in package.json. `npx expo install <pkg>` installs SDK-compatible versions, and `--fix` validates and updates them. `npx expo lint` sets up or runs ESLint — [Expo: Tools](https://docs.expo.dev/develop/tools/)
- iOS Simulator needs full Xcode from the Mac App Store plus an iOS platform runtime (Xcode > Settings > Components > Get). Command Line Tools are installed via Xcode > Settings > Locations. Watchman is optional, "only required for projects on SDK 55 and earlier", which includes SDK 54. The simulator lacks Audio Input, Barometer, **Camera** and Motion. Expo Orbit manages simulators and launches builds — [Expo: iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/)
- `collect_app_logs` captures iOS syslog and/or the JS console. `open_devtools` opens React Native DevTools — [Expo MCP Server](https://docs.expo.dev/eas/ai/mcp/)

### Inferences
- A sensible ordering for an agent turn: `tsc --noEmit` → eslint → unit/logic tests → `deno check` (if functions changed) → `expo-doctor` (if deps changed) → reload the simulator and screenshot/tap via MCP → native rebuild only if `modules/` or config changed. Because this app relies on the camera and Vision, the simulator can verify most UI screens but not scanning. Expo's simulator docs list the missing camera explicitly.
- Install Watchman since the project is on SDK 54.

### Gaps
- `npx expo install --check` isn't documented on the tools page I fetched (only `--fix`). I didn't verify whether `--check` exists in SDK 54's CLI.
- I didn't fetch the React Native DevTools debugging page for SDK 54 or details on Metro log streaming.

## 6. Public examples of agents autonomously developing Expo apps, and reported gotchas

### Takeaway
Expo officially positions its MCP server, skills plugin and (preview) cloud Simulators for Claude Code, Codex and Cursor, and documents an "implement, drive device, inspect, iterate" loop. I found no detailed, dated third-party case study of a fully autonomous Expo build loop.

### Cited Findings
- Expo publishes guides for Claude Code, Codex and Cursor. Any agent with shell access can use EAS CLI and agent-device. Expo Simulators is "built for agentic development" — [Expo Simulators intro](https://docs.expo.dev/preview/simulators/introduction.md); [Expo: Claude Code](https://docs.expo.dev/agents/claude.md)
- Gotchas documented by Expo: restart or reconnect the MCP when the dev server restarts. Only one dev-server connection is allowed at a time. Local iOS automation works on the simulator only. "Plugin 'expo' is enabled in project settings but isn't installed here" means it must be installed locally and Claude Code restarted. The cloud simulator boots blank, and its env file contains a token that must be gitignored — [Expo MCP Server](https://docs.expo.dev/eas/ai/mcp/); [Expo: Claude Code](https://docs.expo.dev/agents/claude.md); [eas-simulator SKILL.md](https://raw.githubusercontent.com/expo/skills/main/plugins/expo/skills/eas-simulator/SKILL.md)
- Maestro gotcha: saved flows break when labels change, and the agent is expected to repair them — [Maestro blog](https://maestro.dev/blog/mobile-ui-testing-with-coding-agents)
- A third-party post titled "Can an agent QA a mobile app?" exists, but I didn't read it — [whitesmith](https://whitesmith.pages.dev/blog/can-an-agent-qa-a-mobile-app)

### Inferences
- Docs drift to the newest SDK is the main risk for an SDK 54 project using the plugin. Skills and the MCP's `read_documentation` default to current docs.

### Gaps
- I found no Expo blog case study with metrics (builds saved, time per loop). I didn't search expo.dev/blog specifically within the tool budget.
