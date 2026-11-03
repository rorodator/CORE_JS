# Filter engine — CORE_JS

`Core_FilterEngine` is the DOM-free filter state machine. Construct one per screen:

```js
import { Core_FilterEngine } from './lib/filter/core-filter-engine.js';

const engine = new Core_FilterEngine({
  definitions: [
    { id: 'name', type: 'string' },
    { id: 'amount', type: 'decimal' }
  ]
});
```

It is not a `$svc` service and it is not registered by `Core.registerAllServices()`. The normative contract remains the frozen FilterBar spec v1.0. This note records the JSON and event shapes the class actually emits.

Value parsing reuses `lib/value/`. `setValue` accepts a canonical value only. A localized draft goes through `applyEditorChange`, which keeps `rawValue` and `pending` / `invalid`.

`multiSelect`, `tags`, and `treeSelect` parse one canonical array with their list parser. `select` and `autocomplete` with `in` or `notIn` parse each element with the scalar parser. The array is not passed to that scalar parser.

`setFilters` and `importState` revalidate values. A supplied `status: 'valid'` cannot hide a value that does not parse. `pending` or `invalid` is restored only when the canonical value itself is not valid, together with `rawValue`.

Public methods stay `source: 'api'`. The screen facade marks a user gesture with `engine.withSource('user', () => engine.removeFilter(id))`. That wrapper does not add a source argument to the frozen methods. A subscriber that mutates during `state$` or `events$` runs on an isolated draft immediately, so `addFilter` and `transaction` still return their real result. The commit is published only after the current notification: revision, `transactionId`, and snapshot stay aligned, and notifications are not interleaved. A nested or asynchronous transaction fails at once and publishes nothing. Returned snapshots are frozen, including nested values.

## Resolved config

`getResolvedConfig()` returns the normalized defaults, behavior, ui, definitions, and registry function references. It may contain functions. It is not the persistence snapshot.

Library defaults: `locale: 'en'`, `validation.mode: 'touched'`, `behavior.maxFilters: null`, `behavior.allowCrossGroupMove: false`, `ui.layout: 'wrap'`, `ui.density: 'inline'`.

Labels are derived from the id (`tradeDate` → `Trade date`). Operators and the default operator come from the value registry unless the definition replaces `operators`. Lists replace. `format`, `validation`, and `editorOptions` deep-merge. A `group` string splits on `/` into `groupPath`.

## Events

`state$` replays the current `FilterBarState`. `events$` does not replay. A commit publishes `state$` first, then the business events. Every event of that commit shares `revision`, `transactionId`, `source`, and the same `state` object.

```json
{
  "type": "valueChanged",
  "source": "api",
  "revision": 2,
  "transactionId": "tx-2",
  "instanceId": "amount-1",
  "definitionId": "amount",
  "previous": {},
  "current": {},
  "state": {}
}
```

`source` is `api` for the public methods and `user` for `applyEditorChange` unless the caller passes another source. `previous` / `current` are present for instance events. `filterAdded.previous` and `filterRemoved.current` are `null`.

| type | When |
|---|---|
| `filterAdded` | `addFilter` |
| `filterRemoved` | `removeFilter`, or `removeDefinition({ cascade: true })` |
| `valueChanged` | `setValue` or `applyEditorChange` |
| `operatorChanged` | `setOperator`, including a value that was kept, converted, or cleared |
| `filterCleared` | `clearFilter` |
| `filterMoved` | `moveFilter` |
| `pinChanged` | `setPinned` |
| `validationChanged` | `validate`, or a definition update that changes instance validity |
| `catalogChanged` | definition add, update, or remove |
| `stateReplaced` | `setFilters` or `importState` |
| `stateReset` | `reset` |

No event is emitted for a no-op, for construction, or for `initialFilters`. A transaction that returns to its starting state is a no-op. Repeated edits of the same value in one transaction collapse to the net `valueChanged`. `setFilters`, `importState`, and `reset` publish only their wholesale event for that transaction, even if the callback also edits instances. There is no debounce.

## Snapshot v1

`exportState()` returns a copy. `JSON.stringify` succeeds. Inline functions from the initial config are not written. Replacing `validate`, `parse`, `compare`, `provider`, or the formatter still emits `catalogChanged`, because change detection compares those function identities as well as the serializable fields. A canonical value rejected by that new callback is marked internally and becomes valid again when a later callback accepts the same canonical value. That mark is not part of snapshot v1. An editor draft stays as typed, including a `pending` value and an `invalid` value whose `rawValue` is already syntactically canonical. A runtime definition must use registry refs (`providerRef`, `editorRef`, `parseRef`, `formatRef`, `validateRef`, `compareRef`) or `addDefinition` throws `Core_FilterError` `E_UNRESOLVED_REFERENCE`.

```json
{
  "schemaVersion": 1,
  "definitions": [
    {
      "id": "currency",
      "label": "Currency",
      "type": "select",
      "valueType": "select",
      "editor": "select",
      "operators": ["eq", "neq", "in", "notIn", "isEmpty", "isNotEmpty"],
      "defaultOperator": "eq",
      "providerRef": "currencies"
    }
  ],
  "filters": [
    {
      "instanceId": "currency-1",
      "definitionId": "currency",
      "operator": "eq",
      "value": null,
      "pinned": false,
      "pinLocked": false,
      "removable": true,
      "touched": true,
      "status": "pending",
      "rawValue": "eu"
    }
  ]
}
```

`rawValue` is included only when it is JSON. `importState` of another `schemaVersion` throws `E_SCHEMA_VERSION` and leaves the engine unchanged. An identical snapshot is a no-op. A successful import emits `stateReplaced` only.

## Errors

Structural mistakes throw `Core_FilterError` with `code`. A typed value that fails validation stays on the instance (`status: 'invalid'`) and does not throw. `getCriteria().criteria` is `null` when any instance is `pending`, `invalid`, or required and empty. `0` and `false` are values. `isEmpty` / `isNotEmpty` need no operand, and `clearFilter` is a no-op for them.

`destroy()` completes `state$` and `events$`. Later mutations throw `E_DESTROYED`.
