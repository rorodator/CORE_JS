# Components — CORE_JS

Base classes for custom elements. Cursor rule: `.cursor/rules/core-js-components.mdc`.

## Base classes

| Class | File | Use |
|-------|------|-----|
| `Core_HTMLElement` | `lib/base/core-html-element.js` | DOM lifecycle, `render()`, bindings, subscriptions |
| `Core_HBSElement` | `lib/base/core-hbs-element.js` | Handlebars template via `super(template)` |
| `Core_SubscriptionManager` | `lib/utils/core-subscription-manager.js` | Subscriptions owned by an element (`addSub()`) |
| `readonlyObservable()` | `lib/utils/core-readonly-observable.js` | Public readonly view of a private Subject |

Apps and CORE_UX extend these — do not fork lifecycle logic in app repos.

## Design components around functional ownership

Component decomposition should mirror the product behavior:

- a page owns page loading, page-level state, and composition;
- a list owns collection rendering and collection interactions;
- an editor owns its draft, validation, save, and cancel flow;
- a focused child reports meaningful outcomes through its public Observables
  instead of making the parent reimplement its behavior.

Extract a child when a region has a coherent state lifecycle or interaction
contract of its own. File size is a useful warning signal, but not the design
criterion. Conversely, absence of duplicated code does not justify a component
that owns several unrelated workflows.

Prefer explicit boundaries:

- parent → child: properties, a deliberate setter, or declared public methods;
- child → parent: public readonly Observables the parent explicitly subscribes to
  (see [Component communication contract](#component-communication-contract));
- application service: for an owned non-visual capability, IO boundary, central
  behavior, or genuinely shared state/orchestration — never solely to shorten a file.

Do not split inert markup into components without behavioral or reuse value.
The goal is to prevent both duplicated functionality and giant components whose
responsibilities no longer match the functional model.

## Container boundaries

- A component owns only its own DOM.
- A child must not query or manipulate a concrete parent (`closest('parent-tag')`,
  parent-owned selectors, focus restore via parent DOM).
- Parent → child: setters, declared public methods, or command events.
- Child → outside: public readonly Observables; emitted values carry light business
  context, never DOM references.
- Parent-owned focus restoration stays in the parent, after the child's close/result
  output emits.

## Component communication contract

Business communication between components (a child reporting "saved", "deleted",
"selected", "closed with a result", …) uses RxJS outputs, not DOM events.

1. The child owns **private** Subjects (`#saved = new Subject()`).
2. The child exposes **public readonly** Observables through getters backed by
   `readonlyObservable()` (`lib/utils/core-readonly-observable.js`). Never expose a Subject,
   and do not use `asObservable()` for public outputs: its `source` property hands the
   Subject to any consumer.
3. The parent **explicitly obtains and owns** the child instance (it creates it, or keeps
   the reference from its own render). No global lookup of children.
4. The parent **explicitly subscribes** to the outputs it needs, with `this.addSub(...)`.
5. The child **never knows its consumers**: no parent references, no callback registries,
   no consumer-specific branching.
6. **No business `CustomEvent`** dispatched from a child, bubbling or not.
7. **No global business event bus** (no `$svc` pub/sub of component events, no shared
   module-level or `window` Subjects for component outcomes).
8. **No business listeners on `document` / `window`.**
9. A parent **may re-emit** a child output explicitly, on its own private Subject →
   readonly Observable.
10. Each subscription is **cleaned by its owner's lifecycle**: the parent's `addSub()`
    releases it on disconnect. A parent that replaces a child instance unsubscribes from the
    previous child first.
11. **Success is emitted only after the confirmed mutation**: after the owning service
    reports the functional success, never optimistically on click.
12. A stream that ends with a success **emits the value before completing**
    (`next(result)` then `complete()`).

### Instance outputs and session outputs

- **Instance outputs** (`saved$`, `cancelled$`) live as long as the child. Never
  `complete()` or `error()` them, and do not complete them on disconnect: a Subject that
  has completed or errored silently drops every later `next()`, and an element can
  reconnect. Report failures as values or through a separate output.
- **Session outputs**: a bounded interaction (an edit session, a picker run) is started
  by a child method that returns a fresh readonly Observable backed by a new Subject.
  Starting a new session completes the previous one without a value, so subscribers of
  an old session are never notified by a newer one. The session emits the confirmed
  result, then completes; it completes without a value when it ends otherwise (cancel,
  close, replacement). Orchestrating sessions across a whole workflow (for example a modal
  flow) belongs to the consuming app, not to CORE_JS.

```javascript
import { Subject } from 'rxjs';
import { Core_HBSElement } from './core-hbs-element.js';
import { readonlyObservable } from '../utils/core-readonly-observable.js';
import template from './template.hbs';

export class NoteEditor extends Core_HBSElement {
    #saved = new Subject();
    #saved$ = readonlyObservable(this.#saved);
    #session = null;

    constructor() {
        super(template);
    }

    /** Emits the saved note after each confirmed save. */
    get saved$() {
        return this.#saved$;
    }

    /** Emits the confirmed note, then completes; completes without a value otherwise. */
    open(note) {
        this.#session?.complete();
        this.#session = new Subject();
        this.note = note;
        return readonlyObservable(this.#session);
    }

    _save() {
        const session = this.#session;
        $svc('notes').save(this.note).subscribe({
            next: (outcome) => {
                if (outcome.status !== 'SUCCESS') return this._showSaveError(outcome);
                if (this.#session === session) this.#session = null;
                session?.next(outcome.note);
                session?.complete();
                this.#saved.next(outcome.note);
            },
            error: (error) => this._showSaveError(error),
        });
    }
}

export class NotesPage extends Core_HBSElement {
    #editor = document.createElement('app-note-editor');

    onConnect() {
        this.addSub(this.#editor.saved$.subscribe((note) => this._onSaved(note)));
        this.render();
    }
}
```

### What stays on DOM events

- Technical DOM events (`click`, `input`, `change`, `keydown`, `submit`, focus, …) bound with
  `bindDelegated()` / `bindUI()`.
- Generic UI-kit events without business meaning (for example a kit close request),
  bound with `bindDelegated()`.
- Platform signals that CORE_JS documents on `document` (`routeChanged`,
  `core-ajax-transport-error`, `core-router-component-load-error`). These are platform
  infrastructure, not component business communication.

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
- **`onDisconnect()`** — runs before owned subscriptions are released and `cleanFunctional()` runs.
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
| `bindDelegated(type, selector, handler)` | Clicks, changes, technical/kit UI events on descendants — **default** |
| `bindUI(type, handler)` | Host-level listeners |

**Rules:**

- Prefer `data-*` + `bindDelegated` over manual `addEventListener` in `ui_toFunctional`.
- Especially inside slot/portals (`core-modal`, `core-side-panel`, …) where children re-mount.
- DOM bindings are for technical and UI-kit events; business outcomes between components use
  the [communication contract](#component-communication-contract).

## Subscriptions

`this.addSub(observable.subscribe(...))` registers the subscription with the element's
`Core_SubscriptionManager`:

- unsubscribed on disconnect outside reuse mode, and on `forceDestroy()`;
- kept open through `detach()` / `attach()` (reuse mode);
- released as soon as it closes on its own (complete, error, external `unsubscribe()`),
  so owned one-shot subscriptions do not accumulate;
- cleanup is idempotent; a reconnecting element registers new subscriptions in `onConnect()`.

There is no garbage-collection fallback: a subscription that is neither owned nor
completes on its own stays open.

**Decide teardown by ownership and cancellation**, not by "one-shot vs long-lived":

- Use `addSub()` when this element owns the subscription and cancelling it on teardown is
  the correct outcome: live streams (lang, user context), child outputs, reads whose result
  only updates this element's DOM.
- Do **not** tie a mutation whose confirmed outcome must survive the element to its
  teardown. Unsubscribing may abort the request (`rxjs/ajax` aborts the XHR) and silently
  drops the result. Let the mutation settle (plain `.subscribe()`), keep the UI busy until it
  settles, or let a longer-lived owner hold it. Handlers that can run after teardown must
  not assume connected DOM.

## Application outcomes (in component handlers)

Components consume semantic outcomes from the owning application service. They do not know endpoint paths, HTTP methods, transport payload names, or raw protocol conventions. See `ai-instructions/services.md`.

## App / kit integration (not CORE_JS)

- **Consuming app:** lazy-loaded app components (app-specific tag prefix), component loader service — configured in the app repo.
- **CORE_UX:** `<core-*>` kit components — see `CORE_UX/ai-instructions/components.md` when that repo is available in the workspace.
