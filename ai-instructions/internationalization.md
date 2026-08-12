# Internationalization — CORE_JS

Client-side label application via `$svc('lang')`. Server label files and REST endpoints are configured per app (e.g. MyJourney `PHP/LANG/`).

## `data-core-lang` JSON

Single entry or array on any host element:

| Key | Role |
|-----|------|
| `container` | Label namespace (required) |
| `name` | Label key (required) |
| `attribute` | Set this attribute on the target instead of `textContent` |
| `child` | CSS selector scoped to the host; first match receives the update |
| `rich` | When `true`, apply translation as `innerHTML` (author-controlled markup only) |

Default target is the host. With `"child"`, `$svc('lang').process()` resolves `host.querySelector(child)`.

### Plain HTML

```html
<span data-core-lang='{"container": "home", "name": "title"}'>Fallback</span>
```

### Multiple entries on one host

```html
<host-element
  data-core-lang='[
    {"container": "auth", "name": "field_email", "attribute": "label"},
    {"container": "auth", "name": "placeholder_email", "attribute": "placeholder", "child": "input"}
  ]'
></host-element>
```

### Components with internal DOM

Compound components may patch `"child"` on the host `data-core-lang` during `render()` so `lang.process()` targets inner hooks after template build. Example pattern (kit component):

```html
<core-menu-item data-core-lang='{"container": "auth", "name": "logout"}'></core-menu-item>
```

On each `render()`, the component patches `"child": "[data-core-menu-item-label]"`, builds the inner hook, then `$svc('lang').process()` updates the label.

## When to `render()` vs rely on `process()`

Global language change runs `$svc('lang').process(document.body)` — inner targets with stable hooks update **without** re-render.

Subscribe and re-`render()` only when the component must **rebuild DOM structure** on lang change:

```javascript
this.addSub($svc('lang').getData().subscribe(() => this.render()));
```

Otherwise prefer stable `data-core-lang` hooks and let `process()` update text.

## Programmatic labels

```javascript
$svc('lang').getLabel('errors.load_component_failed');
$svc('lang').process(this); // after dynamic DOM changes
```

For attributes on custom elements (e.g. modal title): `getLabel()` + `setAttribute`, or `process(this)` after DOM is ready.

## Lang service loading

- `$svc('lang').getData()` — BehaviorSubject of loaded label map.
- Uses `$svc('resource').lock/unlock('api', …)` + `$svc('ajax').getJSON(...)` — see `services/utils/core-lang-service.js`.
- App configures label API path via `$svc('default').lang.api`.

## App-specific

- Label JSON files, REST routes, namespaces → consuming app (MyJourney: `ai-instructions/internationalization.md`).
