---
name: core-js-component
description: Creates a custom element on Core_HTMLElement or Core_HBSElement. Use when adding platform components in CORE_JS or applying base lifecycle patterns.
---

# CORE_JS — component

## Before coding

1. Read `.cursor/rules/core-js-components.mdc`, `ai-instructions/layering.md`.
2. Read `ai-instructions/components.md` and `ai-instructions/internationalization.md` if templates use `data-core-lang`.

## Placement

| Layer | Where |
|-------|--------|
| Platform base / util | `lib/` |
| Generic UI kit | **CORE_UX** (`<core-*>`) — not CORE_JS |
| App feature UI | **Consuming app** (app-specific tag prefix) |

## Steps (Core_HBSElement)

1. Create component module + `template.hbs` (if Handlebars — typically in app repo, not CORE_JS).
2. `import template from './template.hbs'` + `super(template)`.
3. **`onConnect()`:** `addSub()` for subscriptions this element owns (live streams, child outputs), then `this.render()`.
4. **`ui_toFunctional()`:** `bindDelegated()` / `bindUI()` only — technical DOM / UI-kit events.
5. **Outputs (child → parent):** private `Subject` per outcome + public getter returning `readonlyObservable(this.#subject)` (`lib/utils/core-readonly-observable.js`). Emit success only after the owning service confirms the mutation; `next()` before `complete()`. Bounded interactions return a fresh session Observable; a new session completes the previous one without a value.
6. **Parent:** owns the child instance and subscribes explicitly with `this.addSub(child.output$.subscribe(...))`; re-emits on its own output only when needed.
7. **i18n:** `data-core-lang` in template; re-`render()` on lang change only if DOM must rebuild.
8. **`customElements.define('tag-name', Class)`** at module bottom.
9. **Responsibility check:** split autonomous functional regions (list, editor, interaction flow) into focused components; keep page-level composition in the parent.

## Steps (Core_HTMLElement only)

Override `ui_render()` to build DOM (no Handlebars). Same binding/subscription rules.

## Anti-patterns

| Wrong | Right |
|-------|-------|
| `querySelector(...).addEventListener` in `ui_toFunctional` | `bindDelegated` / `bindUI` |
| Bubbling business `CustomEvent` (`dispatchEvent(new CustomEvent('saved', …))`) | Private `Subject` + public `readonlyObservable()` getter |
| Business listener on `document` / global event bus | Parent subscribes explicitly to the child it owns |
| Public Subject, or `subject.asObservable()` as public output | `readonlyObservable(this.#subject)` behind a getter |
| `complete()` / `error()` on an instance output, or on disconnect | Keep instance outputs open; report failures as values; complete only session outputs |
| Success emitted on click, before the service confirms | Emit after the confirmed outcome, `next()` then `complete()` |
| `addSub` on a mutation whose outcome must survive the element | Let it settle (plain `.subscribe()`), keep UI busy, or a longer-lived owner |
| Relying on GC to release subscriptions | Owner `addSub()` or a stream that completes on its own |
| Override `ui_render()` on Core_HBSElement without reason | `super(template)` |
| User input in `.hbs` unescaped | `textContent` / safe patterns |
| Giant page component owning several workflows | Parent composition + focused functional child components |
| Service introduced only to shorten a component | Service only for an owned capability/IO boundary, central behavior, or shared state/orchestration |

## References

- `ai-instructions/components.md`
- `ai-instructions/services.md`
- `.cursor/rules/core-js-io-boundaries.mdc`
- `lib/base/core-html-element.js`
- `lib/base/core-hbs-element.js`
- `lib/utils/core-subscription-manager.js`
- `lib/utils/core-readonly-observable.js`
- `tests/core-component-events.test.js` — executable contract

## App follow-up (outside this repo)

Consuming apps use `Core_HBSElement` for feature components with lazy loading and an app-specific loader service — configured in the app repo.
