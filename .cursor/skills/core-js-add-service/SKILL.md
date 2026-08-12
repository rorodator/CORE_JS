---
name: core-js-add-service
description: Adds a new platform service to CORE_JS and documents opt-in registration for apps. Use when creating or modifying $svc services in CORE_JS/services/.
---

# CORE_JS — add platform service

## Before coding

1. Confirm a **generic primitive** — no app domain, no `<core-*>` UI. See `ai-instructions/README.md` (Scope), `ai-instructions/layering.md`.
2. Read `.cursor/rules/core-js-platform.mdc` and `ai-instructions/services.md`.

## Steps

1. **Implement** under `CORE_JS/services/<area>/core-<name>-service.js`.
2. **ESM imports** — relative paths include `.js` extension.
3. **Access** — consumers use `$svc('name')` after the app registers the service; no ad-hoc singletons.
4. **Logging** — `$svc('log')` only; no `console.log`.
5. **Document** — add row to `ai-instructions/services.md` if public API.
6. **App opt-in** — each consuming app registers in its Core subclass (`registerService('name', Class)`); do **not** assume `super.registerAllServices()`.

## Anti-patterns

| Wrong | Right |
|-------|-------|
| App routes / entities in CORE_JS service | Keep domain in app services |
| `console.log` | `$svc('log')` |
| Import from CORE_UX or app repo | CORE_JS imports downward only |
| Auto-register in all apps | Document + opt-in per app |

## References

- `ai-instructions/services.md`
- `.cursor/rules/core-js-platform.mdc`
- `services/core/core.js` — registry

## App follow-up (outside this repo)

Register the new service in the consuming app's Core bootstrap (`registerService(...)`). App bridge rules/skills are maintained in the app repo — not here.
