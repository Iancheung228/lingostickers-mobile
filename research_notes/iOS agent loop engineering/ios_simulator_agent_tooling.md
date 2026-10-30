# iOS Simulator / device tooling for a closed AI-agent feedback loop (as of 2026-10-28)

Local machine facts (checked directly with `sw_vers`, `uname`, `df`, `java -version`, `xcode-select -p` on 2026-10-28, not from a web source): macOS 26.6 (build 25G72), Apple M5 (arm64), 24 GB RAM, 217 GiB free of 460 GiB, `xcode-select -p` = `/Library/Developer/CommandLineTools`, `xcrun simctl` fails with "unable to find utility simctl", Java 1.8.0_333 only (an old applet-plugin JRE), Node v22.14.0, Homebrew at /usr/local/bin/brew. Not installed: maestro, idb, idb_companion, axe.

## Q1. The tools: what they do, how agents call them, install, maintenance, limits

### Takeaway
The best-maintained agent-native stack in late 2026 is **MobileBuildMCP**, formerly XcodeBuildMCP. Sentry now owns it, and it was renamed in v2.7.1 on 23 Sep 2026. It covers build, run, logs and UI automation through its bundled AXe CLI. For declarative, repeatable assertions, add **Maestro**, which has an official `maestro mcp`. For an Expo app, Expo's own MCP has local `automation_*` tools on SDK 54+. Apple's `xcrun mcpbridge` exists, but it reaches into Xcode's editor and build. It does not drive the simulator UI, and it only works while Xcode.app is running with a project open.

### Cited Findings

**XcodeBuildMCP → MobileBuildMCP (getsentry)**
- Sentry acquired the project from Cameron Cooke in February 2026, and the old cameroncooke URL redirects. It is MIT licensed. — [mcp.directory guide](https://mcp.directory/blog/xcodebuildmcp-complete-guide-2026)
- Release history: v2.1.0 on 23 Feb 2026 added an `init` command that installs agent skills; v2.2.1 on 8 Mar; v2.3.1 on 27 Mar; v2.3.2 on 31 Mar; v2.5.2 on 12 May. — [changelog](https://www.xcodebuildmcp.com/docs/changelog); [v2.1.0 release](https://github.com/getsentry/XcodeBuildMCP/releases/tag/v2.1.0)
- v2.5.2 updated the bundled AXe binary to 1.7.0. — [GitHub releases](https://github.com/getsentry/XcodeBuildMCP/releases)
- v2.6.0 (1 Jun 2026) added runtime UI automation: the `wait_for_ui`, `batch` and `drag` tools, element references with screen hashes in `snapshot_ui`, and `replaceExisting` for `type_text`. v2.6.1 (2 Jun) fixed UITabBar item discovery. — [GitHub releases](https://github.com/getsentry/XcodeBuildMCP/releases)
- v2.7.0 (23 Jul 2026) added simulator support for Xcode 27 Device Hub and moved build/test structured results to schema v3, a breaking change. Earlier Xcode versions still use Simulator.app. — [GitHub releases](https://github.com/getsentry/XcodeBuildMCP/releases)
- v2.7.1 (23 Sep 2026) renamed the project to MobileBuildMCP. The npm package, CLI binaries, environment variables and config directory all changed, and the xcodebuildmcp.com domain was retired. Pre-rename tutorials and config snippets are therefore stale. — [GitHub releases](https://github.com/getsentry/XcodeBuildMCP/releases)
- Requirements are macOS 14.5+, Xcode 16.x+, and Node 18+ (not needed for the Homebrew install).
  - Homebrew install: `brew tap getsentry/xcodebuildmcp && brew install mobilebuildmcp`.
  - npm install: `npm install -g mobilebuildmcp@latest`.
  - MCP launch: `npx -y mobilebuildmcp@latest mcp`.
  - Other commands: `mobilebuildmcp tools`, `simulator build`, `simulator test`, `--build-for-testing`, and `upgrade --check`.
  - A per-workspace daemon starts automatically for stateful work such as log capture.
  - Skills: an MCP skill and a CLI skill, installed with `mobilebuildmcp init`.
  - — [README](https://github.com/getsentry/XcodeBuildMCP)
- Limits and notes:
  - Builds skip Swift macro validation.
  - "Device tools require code signing to be configured in Xcode."
  - Sentry collects internal runtime error telemetry, which can be opted out of.
  - — [README](https://github.com/getsentry/XcodeBuildMCP)
- One directory counts "71 tools". — [claudemarketplaces](https://claudemarketplaces.com/mcp/getsentry/xcodebuildmcp)

**AXe (cameroncooke/AXe), the UI-automation engine bundled in MobileBuildMCP**
- AXe is a CLI that drives iOS Simulators through Apple's HID functionality. Commands include `list-simulators`, `describe-ui` (accessibility tree), `tap --label "Continue"`, `type`, and `screenshot --output`. — [AXe README](https://raw.githubusercontent.com/cameroncooke/AXe/main/README.md)
- Install with `brew install cameroncooke/axe/axe`. — [AXe README](https://raw.githubusercontent.com/cameroncooke/AXe/main/README.md)
- It supports Xcode 26 and 27, validated on Xcode 26.5 / iOS 26.5 and Xcode 27 beta 3 / iOS 27. — [AXe README](https://raw.githubusercontent.com/cameroncooke/AXe/main/README.md)
- "Xcode 27 simulator automation uses Device Hub; Simulator.app is not required." — [AXe README](https://raw.githubusercontent.com/cameroncooke/AXe/main/README.md)
- AXe builds IDB from a pinned fork commit (`cameroncooke/idb@1395103…`), so it does not track upstream facebook/idb changes. — [AXe README](https://raw.githubusercontent.com/cameroncooke/AXe/main/README.md)

**ios-simulator-mcp (joshuayoes)**
- It has 17 tools:
  - Simulator: `get_booted_sim_id`, `open_simulator`, `list_apps`.
  - UI inspection: `ui_describe_all`, `ui_describe_point`, `ui_find_element`, `ui_view`.
  - UI interaction: `ui_tap`, `ui_type`, `ui_swipe`.
  - Capture: `screenshot`, `record_video`, `stop_recording`.
  - Apps and URLs: `install_app`, `launch_app`, `terminate_app`, `open_url`.
  - — [README](https://github.com/joshuayoes/ios-simulator-mcp)
- Prerequisites are macOS, Node 20+, Xcode with simulators, and Facebook IDB (`idb_companion` plus the `fb-idb` Python client). Paste mode needs fb-idb 1.5.1+, and idb_companion 1.1.8 fails for paste. — [README](https://github.com/joshuayoes/ios-simulator-mcp)
- Install: `claude mcp add ios-simulator npx ios-simulator-mcp`. — [README](https://github.com/joshuayoes/ios-simulator-mcp)
- Versions below 1.3.3 had command-injection vulnerabilities. — [README](https://github.com/joshuayoes/ios-simulator-mcp)
- Limits of `ui_type`:
  - The default mode assumes a US keyboard, accepts ASCII only, and is capped at 500 characters.
  - Paste mode takes about 2–11 s per call and rejects newlines.
  - — [README](https://github.com/joshuayoes/ios-simulator-mcp)
- Screenshots and recordings default to `~/Downloads`. Use `IOS_SIMULATOR_MCP_FILTERED_TOOLS` to trim the tool list. — [README](https://github.com/joshuayoes/ios-simulator-mcp)

**Facebook idb / idb_companion**
- Upstream installs with `brew tap facebook/fb && brew install idb-companion`, plus the `fb-idb` pip client. — [AXe README search summary](https://raw.githubusercontent.com/cameroncooke/AXe/main/README.md)
- I found no source saying upstream idb is archived. A third-party NuGet wrapper (AppleDev.FbIdb 0.8.10) was updated 7 May 2026. — [NuGet](https://www.nuget.org/packages/AppleDev.FbIdb)

**mobile-mcp (mobile-next)**
- It has about 33 tools: device management, location override, clipboard, app install/launch, screenshots, element listing, tap/swipe/long-press, recording, logs, crash reports and batching. — [README](https://github.com/mobile-next/mobile-mcp)
- It reads the native accessibility tree first ("no vision model, no image tokens") and falls back to screenshots with coordinate taps. — [README](https://github.com/mobile-next/mobile-mcp)
- It supports iOS simulators (built on `mobilecli`), real iOS devices over USB once they are trusted, and Android. It needs Node 20+. — [README](https://github.com/mobile-next/mobile-mcp)
- Install: `claude mcp add mobile-mcp -- npx -y @mobilenext/mobile-mcp@latest`. — [README](https://github.com/mobile-next/mobile-mcp)
- Non-standard URL schemes are blocked unless `MOBILEMCP_ALLOW_UNSAFE_URLS` is set. This matters for Expo `exp://` deep links. — [README](https://github.com/mobile-next/mobile-mcp)

**Maestro + Maestro MCP**
- `maestro mcp` is official and ships with the CLI. Install it in Claude Code with `claude mcp add maestro -- maestro mcp`. — [Maestro MCP docs](https://docs.maestro.dev/getting-started/maestro-mcp)
- Tools:
  - `list_devices` (Android emulators, iOS simulators, Chromium).
  - `inspect_screen` (view hierarchy as compact JSON).
  - `take_screenshot`.
  - `run` (inline YAML, files, or a directory with tags).
  - `cheat_sheet`.
  - Cloud tools.
  - `open_maestro_viewer`.
  - — [Maestro MCP docs](https://docs.maestro.dev/getting-started/maestro-mcp)
- Updating the CLI also updates the MCP server. Some setups need `PATH` or `JAVA_HOME` set explicitly. — [Maestro MCP docs](https://docs.maestro.dev/getting-started/maestro-mcp)
- Maestro needs Java 17+, with `JAVA_HOME` pointing at that install. You can install with the curl installer, or with `brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro`. — [Maestro install docs](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli)
- iOS needs Xcode from the App Store, the Command Line Tools location set in Xcode settings, and an iOS runtime installed. Run `xcodebuild -runFirstLaunch` if Xcode has never been opened. — [Maestro install page](https://docs.maestro.dev/getting-started/installing-maestro)
- Real iOS devices: sources conflict. A third-party listing says "physical iPhones are not supported", while the mcp.so summary says real devices work. The official install page covers only simulators. — [mcp.so](https://mcp.so/servers/maestro)

**Expo MCP (official)**
- The remote server is `https://mcp.expo.dev/mcp`. It uses Streamable HTTP with OAuth and needs an Expo account. — [Expo docs](https://docs.expo.dev/eas/ai/mcp/)
- Add it with `claude mcp add --transport http expo https://mcp.expo.dev/mcp`, then authenticate with `/mcp`. — [Expo docs](https://docs.expo.dev/eas/ai/mcp/)
- Local capabilities need two steps: `npx expo install expo-mcp --dev`, then `EXPO_UNSTABLE_MCP_SERVER=1 npx expo start`. — [Expo docs](https://docs.expo.dev/eas/ai/mcp/)
- Local tools include:
  - `automation_take_screenshot` (whole screen or one view by testID).
  - `automation_tap` (coordinates or testID).
  - `automation_find_view`.
  - `expo_router_sitemap`, `open_devtools`, `collect_app_logs`.
  - — [Expo docs](https://docs.expo.dev/eas/ai/mcp/)
- Local capabilities need SDK 54+; the docs recommend SDK 58 for new projects. They work on simulators only, not physical devices, and need a macOS host. Only `search_documentation` is marked as needing a paid EAS plan. — [Expo docs](https://docs.expo.dev/eas/ai/mcp/)
- Community Expo MCPs also exist:
  - DaveDev42/expo-mcp (Maestro-based). — [Glama](https://glama.ai/mcp/servers/DaveDev42/expo-mcp)
  - andreahaku/expo_ios_development_mcp (simctl + Detox). — [Glama](https://glama.ai/mcp/servers/andreahaku/expo_ios_development_mcp)

**Apple: Xcode 26.3 / Xcode 27 agentic features and `xcrun mcpbridge` (it exists)**
- Xcode 26.3 shipped on 3 Feb 2026. It includes Claude Agent and Codex, plus MCP so that external agents can connect. — [alternativeto](https://alternativeto.net/news/2026/2/xcode-26-3-adds-agentic-coding-with-claude-agent-codex-and-other-ai-tools-via-mcp); [rudrank.com](https://rudrank.com/exploring-xcode-using-mcp-tools-cursor-external-clients)
- `mcpbridge` is a binary that translates between MCP and Xcode's XPC layer. It needs Xcode running with a project open. — [dev.to](https://dev.to/arshtechpro/xcode-263-use-ai-agents-from-cursor-claude-code-beyond-4dmi)
- To enable it, go to Settings → Intelligence → Model Context Protocol → Xcode Tools, then run `claude mcp add --transport stdio xcode -- xcrun mcpbridge`. — [dev.to](https://dev.to/arshtechpro/xcode-263-use-ai-agents-from-cursor-claude-code-beyond-4dmi)
- It exposes about 20 tools: build, tests, SwiftUI previews, doc search and file structure. — [dev.to](https://dev.to/arshtechpro/xcode-263-use-ai-agents-from-cursor-claude-code-beyond-4dmi)
- A permission dialog appears; the unofficial xcode-mcp-manager auto-dismisses it. — [xcode-mcp-manager](https://github.com/ndrblinov/xcode-mcp-manager)
- Xcode 27 was announced at WWDC on 8 Jun 2026:
  - Agent transcripts live in the editor, and there is a `/plan` command.
  - Device Hub gives one window for simulators and physical devices, with screenshots, rotation, Dynamic Type and appearance.
  - — [InfoQ, 15 Jun 2026](https://www.infoq.com/news/2026/06/xcode-27-agents-device-hub/); [Apple WWDC26 session 258](https://developer.apple.com/videos/play/wwdc2026/258/)
  - InfoQ does not mention agents driving the simulator UI, or a Device Hub CLI.
- Claims that Xcode 27 ships first-party agent skills, including a "device-interaction" skill that lets agents drive the simulator, come only from secondary blogs. — [dev.to](https://dev.to/arshtechpro/wwdc-2026-xcode-27-ships-with-apples-own-agent-skills-what-they-are-and-how-to-use-them-3g2); [byteiota](https://byteiota.com/xcode-27-agentic-coding-mcp-guide/)

**Appium (XCUITest) and Appium MCP**
- The official repo is `appium/appium-mcp`, covering Android (UiAutomator2) and iOS (XCUITest). For iOS it needs macOS and Xcode from the App Store. — [GitHub](https://github.com/appium/mcp-appium); [lobehub listing](https://lobehub.com/mcp/appium-appium-mcp)
- The Node requirement is reported as v22+ by one source and v14+ by another. — [Glama listing](https://glama.ai/mcp/servers/AppiumTestDistribution/appium-mcp)

**simctl (needs full Xcode)**
- Grant, revoke or reset permissions: `xcrun simctl privacy <UDID> grant|revoke|reset <service> <bundle-id>`. — [node-simctl / notificare](https://notificare.com/blog/2020/05/22/Using-iOS-Simulator-with-the-Command-Line/)
- `addmedia` adds PNG, JPEG, GIF, MOV, MP4 or vCard files to the device. — [notificare](https://notificare.com/blog/2020/05/22/Using-iOS-Simulator-with-the-Command-Line/)
- `io booted screenshot` and `io booted recordVideo` record until Ctrl-C. — [linuxcommandlibrary](https://linuxcommandlibrary.com/man/simctl)
- `push booted <bundleid> payload.json` sends a push notification to a running app. — [notificare](https://notificare.com/blog/2020/05/22/Using-iOS-Simulator-with-the-Command-Line/)
- `location` sets a fixed coordinate or runs a scenario. — [tessl simctl reference](https://tessl.io/registry/dpearson2699/swift-ios-skills/3.9.0/files/skills/ios-simulator/references/simctl-commands.md)

### Inferences
- Pre-rename "XcodeBuildMCP" instructions may install a stale npm package. The user should install `mobilebuildmcp`.
- MobileBuildMCP and AXe use HID through a pinned idb fork, so they do not depend on upstream idb. ios-simulator-mcp still needs Python idb, which is an extra failure point.
- For this Expo app, the cheapest high-signal loop has three parts:
  - Expo MCP's `automation_*` tools, addressing elements by testID, which the user already gets on SDK 54.
  - MobileBuildMCP or AXe for the native layer.
  - Maestro YAML flows as regression assertions.
- `mcpbridge` adds little for a managed Expo project with no `ios/` folder unless `npx expo prebuild` generates one.
- Development builds currently go through EAS. A local loop needs `npx expo run:ios`, which needs full Xcode. This avoids EAS build credits (see skills.md #4).

### Gaps
- Detox: I found no source confirming Detox support for Expo SDK 54 / RN 0.81 or its 2026 release status. A search returned only general Expo 54 material.
- Appium MCP's current README was not fetched directly, so the embedded-driver claim comes from a fork (AppiumTestDistribution).
- I did not verify Apple-primary documentation for the Xcode 27 "device-interaction" agent skill.
- I did not determine whether upstream facebook/idb is actively maintained in 2026.
- I did not find Maestro Studio's 2026 agent features.

## Q2. Hard prerequisites (Xcode, macOS, disk, Apple ID, Docker/Linux)

### Takeaway
Every simulator-driving tool needs full Xcode.app; Command Line Tools alone have no `simctl` (confirmed locally). This Mac (macOS 26.6, M5, 217 GiB free) meets the floor for the newest Xcode 27.x. Maestro would also need a JDK 17+, because only Java 8 is installed. Nothing here runs in Docker or Linux.

### Cited Findings
- Minimum macOS for each Xcode version:
  - Xcode 27, 27.1 and 27.2 RC need macOS Tahoe 26.6+. They support device and simulator iOS 17+ and use Swift 6.4.
  - Xcode 26.4.1–26.6 need Tahoe 26.2+.
  - Xcode 26.0–26.3 need Sequoia 15.6+.
  - Xcode 27 drops device and simulator support below iOS 17.
  - — [Apple system requirements](https://developer.apple.com/xcode/system-requirements/)
- The App Store download is about 3 GB (about 3.1 GB per one guide). That figure excludes simulator runtimes and DerivedData. — [macmyths](https://macmyths.com/how-to-build-and-run-ios-apps-on-a-macbook-neo/); [App Store](https://apps.apple.com/nz/app/xcode/id497799835?mt=12)
- Simulator runtimes are separate downloads. One third-party estimate puts each at 5–10 GB; Apple gives no official figure. — [Q2 docs](https://mobile.q2developer.com/docs/msdk/ios/setup/prerequisites/system-requirements)
- Bitrise measured a tvOS 26 runtime at 4.83 GB universal versus 3.62 GB Apple-silicon-only. — [Bitrise](https://bitrise.io/blog/post/xcode-app-size-reduction-in-26-0-beta-5)
- Maestro's iOS setup requires Xcode from the App Store, then `xcodebuild -runFirstLaunch` and `sudo xcodebuild -license accept`. — [Maestro](https://docs.maestro.dev/getting-started/installing-maestro)
- ios-simulator-mcp and mobile-mcp say iOS simulators only run on macOS, and ios-simulator-mcp states it has no remote endpoint. — [ios-simulator-mcp README](https://github.com/joshuayoes/ios-simulator-mcp); [mcp.directory](https://mcp.directory/blog/ios-simulator-mcp-complete-guide-2026)
- Expo MCP's local iOS capabilities "require a macOS host". — [Expo docs](https://docs.expo.dev/eas/ai/mcp/)

### Inferences
- Plan for about 3 GB for the Xcode download, around 10–12 GB once unpacked (not sourced), and about 4–10 GB per iOS runtime. Install one runtime only (iOS 26.x or 27.x). The 217 GiB free here is ample.
- An Apple ID is needed to download Xcode from the App Store or developer.apple.com. The simulator itself needs no paid membership. Physical-device installs need signing: a free personal team works with 7-day profiles, or a paid account.
- Docker/Linux: the simulator is macOS-only, so there is no Linux path. Remote Mac clouds, such as Maestro Cloud or Mobile Next cloud devices, are the only off-Mac options.

### Gaps
- I did not fetch an Apple primary source on whether an Apple ID is required for xcodes or downloads, or on the exact unpacked size of Xcode 27.
- I did not find a primary source for "no Docker".

## Q3. How agents verify UI: screenshots vs accessibility tree vs assertions

### Takeaway
Use the accessibility tree or view hierarchy as the default: AXe `describe-ui`, MobileBuildMCP `snapshot_ui`, Maestro `inspect_screen`, mobile-mcp element lists, or Expo `automation_find_view` by testID. It is text, cheap, and lets the agent target elements by label. Reserve screenshots for genuinely visual checks such as layout and the quality of the cutout image. Encode stable checks as Maestro YAML flows so they re-run deterministically without spending model tokens.

### Cited Findings
- mobile-mcp says the accessibility tree is primary and needs "no vision model, no image tokens", with screenshots as a fallback only. — [mobile-mcp](https://github.com/mobile-next/mobile-mcp)
- Maestro MCP's `inspect_screen` returns the view hierarchy as compact JSON, and `run` executes inline YAML flows. — [Maestro MCP](https://docs.maestro.dev/getting-started/maestro-mcp)
- In MobileBuildMCP, `snapshot_ui` returns element references with screen hashes, and `wait_for_ui` and `batch` cut round-trips. — [releases](https://github.com/getsentry/XcodeBuildMCP/releases)
- Expo's `automation_take_screenshot` can capture a single view by testID rather than the whole screen. — [Expo docs](https://docs.expo.dev/eas/ai/mcp/)

### Inferences
- Batching (`batch` in MobileBuildMCP or mobile-mcp) plus `wait_for_ui` should be the main way to stop flaky timing and keep token use down.
- testIDs on RN components are the cross-tool anchor. Expo MCP, Maestro (`id:`) and the accessibility trees all pick them up.

### Gaps
- I found no quantitative benchmark (tokens per step, flake rate) comparing screenshot loops with accessibility-tree loops.
- I did not research snapshot testing tooling for RN in 2026.

## Q4. Simulator limits relevant to this app

### Takeaway
There are two hard blockers on the Simulator:
- **Camera:** there is no camera at all. Third-party virtual-camera injectors exist, or use `simctl addmedia` with the image-picker path.
- **`VNGenerateForegroundInstanceMaskRequest`:** it fails with "Could not create inference context". Apple says it is not supported on CPU, so it won't run in the simulator.

The custom subject-cutout module therefore has to be verified on a physical device. Push notifications can be simulated with `simctl push`.

### Cited Findings
- **Foreground mask:** An Apple Frameworks Engineer (Sep 2024) said the request "is not supported on the CPU, so it will not run in the simulator". Forcing CPU gives `unsupported compute device <MLCPUComputeDevice>`. — [Apple Dev Forums 764948](https://developer.apple.com/forums/thread/764948)
- **Possible later fix:** One anecdotal report says a similar Vision-on-simulator issue was "fixed in iOS 26.2 beta". It is unverified and not specific to this request. — [search summary of Apple forums](https://developer.apple.com/forums/thread/772245)
- **Camera:**
  - In iOS 26.5 and iOS 27 simulators, `AVCaptureDevice` lists zero cameras, and no Xcode 26 or 27 release note adds one. — [SimulatorCamera](https://github.com/dautovri/SimulatorCamera); [glint issue #226 (Oct 2026)](https://github.com/Lukas-io/glint/issues/226)
  - Workarounds are third-party:
    - SimulatorCamera uses a CMIOExtension virtual camera and an injected library, tested on iOS 26.5 and 27.0. — [SimulatorCamera](https://github.com/dautovri/SimulatorCamera)
    - SimReel feeds images, video, QR codes or the webcam, and supports AVCaptureDevice discovery and photo capture. It does not support movie output, depth, Live Photos or ARKit, and was tested on iOS 26.5 on Apple silicon. — [SimReel](https://github.com/SolankiYogesh/simreel)
    - RocketSim offers camera streaming as a paid app. — [RocketSim](https://www.rocketsim.app/docs/features/capturing/simulator-camera-support/)
  - Injected-library approaches need re-checking with each Xcode release. — [SimReel](https://solankiyogesh.github.io/simreel/)
- **Photos:** `simctl addmedia` seeds the photo library with PNG, JPEG, GIF, MOV or MP4. — [notificare](https://notificare.com/blog/2020/05/22/Using-iOS-Simulator-with-the-Command-Line/)
- **Push:** `simctl push booted <bundle> file.json`. — [notificare](https://notificare.com/blog/2020/05/22/Using-iOS-Simulator-with-the-Command-Line/)
- **Location:** set with `simctl location` or mobile-mcp's GPS override. — [mobile-mcp](https://github.com/mobile-next/mobile-mcp)

### Inferences
- **Camera and image-picker path:** seed real test photos with `simctl addmedia`, then drive the expo-image-picker path. Grant photo access first with `simctl privacy … grant photos` so the permission dialog doesn't block the flow. expo-camera screens can only be exercised with SimulatorCamera or SimReel, which is fragile, or on a device.
- **Cutout:** this is exactly what skills.md #6 describes. The Swift module must either guard with an `#if targetEnvironment(simulator)` fallback (for example, the server-side rembg path or a fixture mask) so the rest of the flow is testable on the simulator, or be verified on device.
- **TTS and haptics:** expo-speech uses AVSpeechSynthesizer and should produce audio on the simulator. Haptics do nothing on the simulator, because the Mac has no Taptic engine.

### Gaps
- I found no primary source confirming that `VNGenerateForegroundInstanceMaskRequest` still fails on iOS 26.x or 27 simulators specifically. The only primary evidence is from 2024, plus one unverified 26.2-beta anecdote. This should be tested directly once Xcode is installed.
- I found no sources on simulator behavior for expo-speech/AVSpeechSynthesizer or haptics.
- I did not fetch a primary source on remote APNs delivery to simulators (Xcode 14+ / Apple silicon).

## Q5. Physical-device automation for agents

### Takeaway
Device automation is possible but heavier, and every route needs code signing.

| Route | Device support |
|---|---|
| mobile-mcp | Real iOS devices over USB once trusted |
| MobileBuildMCP device tools | Real devices, with signing configured in Xcode |
| Appium MCP / XCUITest | Real devices (needs WebDriverAgent signing) |
| Maestro | Real-iPhone support disputed across sources |
| Expo MCP | Physical devices not yet supported |

### Cited Findings
- mobile-mcp supports a real iOS device "connected over USB and trusted". — [mobile-mcp](https://github.com/mobile-next/mobile-mcp)
- MobileBuildMCP: "Device tools require code signing to be configured in Xcode." — [README](https://github.com/getsentry/XcodeBuildMCP)
- Expo MCP: physical devices are "not yet supported". — [Expo docs](https://docs.expo.dev/eas/ai/mcp/)
- Maestro on real iOS devices: sources conflict (see Q1). — [mcp.so](https://mcp.so/servers/maestro)
- Appium MCP lists real devices among its targets. — [lobehub](https://lobehub.com/mcp/appium-appium-mcp)
- Xcode 27 Device Hub manages simulators and physical devices in one window, but that window is aimed at people rather than CLI use. — [InfoQ](https://www.infoq.com/news/2026/06/xcode-27-agents-device-hub/)

### Inferences
- For this app, keep a physical-device step for the Vision cutout and the camera. Have the agent install builds with MobileBuildMCP device tools or `xcrun devicectl`, then capture results with screenshots or logs. Expect a human to unlock the device and accept trust prompts.

### Gaps
- I did not research `xcrun devicectl` capabilities (install, launch, log, screenshot) in Xcode 26/27.
- I did not research mobile-mcp's real-device backend: whether it uses WebDriverAgent, and its signing friction.
- I did not research real-device screenshot paths.
