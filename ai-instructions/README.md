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

## ESM imports (mandatory)

All **relative** imports between CORE_JS modules must include the **`.js` extension**:

```javascript
import { Core_HTMLElement } from './core-html-element.js';
import { Core_SubscriptionManager } from '../utils/core-subscription-manager.js';
```

Webpack 5 and native ESM require explicit extensions. Do not rely on `fullySpecified: false` in consuming apps.

See **MyJourney** `ai-instructions/layering.md` for the complete decision checklist and anti-patterns (same rules apply to all CORE repos).
