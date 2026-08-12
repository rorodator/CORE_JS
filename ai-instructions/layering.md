# Layering — CORE stack

Every resource lives in the **lowest correct layer**. Dependencies flow **downward only** (Russian dolls).

```
Consuming app   product UI, domain services, app REST/IO
  └── CORE_UX   generic <core-*> presentation (no ajax/domain)
        └── CORE_JS   platform JS ($svc, base classes, utils)

Consuming app   domain PHP (App/Rest, App/IO, migrations)
  └── CORE_PHP  platform PHP (RestService, core(), validation)
```

## Where to put new code

| Layer | Repo | Put here when… |
|-------|------|----------------|
| **App** | consuming app | Product-specific — would not ship unchanged in another CORE app |
| **UI kit** | **CORE_UX** | Generic reusable UI, no business rules, no `$svc('ajax')` |
| **JS platform** | **CORE_JS** | Primitives shared by apps and CORE_UX — not tied to one `<core-*>` tag |
| **PHP platform** | **CORE_PHP** | Generic PHP infrastructure (RestService, mail, session helpers) |

## Decision checklist

1. **Would another CORE-based app reuse this unchanged?**
   - No → **consuming app**
   - Yes, UI → **CORE_UX** (presentation) or **CORE_JS** (non-UI primitive)
   - Yes, not UI → **CORE_JS** or **CORE_PHP**

2. **`$svc('ajax')`, domain rules, or app routes/entities?** → **consuming app** (never CORE_UX)

3. **`<core-*>` tag or kit CSS?** → **CORE_UX** (app tags use an app-specific prefix, e.g. `mj-*`)

4. **Base class, util, or platform `$svc`?** → **CORE_JS**

5. **RestService base pattern, generic PHP infra?** → **CORE_PHP** (domain endpoints → app `PHP/App/Rest/`)

## Strict rules

| Rule | Meaning |
|------|---------|
| **No upward imports** | CORE_JS must not import CORE_UX or any app. CORE_UX must not import any app. |
| **No sideways duplication** | Search CORE repos before adding helpers in an app. **Promote, don't fork.** |
| **Separate git repos** | Commit where files actually changed. |
| **Rules & skills follow code** | Framework → `CORE_*/.cursor/` + `ai-instructions/`. App → consuming app repo only. |

## Dual context (standalone vs symlinked)

This file uses **paths relative to the repo you have open** (`ai-instructions/`, `.cursor/`).

- **Standalone:** open `CORE_JS`, `CORE_UX`, or `CORE_PHP` alone — everything here must stand on its own.
- **Symlinked in an app workspace:** the app may add bridge rules that **reference** this repo; CORE docs remain canonical and must not depend on app files.

See [encapsulation.md](./encapsulation.md).
