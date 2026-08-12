# Encapsulation — CORE_JS

**Before adding code, rules, or skills:** confirm it belongs in **CORE_JS** (generic JS platform), not CORE_UX, CORE_PHP, or a consuming app.

## This repo (CORE_JS)

| Belongs here | Does not belong here |
|--------------|----------------------|
| `Core_HTMLElement`, `$svc` primitives, `dom.js`, ajax/router/lang services | `<core-*>` UI (→ CORE_UX) |
| ESM utils, subscription manager | App routes, entities, business rules |
| Platform rules/skills in **this** `.cursor/` | Duplicated framework rules in apps |

## Sibling repos

- **CORE_UX** — `<core-*>` kit, tokens, Tailwind
- **CORE_PHP** — RestService, `core()`, PHP platform
- **Consuming app** — product UI, domain `$svc`, `PHP/App/`

Details: [layering.md](./layering.md).

## Rules & skills in this repo

When you introduce a **reusable JS platform pattern**:

1. Update `.cursor/rules/` and/or `ai-instructions/` **here**
2. Add a `.cursor/skills/` workflow if the task is recurring
3. Do **not** copy the full contract into app repos — apps keep thin **bridge** rules

## Dual context

All paths in CORE_JS docs are **relative to this repository root**. Rules use **repo-relative globs** (`**/*.js`) — they apply here when opened standalone or under a symlink (e.g. `CORE_JS/` in an app workspace).

CORE docs must **never require** an app file to be understood. Optional app examples may name a specific consumer (e.g. MyJourney) but must not be the only instructions.

## App follow-up (outside this repo)

After changing platform APIs, consuming apps **opt in** via their own `Core` subclass (`registerService(...)`) and their own bridge rules/skills.
