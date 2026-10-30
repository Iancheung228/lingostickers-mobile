# Sandboxing, Safety and Cost for Unattended Claude Code Loops on a Solo iOS-Dev Mac

Research date: 2026-10-28. Claude Code doc pages fetched the same day. Version numbers (v2.1.xxx) are taken from the docs. Context: a solo developer on Apple Silicon macOS with Xcode Command Line Tools only. The repo has a `.env` with production Supabase keys. `eas.json` points at an App Store Connect API key in `~/.eas-keys`. Production Supabase is deployed from this machine, EAS builds are rationed at 15 per month, and the user wants to approve builds.

## 1. Claude Code safety controls: permission modes, sandbox, rules, hooks, managed settings, worktrees, containers, VMs

### Takeaway
For an unattended loop on the host Mac, use **auto mode, or `-p --permission-mode auto --permission-prompts none`, with the Seatbelt sandbox turned on and `allowUnsandboxedCommands: false`**. On top of that, add **deny rules** for production-touching commands (`eas build`, `eas submit`, `supabase db push`, `supabase functions deploy`, `git push`). The docs say deny rules hold in every mode, including bypass. Keep `bypassPermissions` / `--dangerously-skip-permissions` for a real VM: the docs restrict it to "isolated containers and VMs only". Devcontainers can't host Xcode or Simulator. A Tart macOS VM can host Xcode, but Simulator in VMs has had an Apple-acknowledged known issue.

### Cited Findings

**Permission modes (current docs)**
- There are six modes. `default`/Manual prompts for edits, shell and network. `acceptEdits` auto-approves edits plus `mkdir/touch/mv/cp/rm/rmdir/sed` inside the working dir. `plan` is read-only until the plan is approved. `auto` sends every action through a background classifier. `dontAsk` denies anything that would prompt and is meant for "locked-down CI". `bypassPermissions` runs everything and is meant for "isolated containers and VMs only". — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- "Deny rules apply in every mode, including `bypassPermissions`. Allow rules have no effect in `bypassPermissions`." — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- Auto mode's decision order is rules first, then a fast path for reads and working-dir edits, then the classifier. The default classifier model is Sonnet 5, overridable with `CLAUDE_CODE_AUTO_MODE_MODEL` (v2.1.302+). Tool results are stripped from classifier requests so that injected content can't steer it. Subagents are checked at spawn, on each action, and at finish. — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- Entering auto mode drops broad allow rules (`Bash(*)`, wildcarded interpreters such as `Bash(python*)`, package-manager run commands, `Agent`/`Monitor` rules). Narrow rules such as `Bash(npm test)` stay. — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- Auto mode **blocks by default**: `curl | bash`, production deploys and migrations, force push, `git reset --hard`, `git clean -fd`, printing live credentials into the transcript, "launching unattended agent loops (such as `--dangerously-skip-permissions`)", and writing to transcripts under `~/.claude/projects/`. It **allows by default**: "Reading `.env` and sending credentials to their matching API", and "Pushing to any branch of the current repository" (deploy-like branches are judged separately). — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- **Fallback:** "After 3 consecutive blocks or 20 total blocks, auto mode pauses and Claude Code resumes prompting. The thresholds aren't configurable." Boundaries given in chat ("don't push") are not stored as rules and "context compaction can drop them. Use deny rules for hard guarantees." — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- Auto mode is available on all plans. From v2.1.283 it is the built-in starting mode for terminal and VS Code. It needs Opus 4.6+ / Sonnet 4.6+ / Haiku 5.5 / Fable on the Anthropic API. — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- From v2.1.302, `claude -p` with no mode set **starts in Manual and denies anything needing approval**. Use `--permission-mode auto` to change this. — [Permission modes](https://code.claude.com/docs/en/permission-modes); [Headless](https://code.claude.com/docs/en/headless)
- `--permission-prompts none` (v2.1.259+) is for runs nobody is watching. Anything that would prompt is denied unless a `PermissionRequest` hook allows it. Claude is told not to retry, `AskUserQuestion` is removed, and denials appear as `permission_denied` events in stream-json. Doc example: `claude -p "..." --permission-mode auto --permission-prompts none`. — [Headless](https://code.claude.com/docs/en/headless)
- **bypassPermissions details:** "offers no protection against prompt injection". It is refused under root/sudo on macOS unless inside a recognized sandbox. It can't be entered mid-session unless the session started with it. Admins can disable it with `permissions.disableBypassPermissionsMode: "disable"`. — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- **Protected paths** (`.git`, `.claude`, `.vscode`, `.husky`, shell rc files, `.gitconfig`, `.mcp.json`, `.npmrc`, etc.) are never auto-approved except under bypass. `rm` of critical paths (home, root, the working dir and its parents) "cannot be approved by any allow rule" in any mode, but the check is "best-effort and doesn't replace OS-level sandboxing." — [Permission modes](https://code.claude.com/docs/en/permission-modes)

**Built-in sandbox (`/sandbox`)**
- On macOS it uses **Seatbelt**. It is off by default. Enable it with `/sandbox` or `"sandbox": {"enabled": true}`. `sandbox.failIfUnavailable: true` makes Claude Code exit rather than run unsandboxed. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- **Scope gap:** it covers Bash/PowerShell/Monitor and their children. It does **not** cover the Read/Edit/Write tools, WebFetch/WebSearch, MCP servers, hooks, LSP, the status line or `apiKeyHelper`. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- **Filesystem defaults:** writes are allowed to the cwd, a per-user `$TMPDIR` and `--add-dir` paths. **Reads are allowed for "most of the machine, including `~/.ssh` and `~/.aws/credentials`. Protect these explicitly."** The settings are `sandbox.filesystem.allowWrite/denyWrite/denyRead/allowRead`. `permissions.blockReadsOutsideWorkingDirectories` blocks home-directory reads. Protected paths (`.claude/settings*`, `.git/hooks`, `~/.claude`, `.zshrc`, …) stay write-denied so a command can't grant itself permissions. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- **Network:** there is no direct route. Traffic goes through a local proxy with a hostname allowlist that starts **empty**. On macOS, Seatbelt blocks everything except the proxy. Tools that ignore proxy variables ("plain `ssh`, most database drivers") can't connect. UDP/QUIC/ICMP are blocked. TLS is not inspected by default. Settings: `network.allowedDomains`, `deniedDomains`, `strictAllowlist`, and `network.allowLocalBinding` (macOS: lets sandboxed commands bind and connect to localhost). Loopback-only names are refused unless the IP:port is added, e.g. `"127.0.0.1:3000"`. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- How an unlisted host is handled depends on the mode. `bypassPermissions` allows it without a prompt. Manual and acceptEdits prompt. Auto refuses unless the classifier approved it. dontAsk refuses. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- **Auto-allow:** with `sandbox.autoAllowBashIfSandboxed` (default true), sandboxed commands run without a prompt in any mode. Bash **deny** rules and content-scoped **ask** rules (e.g. `Bash(git push *)`) still apply. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- **Escape hatches:** when a command fails, Claude may retry with `dangerouslyDisableSandbox`. Set `sandbox.allowUnsandboxedCommands: false` ("Strict sandbox mode") to disable that retry. `sandbox.excludedCommands` runs matched commands fully unsandboxed. Every part of a chained command must match, and absolute paths don't match. Excluding interpreters lets Claude "write and then run code outside the sandbox." — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- **macOS incompatibilities relevant here:** `docker` (exclude a narrow pattern like `docker compose *`); `watchman` (use `jest --no-watchman`); Go CLIs (`gh`, `terraform`) fail TLS verification under Seatbelt; `open`/`osascript`/Apple Events fail with `-600` unless `allowAppleEvents: true`; git over SSH fails (use HTTPS); localhost services need `allowLocalBinding`. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- Recommended baseline: `{"sandbox":{"enabled":true,"failIfUnavailable":true,"allowUnsandboxedCommands":false}}`. Put that in managed settings, plus `false` for `enableWeakerNetworkIsolation`, `network.allowAllUnixSockets` and `network.allowLocalBinding`, so a repo can't weaken it. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- Anthropic's engineering post (Oct 20, 2025) says sandboxing "safely reduces permission prompts by 84%" internally. It argues that "effective sandboxing requires *both* filesystem and network isolation". The runtime is open source as `anthropic-experimental/sandbox-runtime`. In Claude Code on the web, git credentials are "never inside the sandbox". A proxy injects the real token after checking the request. — [Anthropic Engineering: Claude Code sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)

**settings.json rules**
- Rules are evaluated deny, then ask, then allow, and the first match wins. "An allow rule can't carve an exception out of a deny rule." — [Permissions](https://code.claude.com/docs/en/permissions)
- Bash argument patterns are "fragile". `Bash(curl *)` won't match `/usr/bin/curl …` or `sh -c 'curl …'`, so pair Bash denies with the sandbox network allowlist "when the restriction must hold". — [Permissions](https://code.claude.com/docs/en/permissions)
- PreToolUse hook decisions "don't bypass permission rules". A matching deny rule blocks even if the hook returned allow. — [Permissions](https://code.claude.com/docs/en/permissions)

**Hooks**
- PreToolUse receives `tool_name` and `tool_input` (`tool_input.command` for Bash). There are two ways to block. Exit code 2 makes stderr the reason, and it blocks even if JSON says allow. Or print JSON `hookSpecificOutput.permissionDecision: "deny"` (also `allow|ask|defer`) with a reason. — [Hooks](https://code.claude.com/docs/en/hooks)
- The per-handler `"if": "Bash(git *)"` filter strips leading `VAR=value` assignments and checks subcommands and `$()`. The docs call it "best-effort, so use the permission system for hard allow or deny rules." A PreToolUse hook that times out does **not** block unless `"onFailure": "block"` is set (v2.1.295+). Hooks run with full user permissions and are outside the sandbox. — [Hooks](https://code.claude.com/docs/en/hooks); [Sandboxing](https://code.claude.com/docs/en/sandboxing)

**Running under `-p` in untrusted folders**
- Without `--bare`, a `-p` session runs the project's `.claude/settings.json` hooks and `.mcp.json` servers "even in a folder you've never trusted", with no trust dialog. `--bare` skips CLAUDE.md, hooks, skills, MCP and auto memory. It needs `ANTHROPIC_API_KEY` because it doesn't read OAuth or Keychain. — [Headless](https://code.claude.com/docs/en/headless)

**Worktrees / containers / VMs**
- Under the sandbox, git worktrees can write to the main repo's shared `.git`, but `hooks/` and `config` there stay denied. `.claude/worktrees/` is exempt from protected-path handling. — [Sandboxing](https://code.claude.com/docs/en/sandboxing); [Permission modes](https://code.claude.com/docs/en/permission-modes)
- Tart is a CLI for macOS and Linux VMs on Apple Silicon, built on Apple's Virtualization.framework, with images distributed through OCI registries. — [tart.run](https://tart.run/)
- Prebuilt Xcode images include `ghcr.io/cirruslabs/macos-tahoe-xcode` and `ghcr.io/cirruslabs/macos-sequoia-xcode`, with default login `admin/admin` (change it). Host folders are shared with `tart run --dir=name:path[:ro]` and appear in the guest at `/Volumes/My Shared Files/<name>`. A new VM defaults to 2 CPU / 4 GB, and the base image is about 25 GB. — [Tart quick start](https://tart.run/quick-start/)
- Tart is under the Fair Source license and "Usage on personal computers including personal workstations is royalty-free". Free up to 100 CPU cores. — [Tart licensing](https://tart.run/licensing/)
- The macOS licence, section 2B(iii), permits "up to two additional copies or instances" of macOS in virtual environments on each Apple computer you own or control. This is limited to software development, testing during development, macOS Server, or personal non-commercial use. — [Eclectic Light (quoting the Monterey SLA)](https://eclecticlight.co/2022/08/04/virtualisation-on-apple-silicon-macs-8-how-apple-limits-vms/). I did not verify the current Tahoe SLA wording.
- **Simulator in VMs:** on Oct 15, 2025, CircleCI said Apple had confirmed (via a code-level support request) "a known issue with the iOS Simulator in macOS Virtual Machines" that Apple was investigating. This was in the Xcode 26 RC thread. The post gave no workaround. — [CircleCI Discuss](https://discuss.circleci.com/t/xcode-26-rc/54066/21)

### Inferences
- **Recommended tiering for this user:**
  - **Host Mac, unattended:** auto mode with the Seatbelt sandbox in strict mode (`allowUnsandboxedCommands:false`, `failIfUnavailable:true`), set in `~/.claude/settings.json` so a repo file can't loosen it.
  - Add `permissions.deny` for `Bash(eas build *)`, `Bash(eas submit *)`, `Bash(npx eas-cli build *)`, `Bash(npx eas-cli submit *)`, `Bash(supabase db push *)`, `Bash(npx supabase db push *)`, `Bash(supabase functions deploy *)`, `Bash(npx supabase functions deploy *)`, `Bash(supabase link *)` and `Bash(git push *)`.
  - Back those up with a PreToolUse hook that greps `tool_input.command` for `eas|supabase (db|functions|link|secrets)|git push` and exits 2, which also catches `sh -c`/path variants. Set `onFailure:"block"` on the hook.
  - Deny rules alone are pattern-fragile, so the sandbox network allowlist (leave `*.supabase.co`, `api.expo.dev` and `expo.dev` off it) is the real backstop. A sandboxed `eas`/`supabase` command can't reach its API even if a pattern is missed.
  - These deny rules also enforce the user's "builds need my approval" rule (memory: never run `eas build` without consent) mechanically rather than by instruction.
- **Xcode/simctl/Metro under Seatbelt** is not documented anywhere I found. `xcrun simctl` talks to CoreSimulatorService over XPC/Mach. Seatbelt's sandbox profile may block that, and `xcodebuild` writes to `~/Library/Developer/Xcode/DerivedData`, which is outside cwd. Expect to need narrow `excludedCommands` entries (`xcrun simctl *`, `xcodebuild *`), or `allowWrite` for DerivedData and CoreSimulator paths. Metro (port 8081) needs `network.allowLocalBinding: true` on macOS. `npx expo start` downloads need `registry.npmjs.org`/`exp.host` on the allowlist. **This needs testing, not assuming.**
- **Devcontainers** are Linux containers, and Docker on macOS runs a Linux VM. They can't run Xcode, `xcodebuild` or the iOS Simulator, which need macOS. They are still useful for the pure JS/TS/Deno (edge function) side of the loop with bypassPermissions.
- **Tart VM** is the closest thing to a safe "bypass" box for iOS work. Xcode images exist, and it is free for personal use. Limits: two macOS guests per Mac under the SLA; 25 GB+ per image plus ~10+ GB for Xcode and runtimes; and the Simulator-in-VM issue Apple acknowledged in 2025, so test it before relying on it. With only CLT installed on the host, a VM image that already has Xcode is also a way to avoid installing Xcode on the host at all.
- **Dedicated macOS user account** (no documentation fetched): a cheap middle ground. The agent runs as a standard user with no access to `~/.eas-keys`, Keychain, `~/.supabase` tokens or the main user's `.env`, and Xcode and Simulator still work natively. POSIX permissions do the isolation that Seatbelt `denyRead` does otherwise.

### Gaps
- I found no first-party or practitioner doc on how Claude Code's Seatbelt sandbox behaves with `xcodebuild`, `xcrun simctl`, CoreSimulator XPC, or `expo run:ios`.
- I could not confirm whether Apple fixed the Simulator-in-VM issue in Xcode 26.x or 27. Its status in late 2026 is unknown.
- I did not fetch the Claude Code docs pages on devcontainers, worktrees (`--worktree`, `EnterWorktree`) or managed-settings file paths. The macOS path is believed to be `/Library/Application Support/ClaudeCode/managed-settings.json`, but I did not verify it.
- I did not verify the current macOS SLA text (Tahoe/26).

## 2. Secrets: keeping production Supabase keys and App Store Connect keys away from an unattended agent

### Takeaway
Permission `Read` deny rules on `.env` are **not sufficient by themselves**. They only catch Claude's file tools and recognized commands like `cat`, not `grep -r` or a Node script. Only the sandbox's `denyRead` (OS-enforced) or not having the secret on disk in the agent's reach actually protects it. The safest pattern is to **move production secrets out of the repo the agent works in**. Give the agent a `.env` that points at a dev/local Supabase, and deny reads of `~/.eas-keys`, `~/.supabase`, `~/.ssh` and the Keychain at the sandbox layer.

### Cited Findings
- "To block Claude's file tools from reading a file or directory, add a `Read` deny rule … such as `Read(./.env)` or `Read(./secrets/**)`". A `.claudeignore` "has no effect". — [Permissions](https://code.claude.com/docs/en/permissions)
- "Read and Edit deny rules apply to Claude's built-in file tools, to file commands Claude Code recognizes in Bash, such as `cat`, `head`, `tail`, `sed`, and `tee`, and to … redirections … They don't apply to a command that reads files without naming them, such as `grep -r pattern .` … or to arbitrary subprocesses … like a Python or Node script … For OS-level enforcement … enable the sandbox." — [Permissions](https://code.claude.com/docs/en/permissions)
- `Read(.env)` is equivalent to `Read(**/.env)` (any depth under cwd). `Read(//**/.env)` covers the whole filesystem. A deny set in managed settings can't be cancelled by a project `!` negation. — [Permissions](https://code.claude.com/docs/en/permissions)
- The sandbox reads "most of the machine, including `~/.ssh` and `~/.aws/credentials`" by default. Use `sandbox.filesystem.denyRead` (e.g. `"denyRead": ["~/"], "allowRead": ["."]`). — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- `sandbox.credentials` can `deny` files or env vars (block or unset them) or `mask` them. Mask hands sandboxed commands a placeholder, and the proxy substitutes the real value only for `injectHosts`. Masking requires `network.tlsTerminate`, and "**On macOS, masked files are denied entirely rather than substituted.**" `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` strips credentials from all subprocesses. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)
- Auto mode's classifier by default **allows** "Reading `.env` and sending credentials to their matching API", and blocks "Printing live credentials into the transcript". — [Permission modes](https://code.claude.com/docs/en/permission-modes)
- Anthropic's own cloud design keeps credentials outside the sandbox entirely and has a proxy add auth after checking the request. — [Anthropic Engineering](https://www.anthropic.com/engineering/claude-code-sandboxing)

### Inferences
- In auto mode, an agent reading the production `.env` and then calling the production Supabase API counts as *allowed* behaviour by default. For this user that is the main risk: an agent "testing" a migration against production. Fix it with environment separation (section 3), not with classifier trust.
- Concrete layout:
  - Rename the production file to something outside the repo, e.g. `~/secrets/lingostickers.prod.env`, and load it only in the user's own deploy shell.
  - The repo `.env` holds local or staging URLs and keys only.
  - Add `Read(//**/.env.prod*)`, `Read(~/.eas-keys/**)`, `Read(~/.supabase/**)` and `Read(~/.ssh/**)` deny rules, plus sandbox `denyRead` on the same paths.
  - `supabase login` stores an access token. Check its location on disk; it may be in Keychain. Keep the agent away from it, or run the agent as a separate macOS user who never logged in.
- `EXPO_PUBLIC_*` anon keys are bundled into the app anyway and are low-risk. The **service-role key** and the **App Store Connect `.p8`** are the high-value secrets.

### Gaps
- I did not verify where the Supabase CLI stores its access token on macOS (Keychain vs `~/.supabase/access-token`) or where EAS stores its session (`~/.expo/state.json`).
- I found no practitioner write-up specific to Expo/EAS + Claude Code secret isolation.

## 3. Backend isolation: local Supabase, branching, staging project, edge functions

### Takeaway
Run the agent against **local Supabase** (`supabase start` on OrbStack or Colima, or the experimental native runtime meant for "coding agent sandboxes"). Use a **second free-plan project** as staging if needed. Branching is Pro-only ($25/month plus $0.01344 per branch-hour). The agent should never hold the production project ref or link.

### Cited Findings
- `supabase start` runs the stack in containers and needs a container runtime. For macOS the docs **recommend OrbStack** ("handles extended file attributes on mounted volumes and container networking more reliably… starts faster and uses fewer resources"). Rancher Desktop, Podman and colima are also supported. — [Supabase CLI getting started](https://supabase.com/docs/guides/local-development/cli/getting-started)
- **There is a new experimental "native runtime"** that "runs each service as a process instead of in a container. It's meant for coding agent sandboxes or CI runners without a container engine". It supports Linux and macOS on Apple silicon. — [Supabase CLI getting started](https://supabase.com/docs/guides/local-development/cli/getting-started)
- Local edge functions are served at `http://localhost:54321/functions/v1`. To reach the local database from a function, replace `localhost` with `host.docker.internal`. — [Supabase CLI getting started](https://supabase.com/docs/guides/local-development/cli/getting-started)
- Free plan: **2 active projects** (paused ones don't count), **paused after 1 week of inactivity**, 500 MB database, 500k edge function invocations. Pro is from $25/month with $10/month compute credits. **Branching is $0.01344 per branch per hour, on Pro and above only.** — [Supabase pricing](https://supabase.com/pricing)
- The Claude Code sandbox is incompatible with `docker`. The fix is a narrow `excludedCommands` entry such as `docker compose *`. Database clients ignore the proxy and must be excluded and then put under an ask rule. — [Sandboxing](https://code.claude.com/docs/en/sandboxing)

### Inferences
- The user currently has one production project. A second free project as staging fits within the 2-active limit. It will auto-pause after a week idle, so a loop should wake or restore it first, or tolerate it being paused.
- Branching would cost roughly $10/month for one always-on branch (0.01344 × 730 h ≈ $9.81) and requires moving production to Pro ($25+). For a solo developer, local or native-runtime Supabase is cheaper and keeps the agent off the network entirely.
- Since `supabase start` needs Docker, which the sandbox can't run, either (a) start the stack yourself before the loop and let sandboxed commands reach `127.0.0.1:54321` via `allowLocalBinding` and the `"127.0.0.1:54321"` allowlist entry, or (b) try the native runtime, which was designed for this case.
- Note from the project's own skills.md: a Gemini/Groq call inside an edge function served locally still hits the real third-party AI API and quota. Use a separate dev API key with its own cap.
- `supabase db push`, `supabase functions deploy` and `supabase link` should stay human-only (deny rules plus hook). Auto mode already blocks "production deploys and migrations" by default ([Permission modes](https://code.claude.com/docs/en/permission-modes)), but that depends on the classifier recognising them as production.

### Gaps
- I did not fetch the Supabase branching docs, so I can't say whether branching requires GitHub integration or how preview branches handle edge-function secrets.
- I did not fetch the `supabase functions serve` docs (hot reload, `--env-file`, JWT verification flags).
- I found no resource requirements for the local stack. The native runtime's maturity is unknown beyond "experimental".

## 4. Cost and rate limits

### Takeaway
On a subscription, Pro and Max limits are a **5-hour session window plus a weekly limit, shared with claude.ai**, with a **separate weekly Fable limit on Max**. Anthropic publishes no exact numbers. Usage credits continue past limits at API rates. On the API, Sonnet 5.5 costs $2/$10 per MTok and Opus 5.5 $4/$20. Practitioners commonly quote about **$10 per hour** for a continuous Sonnet loop. Cap spend with `--max-budget-usd`, iteration caps, Sonnet or Haiku for subagents, and `/clear` between iterations.

### Cited Findings
- Pro and Max both have a five-hour session limit and a weekly limit. "Max plans also have a separate weekly limit for Fable models." Claude and Claude Code share the limits. Usage credits let Pro and Max continue past limits. Monthly API credits included with Max "can't be used in Claude Code". The article gives no numeric caps. — [Using Claude Code with Pro or Max](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan)
- Third-party sources put Max at $100/month (5x) and $200/month (20x). Historical (2025) Anthropic estimates such as "40–80 hours of Sonnet 4 per week on Pro" are outdated and no longer published. — [Leanware](https://leanware.co/insights/claude-max-plan); [Tom's Guide (2025)](https://www.tomsguide.com/ai/anthropic-is-putting-a-limit-on-a-claude-ai-feature-because-people-are-using-it-24-7)
- On v2.1.234+ Claude Code can wait for a usage-limit reset and continue automatically (`autoContinueAtUsageLimit`). — [Costs](https://code.claude.com/docs/en/costs)
- Enterprise average: "~$13 per developer per active day and $150–250 per developer per month… below $30 per active day for 90% of users." — [Costs](https://code.claude.com/docs/en/costs)
- **API list prices (per MTok, input/output):**

  | Model | Input | Output | Cache hit |
  |---|---|---|---|
  | Opus 5.5 | $4 | $20 | $0.20 |
  | Sonnet 5.5 | $2 | $10 | $0.10 |
  | Sonnet 5 | $2 | $10 | — |
  | Haiku 5.5 (prompt ≤100k) | $0.10 | $0.50 | — |
  | Haiku 5.5 (prompt >100k) | $0.50 | $2.50 | — |
  | Fable 5.1 | $10 | $50 | — |

  The Batch API is 50% off. The 1M context is at standard price for 4.6+ models except Haiku 5.5. — [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Thinking can't be turned off on Opus 5.5, Sonnet 5.5, Haiku 5.5 or Fable. Thinking tokens bill as output, so use `/effort` to reduce them. — [Costs](https://code.claude.com/docs/en/costs)
- Cost levers in the docs:
  - Sonnet for most work.
  - `model: haiku` for simple subagents.
  - Agent teams use about 7x the tokens of a standard session.
  - `/clear` between tasks.
  - Prefer CLI tools to MCP.
  - Use hooks to filter test output.
  - Background idle usage is under $0.04 per session.
  - Long sessions climb because the full context is resent and cache misses happen after the TTL expires.

  — [Costs](https://code.claude.com/docs/en/costs)
- `--max-budget-usd` caps a `-p` run, and remaining background work is stopped when it is hit. `--output-format json` reports `total_cost_usd`; these are client-side estimates. — [Headless](https://code.claude.com/docs/en/headless)
- **Practitioner Ralph-loop costs (anecdotal):** about $10.42/hour with Sonnet over a 24-hour burn ([claudefa.st](https://claudefa.st/blog/guide/mechanics/ralph-wiggum-technique)). "Roughly $10 an hour in API credits" ([dev.to](https://dev.to/sivarampg/the-ralph-wiggum-approach-running-ai-coding-agents-for-hours-not-minutes-57c1)). $12 overnight for 47 commits ([thebiggish](https://thebiggish.pages.dev/news/ralph-wiggum-autonomous-coding-loops-overnight-development-costs-12-delivers-47-commits)). $297 for 6 repos at a YC hackathon, and $50–100+ for a 50-iteration loop ([atcyrus](https://www.atcyrus.com/stories/ralph-wiggum-technique-claude-code-autonomous-loops)). These are mostly 2025-era prices on Sonnet 4.x at $3/$15, which is higher than today's Sonnet 5.5 at $2/$10.
- The official Ralph plugin's `--max-iterations` "isn't just a safety mechanism — it's cost control". Community wrappers expose `RALPH_COST_LIMIT`. — [atcyrus](https://www.atcyrus.com/stories/ralph-wiggum-technique-claude-code-autonomous-loops)

### Inferences
- Re-scaling the roughly $10/hour Sonnet-4.x anecdotes to Sonnet 5.5 prices (input and output about a third lower, cache hits a third of the old $0.30) suggests about **$5–7 per hour** of continuous Sonnet 5.5 looping on the API. Opus 5.5 would be about twice that. This is an estimate, not a measurement.
- For a solo developer looping several hours a day, Max 20x at about $200/month is likely cheaper than the API. Limits are opaque, though, so check `/usage` (24h/7d view and the **Loops** rows) after the first overnight run.
- **Screenshot token cost:** per Anthropic's vision docs (training knowledge, not re-fetched this session), image tokens ≈ width×height/750, capped at about 1.6k tokens for a ~1.15 MP image. An iPhone Simulator screenshot downscaled to about 1092×1092 is roughly 1.6k input tokens, about $0.003 each on Sonnet 5.5. Since the image stays in context and is resent each turn (cached at $0.10/MTok), screenshot-heavy verification costs more because context bloats than because of per-image fees. Delegate screenshot checks to a Haiku 5.5 subagent so the images never enter the main context.

### Gaps
- There are no official numeric Pro or Max 5-hour or weekly caps for late 2026, and no definition of what counts toward the Fable limit.
- I found no fresh late-2026 practitioner measurements of loop cost on Sonnet 5.5 or Opus 5.5.
- I did not re-verify the image-token formula on platform docs this session.

## 5. Observability and stopping criteria for unattended runs

### Takeaway
Run `claude -p … --output-format stream-json --verbose` and tee it to a log. Read `system/init`, `system/api_retry`, `permission_denied` and the final `result` (cost, session id). Wire the `Notification` hook (`permission_prompt`, `idle_prompt`) and the `Stop` and `SessionEnd` hooks to a push service. Bound every loop with `--max-budget-usd`, an iteration cap, and a test-based completion check.

### Cited Findings
- `--output-format stream-json` emits NDJSON, and the last line is a `result` with response, cost and session metadata. `--include-partial-messages` streams tokens. Subagent messages carry `parent_tool_use_id`, and `--forward-subagent-text` includes their text and thinking. — [Headless](https://code.claude.com/docs/en/headless)
- The `system/api_retry` event has fields `attempt`, `max_retries`, `retry_delay_ms` and `error` (`rate_limit`, `overloaded`, `billing_error`, …). `system/init` lists the model, tools, MCP servers and `plugin_errors`. — [Headless](https://code.claude.com/docs/en/headless)
- SIGTERM exits with code 143 and runs `SessionEnd` hooks. SIGINT ends the turn cleanly. `CLAUDE_CODE_RESUME_INTERRUPTED_TURN=1` resumes the interrupted turn. `--resume <session_id>` continues a run. Background work is capped at 10 minutes idle by default (`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`). — [Headless](https://code.claude.com/docs/en/headless)
- The `Notification` hook matchers include `permission_prompt` and `idle_prompt`. It is side-effect only. `Stop` with `"decision":"block"` plus a reason (or exit 2) **prevents stopping and continues**; this is the documented basis for a Ralph-style "keep going until done" loop. `SessionEnd` hooks share a 1.5 s budget, raisable to 60 s with per-hook `timeout`. Setting `"async": true` keeps a hook non-blocking. `"asyncRewake": true` wakes Claude when the hook exits 2. — [Hooks](https://code.claude.com/docs/en/hooks)
- `/usage` shows a Loops breakdown (v2.1.242+). Status lines can read cost and prompt-cache fields. OpenTelemetry export streams per-user token and cost metrics. — [Costs](https://code.claude.com/docs/en/costs)
- Auto mode pauses into prompting after 3 consecutive or 20 total classifier blocks. Unattended with `--permission-prompts none`, those become denials instead. — [Permission modes](https://code.claude.com/docs/en/permission-modes); [Headless](https://code.claude.com/docs/en/headless)

### Inferences
- **Stopping criteria to combine:**
  - A `--max-budget-usd` hard cap per run.
  - An outer-loop iteration cap.
  - A `Stop` hook that only blocks stopping while `npm test` / `npm run typecheck:functions` fail and an iteration counter file is under N.
  - Abort on N consecutive `permission_denied` events or `api_retry` with `error: rate_limit` or `billing_error`.
- **Push notifications:** a `Notification` or `Stop` hook that `curl`s ntfy.sh or Pushover is the common pattern. Hooks run outside the sandbox, so the hook itself can reach the network even with a strict allowlist. Make it `async: true` so a slow push never stalls the loop. I did not fetch a practitioner source for ntfy specifically.
- **Approve-a-build workflow:** let the agent write a "build request" file, and have a `Stop` or `Notification` hook push it to the phone. The human runs `eas build` manually. This keeps the 15-builds-per-month budget human-gated.

### Gaps
- I found no first-party doc on Remote Control or mobile approval of prompts beyond mentions in [Costs](https://code.claude.com/docs/en/costs). I didn't fetch the Remote Control page, which might allow approving builds from a phone.
- I found no authoritative practitioner guide on Stop-hook loop design beyond the hook semantics above.
