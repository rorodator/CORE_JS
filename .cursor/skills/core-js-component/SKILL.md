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
| Platform base / util | `CORE_JS/lib/` or `CORE_JS/components/` |
| Generic UI kit | **CORE_UX** (`<core-*>`) — not CORE_JS |
| App feature UI | **Consuming app** (app-specific tag prefix) |

## Steps (Core_HBSElement)

1. Create component module + `template.hbs` (if Handlebars — typically in app repo, not CORE_JS).
2. `import template from './template.hbs'` + `super(template)`.
3. **`onConnect()`:** `addSub()` for long-lived streams, then `this.render()`.
4. **`ui_toFunctional()`:** `bindDelegated()` / `bindUI()` only.
5. **i18n:** `data-core-lang` in template; re-`render()` on lang change only if DOM must rebuild.
6. **`customElements.define('tag-name', Class)`** at module bottom.

## Steps (Core_HTMLElement only)

Override `ui_render()` to build DOM (no Handlebars). Same binding/subscription rules.

## Anti-patterns

| Wrong | Right |
|-------|-------|
| `querySelector(...).addEventListener` in `ui_toFunctional` | `bindDelegated` / `bindUI` |
| `addSub` on one-shot AJAX | plain `.subscribe()` |
| Override `ui_render()` on Core_HBSElement without reason | `super(template)` |
| User input in `.hbs` unescaped | `textContent` / safe patterns |

## References

- `ai-instructions/components.md`
- `lib/base/core-html-element.js`
- `lib/base/core-hbs-element.js`

## App follow-up (outside this repo)

Consuming apps use `Core_HBSElement` for feature components with lazy loading and an app-specific loader service — configured in the app repo.
