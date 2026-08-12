# Services (`$svc`) — CORE_JS

Platform service registry and conventions. Cursor rule: `.cursor/rules/core-js-platform.mdc`.

## Registry

- **`Core`** (`services/core/core.js`): `registerService(name, Class)`, `window.$core`, `window.$svc(name)`.
- Platform services ship in `services/` (`log`, `ajax`, `lang`, `router`, `config`, `dom`, …).
- Apps subclass `Core` (e.g. `AppCore`) and register **opt-in** — do **not** call `super.registerAllServices()` unless the app truly needs every default CORE service.

## Adding a platform service

1. Implement class under `services/…`.
2. Export from appropriate barrel if the repo uses one.
3. Document in this file if it is a new public primitive.
4. Apps opt in: `this.registerService('name', Class)` in their Core bootstrap.

Apps add **domain** services in their own repo (e.g. `$svc('user')`, `$svc('components')`) — not in CORE_JS.

## Ajax

See `Core_AjaxService` (`services/api/core-ajax-service.js`):

- Client shape: `$svc('ajax').callAPI('path/segment', params, 'GET'|'POST')` → app resolves to `/api/…`.
- **2xx:** `next` with body; check functional `status` in app code.
- **Transport / HTTP failure:** `error` with `{ kind: 'transport', status, statusText, message, response }`.
- Override `getDefaultHeaders(method)` in app Ajax subclass for CSRF, request id, etc.
- Listen for `core-ajax-transport-error` on `document` for global UX.

## Router & config

- `$svc('router').goTo(url)` — link interception rules in `Core_RouterService` (modifier-clicks, `target="_blank"`, external URLs ignored).
- `$svc('config').getRoute('name')`, `getBaseUrl()` — base URL normalized via `Core_ConfigService.normalizeBaseUrl()`.

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
