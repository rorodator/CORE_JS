# AI instructions — CORE_JS

Platform layer — **lowest doll** in the stack. Shared by MyJourney, CORE_UX, and other CORE apps.

## Scope

Put code here when it is a **generic primitive** with **no app domain** and **no UI kit markup**:

- Base classes (`Core_HTMLElement`, `Core_HBSElement`, …)
- Platform services (`ajax`, `lang`, `router`, …) when registered via `$svc()`
- Utilities (`dom.js`, subscription manager, …)
- Shared algorithms/helpers with no knowledge of MyJourney routes, entities, or `<core-*>` tags

Do **not** put here:

- `<core-*>` components or Tailwind/CSS → **CORE_UX**
- Feature screens, app services, business rules → **MyJourney**

## Nesting (mandatory)

```
MyJourney  →  may import CORE_UX and CORE_JS
CORE_UX    →  may import CORE_JS only
CORE_JS    →  imports neither CORE_UX nor any app
```

Never add an import from CORE_UX or an application repo into CORE_JS.

## Full placement guide

See **MyJourney** `ai-instructions/layering.md` for the complete decision checklist and anti-patterns (same rules apply to all CORE repos).
