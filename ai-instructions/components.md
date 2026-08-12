# Components — CORE_JS

Base classes for custom elements. Cursor rule: `.cursor/rules/core-js-components.mdc`.

## Base classes

| Class | File | Use |
|-------|------|-----|
| `Core_HTMLElement` | `lib/base/core-html-element.js` | DOM lifecycle, `render()`, bindings, subscriptions |
| `Core_HBSElement` | `lib/base/core-hbs-element.js` | Handlebars template via `super(template)` |

Apps and CORE_UX extend these — do not fork lifecycle logic in app repos.

## Minimal example (`Core_HBSElement`)

```javascript
import { Core_HBSElement } from './core-hbs-element.js';
import template from './template.hbs';

export class ExampleElement extends Core_HBSElement {
    constructor() {
        super(template);
    }

    onConnect() {
        this.addSub($svc('lang').getData().subscribe(() => this.render()));
        this.render();
    }

    ui_toFunctional() {
        this.bindDelegated('click', '[data-action="example"]', () => this._onExample());
    }
}

customElements.define('example-element', ExampleElement);
```

## Lifecycle (`Core_HTMLElement.render()`)

1. `cleanFunctional()` — aborts `bindUI` / `bindDelegated` from previous cycle.
2. `ui_render()` — build DOM (`Core_HBSElement`: compile Handlebars into `innerHTML`).
3. `$svc('lang').process(this)` when `$svc('default').lang.isActivated`.
4. `ui_toFunctional()` — attach event handlers for this cycle.

Hooks:

- **`onConnect()`** — first connection; set up `addSub()` + initial `render()`.
- **`onDisconnect()`** — cleanup via subscription manager + `cleanFunctional()`.
- **`detach()` / `attach()`** — reuse mode (skip reconnect teardown).

## UI event binding

```javascript
ui_toFunctional() {
    this.bindDelegated('click', '[data-action="save"]', (event, btn) => {
        event.preventDefault();
        this._save();
    });

    this.bindDelegated('core-modal-close', 'core-modal', () => this.close());

    this.bindUI('keydown', (event) => {
        if (event.key === 'Escape') this._cancel();
    });
}
```

| API | Use when |
|-----|----------|
| `bindDelegated(type, selector, handler)` | Clicks, changes, bubbling custom events on descendants — **default** |
| `bindUI(type, handler)` | Host-level listeners |

**Rules:**

- Prefer `data-*` + `bindDelegated` over manual `addEventListener` in `ui_toFunctional`.
- Especially inside slot/portals (`core-modal`, `core-side-panel`, …) where children re-mount.
- Long-lived subscriptions → `onConnect()` + `addSub()`; one-shot AJAX → plain `.subscribe()`.

## Subscriptions

- `this.addSub(observable.subscribe(...))` registers with `Core_SubscriptionManager` — cleaned on disconnect.
- Do **not** wrap one-shot AJAX in `addSub()`.

## API responses (in component handlers)

Check functional `response.status` (e.g. `SUCCESS`), not HTTP status codes alone — see `ai-instructions/services.md`.

## App / kit integration (not CORE_JS)

- **MyJourney:** lazy `mj-*` components, `AppComponentLoaderService` — see MyJourney `ai-instructions/components.md`.
- **CORE_UX:** `<core-*>` kit components — see `CORE_UX/ai-instructions/components.md`.
