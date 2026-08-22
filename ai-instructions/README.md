# AI instructions — CORE_JS

Platform layer — **lowest doll** in the stack. Shared by consuming apps, CORE_UX, and other CORE-based products.

**Cursor rules:** `.cursor/rules/core-js-platform.mdc`, `.cursor/rules/core-js-components.mdc`, `.cursor/rules/core-js-io-boundaries.mdc`, `.cursor/rules/encapsulation.mdc`

**Workflow skills:** `.cursor/skills/core-js-add-service/`, `.cursor/skills/core-js-application-service/`, `.cursor/skills/core-js-component/`

| File | Topic |
|------|--------|
| [encapsulation.md](./encapsulation.md) | Repo boundaries, dual context, rules/skills placement |
| [layering.md](./layering.md) | Stack placement (standalone-safe) |
| [services.md](./services.md) | `$svc()` registry, application IO boundaries, ajax, logging, adding services |
| [components.md](./components.md) | Core_HTMLElement / Core_HBSElement lifecycle, bindings |
| [internationalization.md](./internationalization.md) | `data-core-lang`, `$svc('lang').process()` |
| (this file) | Scope, nesting, ESM, DOM, ajax, router, config |

## Maintaining rules & skills

Add or update **`.cursor/rules/`**, **`ai-instructions/`**, and **`.cursor/skills/`** in **this repo** when the change is:

- `$svc` platform services, ESM/DOM utils, `Core_HTMLElement` lifecycle, ajax/router/lang primitives — anything **reusable with no app domain and no `<core-*>` UI**.

Do **not** duplicate these rules in consuming apps. App-specific services and loaders live in the app repo. See [encapsulation.md](./encapsulation.md), [layering.md](./layering.md).

## Scope

Put code here when it is a **generic primitive** with **no app domain** and **no UI kit markup**:

- Base classes (`Core_HTMLElement`, `Core_HBSElement`, …)
- Platform services (`ajax`, `lang`, `router`, …) when registered via `$svc()`
- Utilities (`dom.js`, subscription manager, …)
- Shared algorithms/helpers with no knowledge of app routes, entities, or `<core-*>` tags

Do **not** put here:

- `<core-*>` components or Tailwind/CSS → **CORE_UX**
- Feature screens, app services, business rules → **consuming app**

## Nesting (mandatory)

```
Consuming app  →  may import CORE_UX and CORE_JS
CORE_UX        →  may import CORE_JS only
CORE_JS        →  imports neither CORE_UX nor any app
```

Never add an import from CORE_UX or an application repo into CORE_JS.

## ESM imports (mandatory)

All **relative** imports between CORE_JS modules must include the **`.js` extension**:

```javascript
import { Core_HTMLElement } from './core-html-element.js';
import { Core_SubscriptionManager } from '../utils/core-subscription-manager.js';
```

Webpack 5 and native ESM require explicit extensions. Do not rely on `fullySpecified: false` in consuming apps.

**Delivery:** apps consume CORE_JS **via webpack bundles** (primary). Explicit `.js` extensions keep the tree **native-ESM-ready** for import maps / doc shims (e.g. CORE_UX static docs). No bare relative paths — audit complete across the repo.

## DOM / HTML injection

See also [internationalization.md](./internationalization.md) for `data-core-lang`.

- `createElement({ text })` and `textContent` for user or API strings.
- `trustedHtml` / `mountTrustedHtml` for author-controlled markup only (templates, static fragments).
- Optional JSON keys on `data-core-lang`: `"attribute"`, `"child"` (selector scoped to the host), `"rich"`.
- Compound components (e.g. `core-menu-item`) may patch `"child"` on the host before render so `lang.process()` targets inner hooks.

## Ajax (`Core_AjaxService`)

- **2xx HTTP**: observable emits the response body (`next`). Functional statuses (`SUCCESS`, `LANG_ERROR`, …) stay in the payload — handle in app code.
- **Transport / HTTP failure**: observable **errors** with `{ kind: 'transport', status, statusText, message, response }`. No `alert()` in CORE.
- App UX: override `getDefaultHeaders()` / `onTransportError()`, or listen for `core-ajax-transport-error` on `document`.
- Override `getDefaultHeaders(method)` in the app Ajax service for `X-CSRF-Token`, client version, request id, etc.

## Router link interception

`Core_RouterService.manageLink` intercepts plain left-clicks on same-app relative links only. It **does not** intercept:

- modifier-clicks (Ctrl/Cmd/Shift/Alt), non-primary button, or `defaultPrevented`
- `target="_blank"` / `_new`, `download`, `data-core-ignore-router`
- in-page `#` anchors, `mailto:`, `tel:`, other special protocols, `//`, `http(s)://`

## Lazy route component load failures

When a route uses `tagName` and `$svc('components').ensure(tag)` is available, `Core_Router` loads the module **before** mutating the DOM. On rejection:

1. `$svc('log').error({ event, message, tag, url, route, errorName, errorMessage })` records route context and the technical error (single structured object — see [services.md](./services.md#core-router-component-load-error)).
2. `document` receives `core-router-component-load-error` (`Core_Router.COMPONENT_LOAD_ERROR_EVENT`).
3. The router **does not** render the tag, call `$svc('notif')`, or change the current view.

Applications (and CORE_UX hosts) listen for the event to choose toast, modal, inline error, navigation, etc. See [services.md](./services.md#core-router-component-load-error).

## Config base URL (`Core_ConfigService`)

- `setBaseUrl()` always stores a normalized path via `Core_ConfigService.normalizeBaseUrl()`.
- Root: `''`, `'/'` → `'/'`. Subpath: `'MyJourney'`, `'/MyJourney/'` → `'/MyJourney'` (no trailing slash).
- `getRelativePath()` / `getRoute()` strip the base with segment-safe matching (avoids `/MyJourney` vs `/MyJourneyExtra` bugs).

See [layering.md](./layering.md) for the complete decision checklist (applies to all CORE repos).
