# Services (`$svc`) — CORE_JS

Platform service registry and conventions. Cursor rule: `.cursor/rules/core-js-platform.mdc`.

## Registry

- **`Core`** (`services/core/core.js`): `registerService(name, Class)`, `window.$core`, `window.$svc(name)`.
- **`Core.registerAllServices()`** registers the platform kernel listed below.
- Apps subclass `Core` (e.g. `AppCore`) and register **opt-in** — do **not** call `super.registerAllServices()` unless the app truly needs every kernel service; pick only what the app uses.

## Platform kernel services

| Name | Class | Role |
|------|-------|------|
| `log` | `Core_LogService` | Centralized logging |
| `ajax` | `Core_AjaxService` | Generic HTTP transport |
| `router` | `Core_RouterService` | SPA navigation, link interception |
| `resource` | `Core_ResourceService` | Shared resource locks |
| `config` | `Core_ConfigService` | Base URL, route map, environment |
| `default` | `Core_DefaultService` | Platform default constants |
| `lang` | `Core_LangService` | Label loading and `data-core-lang` processing |
| `browser` | `Core_BrowserService` | Scroll/CSS document helpers (router kernel) |
| `dom` | `Core_DomService` | DOM helpers (`lib/utils/dom.js`) |

Opt-in platform utilities (not in `registerAllServices()` by default):

| Name | Class | Role |
|------|-------|------|
| `components` | `Core_ComponentLoaderService` | Lazy custom-element loader registry |

Apps add **domain** services in their own repo (e.g. `$svc('user')`, `$svc('journeys')`) — not in CORE_JS.

## Ajax: transport vs application API

**`Core_AjaxService`** (`services/api/core-ajax-service.js`) is the generic transport primitive:

- `$svc('ajax').callAPI('path/segment', params, 'GET'|'POST')` — path segment only; the app Ajax subclass resolves the full `/api/…` URL.
- **2xx:** observable emits body; functional `status` stays in payload — handle in app code.
- **Transport / HTTP failure:** observable **errors** with `{ kind: 'transport', status, statusText, message, response }`.
- Override `getDefaultHeaders(method)` in the app Ajax subclass for CSRF, request id, etc.

**Application Ajax** (e.g. MyJourney `AppAjaxService`) extends `Core_AjaxService`, registers as `$svc('ajax')`, and owns `/api/` prefixing, auth headers, and app-specific error UX. Components never call `$svc('ajax')` directly — they use owning domain services.

## Adding a platform service

1. Implement class under `services/…`.
2. Export from appropriate barrel if the repo uses one.
3. Document in this file if it is a new public primitive.
4. Add to `Core.registerAllServices()` only when CORE_JS itself depends on the contract at kernel level; otherwise document opt-in registration for apps.

## Application capability and IO boundary

CORE-based applications use this dependency direction:

```
UI or orchestration → $svc('domain') → IO primitive → external resource
```

| Responsibility | Owner |
|---|---|
| UI, interaction, DOM, local loading/busy/modal state | component |
| Bootstrap, controller, or manager coordination | orchestration code calling semantic services |
| Coherent application capability and central non-visual behavior | `$svc('domain')` |
| Endpoint, HTTP method, backend parameter names, transport normalization | owning domain service |
| Generic HTTP transport | `$svc('ajax')` |

Components and non-service orchestration code must not call IO primitives directly. The owning service is selected by who should know the operation, not by caller count: creating an entry belongs to a SmallSteps service even with one current caller. Keep backend-derived business calculations in their existing source of truth; a client service transports or normalizes those results rather than recomputing them.

**Good — semantic application intent:**

```javascript
$svc('smallSteps').addEntry(stepId, observation, { confirmSameDate });
```

The owning app service translates that command to its endpoint, method, `small_step_id`, `confirm_same_date`, and application outcomes. It may preserve the lower-level Observable when that matches the app async model.

**Good bootstrap orchestration:**

```javascript
bootstrap() {
    $svc('user').initializeApplicationContext().subscribe();
}
```

The user/session service owns its endpoint, applies its central state, and normalizes transport failures. A bootstrap coordinates initialization without knowing those details.

**Wrong bootstrap orchestration:**

```javascript
bootstrap() {
    $svc('ajax').callAPI('bootstrap/context', {}, 'GET').subscribe();
}
```

**Wrong — transport knowledge in a component:**

```javascript
$svc('ajax').callAPI('small-steps/entries/create', {
    small_step_id: stepId,
    confirm_same_date: true,
}, 'POST');
```

**Wrong — a REST-shaped pass-through service:**

```javascript
$svc('smallSteps').post('entries/create', payload);
```

Application services do not own rendering, HBS, DOM queries, focus, modals, spinners, visual notifications, or CSS state. See `.cursor/rules/core-js-io-boundaries.mdc`.

## Router & config

- `$svc('router').goTo(url)` — link interception rules in `Core_RouterService` (modifier-clicks, `target="_blank"`, external URLs ignored).
- `$svc('config').getRoute('name')`, `getBaseUrl()` — base URL normalized via `Core_ConfigService.normalizeBaseUrl()`.
- **Lazy route components:** `Core_Router` calls `$svc('components').ensure(tag)` before rendering a `tagName` route. On failure it logs via `$svc('log').error(...)` and dispatches `core-router-component-load-error` on `document` — it does **not** call `$svc('notif')` or render the element. The current view stays unchanged. Apps (or CORE_UX) may listen for the event to show toast, modal, error state, etc.

### `core-router-component-load-error`

Dispatched on `document` when `components.ensure(tag)` rejects before a tag-based route is rendered.

**Detail (stable):**

| Field | Type | Description |
|-------|------|-------------|
| `tag` | `string` | Custom element tag that failed to load |
| `url` | `string` | Matched route URL |
| `route` | `string\|null` | Route name or path from the route descriptor |
| `error` | `Error` | Loader rejection (e.g. missing mapping, import failure) |

```javascript
document.addEventListener('core-router-component-load-error', (event) => {
   const { tag, url, route, error } = event.detail;
   // Delegate visual feedback to CORE_UX or app code (toast, inline error, …)
});
```

**Log (`$svc('log').error(payload)` — single structured object):**

| Field | Type | Description |
|-------|------|-------------|
| `event` | `string` | `core-router-component-load-error` |
| `message` | `string` | Fixed summary (`Router component load failed`) |
| `tag` | `string` | Custom element tag that failed to load |
| `url` | `string` | Matched route URL (routing input; may contain path segments) |
| `route` | `string\|null` | Route name or path from the route descriptor |
| `errorName` | `string` | Technical error name |
| `errorMessage` | `string` | Technical error message |

Privacy contract: no request body or application payload is logged; route context (`tag`, matched `url`, `route`) and technical error fields are logged. Applications must not encode secrets in route URLs.

## Lang & i18n hooks

See [internationalization.md](./internationalization.md) for `data-core-lang` schema and render vs `process()` rules.

- `$svc('lang').getLabel()`, `getData()`, `process(element)` — labels via API lock/unlock (`$svc('resource')`).

## Logging

- `$svc('log').error/info/…` — never `console.log` in CORE_JS or apps.

## Functional API status

Business outcomes use payload `status` (`SUCCESS`, `LANG_ERROR`, …), not HTTP codes alone.

## Related

- [layering.md](./layering.md), [encapsulation.md](./encapsulation.md)
- Components: [components.md](./components.md)
- i18n: [internationalization.md](./internationalization.md)
