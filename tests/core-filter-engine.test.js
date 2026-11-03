import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Core_FilterEngine } from '../lib/filter/core-filter-engine.js';
import { Core_FilterError } from '../lib/filter/core-filter-error.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib/filter');
const BIG = '9007199254740993';

/**
 * @param {Core_FilterEngine} engine
 */
function watch(engine) {
   /** @type {object[]} */
   const states = [];
   /** @type {object[]} */
   const events = [];
   /** @type {string[]} */
   const order = [];
   const stateSub = engine.state$.subscribe((state) => {
      states.push(state);
      order.push('state');
   });
   const eventSub = engine.events$.subscribe((event) => {
      events.push(event);
      order.push('event');
   });
   return { states, events, order, stop() { stateSub.unsubscribe(); eventSub.unsubscribe(); } };
}

function minimal() {
   return new Core_FilterEngine({
      definitions: [
         { id: 'name', type: 'string' },
         { id: 'amount', type: 'decimal' },
         { id: 'tradeDate', type: 'date' },
         { id: 'currency', type: 'select', options: ['EUR', 'USD', 'GBP'] }
      ]
   });
}

test('the engine source does not touch DOM, DataSource, SQL, or AG Grid', () => {
   const source = fs.readFileSync(path.join(root, 'core-filter-engine.js'), 'utf8')
      + fs.readFileSync(path.join(root, 'core-filter-error.js'), 'utf8');
   assert.equal(/\bdocument\b|\bwindow\b|DataSource|ag-grid|agGrid|CORE_UX|core-ajax/.test(source), false);
});

test('minimal config infers labels, editors, and operators without callbacks', () => {
   const engine = minimal();
   const definitions = engine.getDefinitions();
   assert.equal(definitions.length, 4);
   assert.equal(definitions[0].label, 'Name');
   assert.equal(definitions[0].editor, 'text');
   assert.equal(definitions[0].defaultOperator, 'contains');
   assert.ok(definitions[0].operators.includes('contains'));
   assert.equal(definitions[1].label, 'Amount');
   assert.equal(definitions[1].defaultOperator, 'eq');
   assert.equal(definitions[2].label, 'Trade date');
   assert.ok(definitions[2].operators.includes('before'));
   assert.deepEqual(definitions[3].options, [
      { value: 'EUR', label: 'EUR' },
      { value: 'USD', label: 'USD' },
      { value: 'GBP', label: 'GBP' }
   ]);
   assert.equal(engine.getResolvedConfig().defaults.locale, 'en');
   assert.equal(engine.getResolvedConfig().ui.layout, 'wrap');
   const state = engine.getState();
   assert.equal(state.revision, 0);
   assert.deepEqual(state.filters, []);
   assert.equal(state.valid, true);
   assert.equal(engine.getCriteria().criteria.length, 0);
   assert.equal(engine.getCriteria().combinator, 'AND');
   engine.destroy();
});

test('state$ replays the initial state and events$ stays silent', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal' }],
      initialFilters: [{ instanceId: 'amount-min', definitionId: 'amount', operator: 'eq', value: '10' }]
   });
   const seen = watch(engine);
   assert.equal(seen.states.length, 1);
   assert.equal(seen.states[0].revision, 0);
   assert.equal(seen.states[0].filters[0].value, '10');
   assert.equal(seen.events.length, 0);
   assert.equal(engine.state$.source, undefined);
   assert.equal(engine.events$.source, undefined);
   assert.equal(Object.isFrozen(engine.state$), true);
   seen.stop();
   engine.destroy();
});

test('canonical numbers stay exact and a JavaScript number is rejected', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal' }, { id: 'count', type: 'integer' }, { id: 'open', type: 'boolean' }]
   });
   const amount = engine.addFilter('amount');
   const count = engine.addFilter('count');
   const open = engine.addFilter('open');
   engine.setValue(amount, '1234567.89');
   engine.setValue(count, BIG);
   engine.setValue(open, false);
   assert.equal(engine.getState().filters.find((item) => item.instanceId === amount).value, '1234567.89');
   assert.equal(engine.getState().filters.find((item) => item.instanceId === count).value, BIG);
   assert.equal(engine.getCriteria().criteria.find((item) => item.instanceId === open).value, false);
   assert.throws(() => engine.setValue(amount, 12), (error) => error instanceof Core_FilterError && error.code === 'E_INVALID_SHAPE');
   assert.equal(engine.getState().filters.find((item) => item.instanceId === amount).value, '1234567.89');
   engine.destroy();
});

test('strict dates, partial ranges, and reversed bounds stay on the instance', () => {
   const engine = new Core_FilterEngine({
      definitions: [
         { id: 'tradeDate', type: 'date' },
         { id: 'when', type: 'datetime', format: { temporal: 'local' } },
         { id: 'amount', type: 'decimal' }
      ]
   });
   const date = engine.addFilter('tradeDate', { value: '2026-11-02' });
   const when = engine.addFilter('when');
   const amount = engine.addFilter('amount', { operator: 'between', value: { min: '10', max: null } });
   assert.equal(engine.getState().filters.find((item) => item.instanceId === date).status, 'valid');
   engine.setValue(date, '2026-02-31');
   assert.equal(engine.getState().filters.find((item) => item.instanceId === date).status, 'invalid');
   assert.equal(engine.getState().filters.find((item) => item.instanceId === date).value, null);
   engine.setValue(when, '2026-11-02T14:35:08Z');
   assert.equal(engine.getState().filters.find((item) => item.instanceId === when).status, 'invalid');
   assert.equal(engine.getState().filters.find((item) => item.instanceId === amount).status, 'valid');
   engine.setValue(amount, { min: '50', max: '10' });
   const reversed = engine.getState().filters.find((item) => item.instanceId === amount);
   assert.equal(reversed.status, 'invalid');
   assert.equal(reversed.errors[0].code, 'E_RANGE_ORDER');
   engine.setOperator(amount, 'outside');
   engine.setValue(amount, { min: '1', max: null });
   assert.equal(engine.getState().filters.find((item) => item.instanceId === amount).errors[0].code, 'E_RANGE_BOUNDS');
   engine.setValue(amount, { min: '1', max: '5' });
   assert.equal(engine.getState().filters.find((item) => item.instanceId === amount).status, 'valid');
   engine.destroy();
});

test('required, pending, invalid, and isEmpty control criteria as one set', () => {
   const engine = new Core_FilterEngine({
      definitions: [
         { id: 'amount', type: 'decimal', required: true },
         { id: 'name', type: 'string' }
      ],
      initialFilters: [{ instanceId: 'amount-1', definitionId: 'amount' }]
   });
   assert.equal(engine.getState().filters[0].status, 'empty');
   assert.equal(engine.getState().filters[0].errors[0].code, 'E_REQUIRED');
   assert.equal(engine.getCriteria().criteria, null);
   engine.setOperator('amount-1', 'isEmpty');
   assert.equal(engine.getState().filters[0].status, 'valid');
   assert.equal(engine.getCriteria().criteria[0].operator, 'isEmpty');
   const before = engine.getState().revision;
   engine.clearFilter('amount-1');
   assert.equal(engine.getState().revision, before);
   engine.setOperator('amount-1', 'eq');
   const name = engine.addFilter('name', { value: 'Ada' });
   engine.applyEditorChange('amount-1', { rawValue: '12,', value: null, status: 'pending', touched: true });
   assert.equal(engine.getState().filters.find((item) => item.instanceId === 'amount-1').rawValue, '12,');
   assert.equal(engine.getState().filters.find((item) => item.instanceId === name).value, 'Ada');
   assert.equal(engine.getCriteria().criteria, null);
   engine.applyEditorChange('amount-1', { rawValue: 'abc', value: null, status: 'invalid', errors: [{ code: 'E_INVALID_SHAPE', message: 'Invalid value.' }], touched: true });
   assert.equal(engine.getState().filters[0].value, null);
   assert.equal(engine.getCriteria().valid, false);
   engine.setValue('amount-1', '0');
   assert.equal(engine.getCriteria().criteria.map((item) => item.instanceId).includes('amount-1'), true);
   engine.destroy();
});

test('mutations are atomic, no-ops are silent, and operator changes are one event', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal', allowMultipleInstances: true }]
   });
   const seen = watch(engine);
   const id = engine.addFilter('amount', { value: '10' });
   assert.equal(seen.events.at(-1).type, 'filterAdded');
   const revision = engine.getState().revision;
   const eventCount = seen.events.length;
   engine.setValue(id, '10');
   engine.setPinned(id, false);
   engine.moveFilter(id, 0);
   assert.equal(engine.getState().revision, revision);
   assert.equal(seen.events.length, eventCount);
   engine.setOperator(id, 'between');
   const changed = seen.events.at(-1);
   assert.equal(changed.type, 'operatorChanged');
   assert.equal(changed.current.operator, 'between');
   assert.deepEqual(changed.current.value, { min: null, max: null });
   assert.equal(seen.events.filter((event) => event.revision === changed.revision && event.type === 'valueChanged').length, 0);
   assert.deepEqual(seen.order.slice(-2), ['state', 'event']);
   assert.throws(() => engine.getState().filters.push({}), TypeError);
   engine.destroy();
});

test('a failed transaction rolls back and a successful one publishes one snapshot', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal' }],
      initialFilters: [{ instanceId: 'amount-min', definitionId: 'amount', operator: 'eq', value: '10' }]
   });
   const seen = watch(engine);
   const before = JSON.stringify(engine.getState());
   const revision = engine.getState().revision;
   assert.throws(() => {
      engine.transaction((tx) => {
         tx.setOperator('amount-min', 'between');
         tx.setValue('amount-min', { min: '1000', max: '5000' });
         assert.equal(tx.getState().filters[0].operator, 'between');
         assert.equal(engine.getState().filters[0].operator, 'eq');
         tx.setPinned('missing', true);
      });
   }, (error) => error instanceof Core_FilterError && error.code === 'E_UNKNOWN_INSTANCE');
   assert.equal(JSON.stringify(engine.getState()), before);
   assert.equal(engine.getState().revision, revision);
   assert.equal(seen.events.length, 0);
   assert.equal(seen.states.length, 1);

   engine.transaction((tx) => {
      tx.setOperator('amount-min', 'between');
      tx.setValue('amount-min', { min: '1000', max: '5000' });
      tx.setPinned('amount-min', true);
   });
   assert.equal(seen.states.length, 2);
   const batch = seen.events.filter((event) => event.revision === engine.getState().revision);
   assert.deepEqual(batch.map((event) => event.type), ['operatorChanged', 'valueChanged', 'pinChanged']);
   assert.equal(new Set(batch.map((event) => event.transactionId)).size, 1);
   assert.equal(batch[0].state, seen.states.at(-1));
   assert.equal(engine.getState().filters[0].pinned, true);
   assert.deepEqual(engine.getState().filters[0].value, { min: '1000', max: '5000' });
   assert.equal(seen.order.slice(-4, -3)[0], 'state');

   assert.throws(() => engine.transaction(() => Promise.resolve()), (error) => error.code === 'E_ASYNC_TRANSACTION');
   assert.equal(engine.getState().revision, batch[0].revision);
   assert.throws(() => engine.transaction(() => {
      engine.transaction(() => {});
   }), (error) => error.code === 'E_NESTED_TRANSACTION');
   const closed = [];
   engine.transaction((tx) => closed.push(tx));
   assert.throws(() => closed[0].setValue('amount-min', '1'), (error) => error.code === 'E_INCOMPATIBLE_UPDATE');
   engine.destroy();
});

test('snapshots round-trip runtime definitions and serializable raw values, and a bad import changes nothing', () => {
   const registry = {
      providers: { currencies: () => [{ value: 'EUR', label: 'Euro' }] }
   };
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'name', type: 'string', options: () => [] }],
      extensions: { registry }
   });
   assert.throws(() => engine.addDefinition({ id: 'bad', type: 'string', options: () => [] }), (error) => error.code === 'E_UNRESOLVED_REFERENCE');
   engine.addDefinition({ id: 'currency', type: 'select', providerRef: 'currencies' });
   const id = engine.addFilter('currency');
   engine.applyEditorChange(id, { rawValue: 'eu', value: null, status: 'pending', touched: true, selectedLabel: 'Euro' });
   const snapshot = engine.exportState();
   assert.equal(JSON.stringify(snapshot).includes('function'), false);
   assert.equal(snapshot.schemaVersion, 1);
   assert.equal(snapshot.definitions.length, 1);
   assert.equal(snapshot.definitions[0].providerRef, 'currencies');
   assert.equal(snapshot.filters[0].rawValue, 'eu');
   assert.equal(snapshot.filters[0].status, 'pending');
   const copy = JSON.parse(JSON.stringify(snapshot));
   const restored = new Core_FilterEngine({
      definitions: [{ id: 'name', type: 'string' }],
      extensions: { registry }
   });
   restored.importState(copy);
   assert.equal(restored.getState().filters[0].rawValue, 'eu');
   assert.equal(restored.getDefinitions().some((item) => item.id === 'currency'), true);
   const seen = watch(restored);
   restored.importState(JSON.parse(JSON.stringify(restored.exportState())));
   assert.equal(seen.events.length, 0);
   const intact = JSON.stringify(restored.getState());
   assert.throws(() => restored.importState({ schemaVersion: 2, definitions: [], filters: [] }), (error) => error.code === 'E_SCHEMA_VERSION');
   assert.throws(() => restored.importState({
      schemaVersion: 1,
      definitions: [{ id: 'missing', type: 'select', providerRef: 'nope' }],
      filters: []
   }), (error) => error.code === 'E_UNRESOLVED_REFERENCE');
   assert.equal(JSON.stringify(restored.getState()), intact);
   assert.equal(seen.events.length, 0);
   engine.destroy();
   restored.destroy();
});

test('pin locks, group order, duplication limits, and removal stay distinct from clear', () => {
   const engine = new Core_FilterEngine({
      behavior: { maxFilters: 20 },
      definitions: [
         { id: 'amount', type: 'decimal', allowMultipleInstances: true, maxInstances: 2, group: 'Trading / Dates' },
         { id: 'name', type: 'string' }
      ],
      initialFilters: [
         { instanceId: 'locked', definitionId: 'name', pinned: true, removable: false, value: 'Ada' }
      ]
   });
   assert.equal(engine.getState().filters[0].pinLocked, true);
   assert.equal(engine.getState().filters[0].removable, false);
   assert.deepEqual(engine.getDefinitions()[0].groupPath, ['Trading', 'Dates']);
   const second = engine.addFilter('amount', { value: '1' });
   assert.throws(() => engine.moveFilter(second, 0), (error) => error.code === 'E_INCOMPATIBLE_UPDATE');
   assert.equal(engine.getState().filters[0].instanceId, 'locked');
   engine.setPinned('locked', false);
   assert.equal(engine.getState().filters.find((item) => item.instanceId === 'locked').pinLocked, false);
   engine.removeFilter('locked');
   assert.equal(engine.getState().filters.some((item) => item.instanceId === 'locked'), false);
   engine.addFilter('amount', { value: '2' });
   assert.throws(() => engine.addFilter('amount'), (error) => error.code === 'E_LIMIT_REACHED');
   const nameEngine = new Core_FilterEngine({ definitions: [{ id: 'name', type: 'string' }] });
   nameEngine.addFilter('name');
   assert.throws(() => nameEngine.addFilter('name'), (error) => error.code === 'E_DUPLICATION_FORBIDDEN');
   const removable = nameEngine.getState().filters[0].instanceId;
   nameEngine.clearFilter(removable);
   assert.equal(nameEngine.getState().filters.length, 1);
   assert.equal(nameEngine.getState().filters[0].value, null);
   nameEngine.destroy();
   engine.destroy();
});

test('twenty filters, reset, cascade, and destroy', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'name', type: 'string', allowMultipleInstances: true }]
   });
   const ids = [];
   for (let index = 0; index < 20; index += 1) {
      ids.push(engine.addFilter('name', { value: `n${index}` }));
   }
   assert.equal(engine.getState().filters.length, 20);
   assert.equal(engine.getCriteria().criteria.length, 20);
   engine.addDefinition({ id: 'extra', type: 'integer' });
   engine.reset();
   assert.equal(engine.getDefinitions().some((item) => item.id === 'extra'), false);
   assert.equal(engine.getState().filters.length, 0);
   engine.addDefinition({ id: 'extra', type: 'integer' });
   const extra = engine.addFilter('extra', { value: '4' });
   assert.throws(() => engine.removeDefinition('extra'), (error) => error.code === 'E_INCOMPATIBLE_UPDATE');
   engine.removeDefinition('extra', { cascade: true });
   assert.equal(engine.getState().filters.some((item) => item.instanceId === extra), false);
   const seen = watch(engine);
   engine.destroy();
   let completed = 0;
   engine.state$.subscribe({ complete: () => { completed += 1; } });
   engine.events$.subscribe({ complete: () => { completed += 1; } });
   assert.equal(completed, 2);
   assert.throws(() => engine.addFilter('name'), (error) => error.code === 'E_DESTROYED');
   assert.doesNotThrow(() => engine.destroy());
});

test('validate reveals untouched errors and relativeDate stays symbolic', () => {
   const engine = new Core_FilterEngine({
      definitions: [
         { id: 'amount', type: 'decimal', required: true },
         { id: 'period', type: 'relativeDate' }
      ],
      initialFilters: [{ instanceId: 'amount-1', definitionId: 'amount' }]
   });
   const seen = watch(engine);
   const result = engine.validate();
   assert.equal(result.valid, false);
   assert.equal(result.errors[0].code, 'E_REQUIRED');
   assert.equal(engine.getState().filters[0].touched, true);
   assert.equal(seen.events.at(-1).type, 'validationChanged');
   const revealed = seen.events.length;
   engine.validate();
   assert.equal(seen.events.length, revealed);
   const period = engine.addFilter('period', { value: { preset: 'last-n-days', amount: 7 } });
   assert.deepEqual(engine.getState().filters.find((item) => item.instanceId === period).value, { preset: 'last-n-days', amount: 7 });
   engine.setValue(period, { preset: 'yesterday' });
   assert.equal(engine.getState().filters.find((item) => item.instanceId === period).status, 'invalid');
   engine.destroy();
});

test('moveFilter reorders inside a pin group, including the ends and a no-op', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'name', type: 'string', allowMultipleInstances: true }],
      initialFilters: [
         { instanceId: 'p0', definitionId: 'name', pinned: true, value: 'a' },
         { instanceId: 'p1', definitionId: 'name', pinned: true, value: 'b' },
         { instanceId: 'p2', definitionId: 'name', pinned: true, value: 'c' },
         { instanceId: 'u0', definitionId: 'name', value: 'd' },
         { instanceId: 'u1', definitionId: 'name', value: 'e' }
      ]
   });
   const order = () => engine.getState().filters.map((item) => item.instanceId);
   assert.deepEqual(order(), ['p0', 'p1', 'p2', 'u0', 'u1']);
   engine.moveFilter('p0', 2);
   assert.deepEqual(order(), ['p1', 'p2', 'p0', 'u0', 'u1']);
   engine.moveFilter('p0', 0);
   assert.deepEqual(order(), ['p0', 'p1', 'p2', 'u0', 'u1']);
   engine.moveFilter('u1', 3);
   assert.deepEqual(order(), ['p0', 'p1', 'p2', 'u1', 'u0']);
   engine.moveFilter('u1', 4);
   assert.deepEqual(order(), ['p0', 'p1', 'p2', 'u0', 'u1']);
   const seen = watch(engine);
   const revision = engine.getState().revision;
   engine.moveFilter('p2', 2);
   engine.moveFilter('u0', 3);
   assert.equal(engine.getState().revision, revision);
   assert.equal(seen.events.length, 0);
   assert.throws(() => engine.moveFilter('u0', 0), (error) => error.code === 'E_INCOMPATIBLE_UPDATE');
   assert.deepEqual(order(), ['p0', 'p1', 'p2', 'u0', 'u1']);
   engine.destroy();
});

test('select in and notIn accept canonical arrays', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'currency', type: 'select', options: ['EUR', 'USD', 'GBP'] }]
   });
   const id = engine.addFilter('currency', { operator: 'in', value: ['EUR', 'USD'] });
   const filter = engine.getState().filters[0];
   assert.equal(filter.status, 'valid');
   assert.deepEqual(filter.value, ['EUR', 'USD']);
   assert.deepEqual(engine.getCriteria().criteria[0].value, ['EUR', 'USD']);
   engine.setOperator(id, 'notIn');
   assert.deepEqual(engine.getState().filters[0].value, ['EUR', 'USD']);
   engine.setValue(id, ['GBP']);
   assert.deepEqual(engine.getState().filters[0].value, ['GBP']);
   assert.throws(() => engine.setValue(id, ['EUR', 1]), (error) => error.code === 'E_INVALID_SHAPE');
   assert.deepEqual(engine.getState().filters[0].value, ['GBP']);
   assert.throws(() => engine.setValue(id, 'EUR'), (error) => error.code === 'E_INVALID_SHAPE');
   engine.destroy();
});

test('setFilters and importState do not accept a forged valid status', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal' }]
   });
   engine.setFilters([{
      instanceId: 'amount-1',
      definitionId: 'amount',
      operator: 'eq',
      value: 'abc',
      status: 'valid'
   }]);
   assert.equal(engine.getState().filters[0].status, 'invalid');
   assert.equal(engine.getState().filters[0].value, null);
   assert.equal(engine.getCriteria().criteria, null);
   const snapshot = JSON.parse(JSON.stringify(engine.exportState()));
   snapshot.filters[0].status = 'valid';
   snapshot.filters[0].value = 'abc';
   const restored = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal' }]
   });
   restored.importState(JSON.parse(JSON.stringify(snapshot)));
   assert.equal(restored.getState().filters[0].status, 'invalid');
   assert.equal(restored.getCriteria().criteria, null);
   restored.setFilters([{
      instanceId: 'amount-1',
      definitionId: 'amount',
      value: '15',
      status: 'invalid'
   }]);
   assert.equal(restored.getState().filters[0].status, 'valid');
   assert.equal(restored.getState().filters[0].value, '15');
   engine.destroy();
   restored.destroy();
});

test('a transaction can remove and recreate the same instance id', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal' }],
      initialFilters: [{ instanceId: 'amount-min', definitionId: 'amount', value: '10' }]
   });
   const seen = watch(engine);
   engine.transaction((tx) => {
      tx.removeFilter('amount-min');
      tx.addFilter('amount', { instanceId: 'amount-min', operator: 'gt', value: '99' });
   });
   const batch = seen.events.filter((event) => event.revision === engine.getState().revision);
   assert.deepEqual(batch.map((event) => event.type), ['filterRemoved', 'filterAdded']);
   assert.equal(batch[0].previous.value, '10');
   assert.equal(batch[0].current, null);
   assert.equal(batch[1].previous, null);
   assert.equal(batch[1].current.value, '99');
   assert.equal(batch[1].current.operator, 'gt');
   assert.equal(batch[0].transactionId, batch[1].transactionId);
   assert.equal(batch[0].state, batch[1].state);
   assert.equal(engine.getState().filters[0].value, '99');
   engine.destroy();
});

test('withSource marks CORE_UX commands as user without a new method argument', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal', allowMultipleInstances: true }]
   });
   const seen = watch(engine);
   const id = engine.withSource('user', () => engine.addFilter('amount', { value: '1' }));
   assert.equal(seen.events.at(-1).source, 'user');
   engine.withSource('user', () => {
      engine.transaction((tx) => {
         tx.setValue(id, '2');
         tx.setPinned(id, true);
      });
   });
   const batch = seen.events.filter((event) => event.revision === engine.getState().revision);
   assert.deepEqual(batch.map((event) => event.source), ['user', 'user']);
   assert.equal(new Set(batch.map((event) => event.transactionId)).size, 1);
   engine.setValue(id, '3');
   assert.equal(seen.events.at(-1).source, 'api');
   engine.destroy();
});

test('list types parse one array and select in parses each item', () => {
   const definitions = [
      { id: 'currencies', type: 'multiSelect' },
      { id: 'labels', type: 'tags' },
      { id: 'nodes', type: 'treeSelect' },
      { id: 'currency', type: 'select', options: ['EUR', 'USD', 'GBP'] }
   ];
   const engine = new Core_FilterEngine({ definitions });
   const currencies = engine.addFilter('currencies', { value: ['EUR', 'USD'] });
   const labels = engine.addFilter('labels', { value: ['blue'] });
   const nodes = engine.addFilter('nodes', { value: ['root', 'child'] });
   const currency = engine.addFilter('currency', { operator: 'in', value: ['EUR', 'USD'] });
   const read = (target, id) => target.getState().filters.find((item) => item.instanceId === id);
   assert.equal(read(engine, currencies).operator, 'containsAny');
   assert.equal(read(engine, labels).operator, 'containsAny');
   assert.equal(read(engine, nodes).operator, 'containsAny');
   assert.equal(read(engine, currencies).status, 'valid');
   assert.equal(read(engine, labels).status, 'valid');
   assert.equal(read(engine, nodes).status, 'valid');
   assert.deepEqual(read(engine, currencies).value, ['EUR', 'USD']);
   assert.deepEqual(read(engine, nodes).value, ['root', 'child']);
   engine.setValue(labels, ['red', 'green']);
   engine.setValue(currency, ['GBP']);
   assert.deepEqual(engine.getCriteria().criteria.find((item) => item.instanceId === labels).value, ['red', 'green']);
   assert.deepEqual(engine.getCriteria().criteria.find((item) => item.instanceId === currency).value, ['GBP']);
   assert.deepEqual(engine.getCriteria().criteria.find((item) => item.instanceId === nodes).value, ['root', 'child']);
   const snapshot = JSON.parse(JSON.stringify(engine.exportState()));
   const restored = new Core_FilterEngine({ definitions });
   restored.importState(snapshot);
   assert.equal(read(restored, currencies).status, 'valid');
   assert.equal(read(restored, currencies).operator, 'containsAny');
   assert.deepEqual(restored.getCriteria().criteria.find((item) => item.instanceId === currencies).value, ['EUR', 'USD']);
   assert.deepEqual(restored.getCriteria().criteria.find((item) => item.instanceId === nodes).value, ['root', 'child']);
   assert.deepEqual(restored.getCriteria().criteria.find((item) => item.instanceId === currency).value, ['GBP']);
   const revision = engine.getState().revision;
   assert.throws(() => engine.setValue(currencies, 'EUR'), (error) => error.code === 'E_INVALID_SHAPE');
   assert.throws(() => engine.setValue(nodes, ['root', 1]), (error) => error.code === 'E_INVALID_SHAPE');
   assert.equal(engine.getState().revision, revision);
   assert.deepEqual(read(engine, currencies).value, ['EUR', 'USD']);
   engine.destroy();
   restored.destroy();
});

test('subscriber re-entry stays ordered and nested snapshots are frozen', () => {
   const engine = new Core_FilterEngine({
      definitions: [
         { id: 'amount', type: 'decimal' },
         { id: 'currency', type: 'select', options: ['EUR', 'USD'] }
      ]
   });
   const amount = engine.addFilter('amount', { operator: 'between', value: { min: '1', max: '5' } });
   const currency = engine.addFilter('currency', { operator: 'in', value: ['EUR'] });
   /** @type {string[]} */
   const trace = [];
   let armed = false;
   let reentered = false;
   engine.state$.subscribe((state) => {
      const live = engine.getState();
      assert.equal(live.revision, state.revision);
      assert.deepEqual(live.filters.map((item) => item.value), state.filters.map((item) => item.value));
      trace.push(`state:${state.revision}`);
      if (armed && !reentered) {
         reentered = true;
         engine.setValue(amount, { min: '2', max: '6' });
      }
   });
   engine.events$.subscribe((event) => {
      assert.equal(event.revision, event.state.revision);
      assert.equal(event.transactionId.startsWith('tx-'), true);
      trace.push(`event:${event.revision}:${event.transactionId}`);
   });
   armed = true;
   const before = trace.length;
   engine.setValue(amount, { min: '3', max: '7' });
   const tail = trace.slice(before);
   assert.deepEqual(tail.map((item) => item.split(':')[0]), ['state', 'event', 'state', 'event']);
   assert.equal(tail[0].split(':')[1], tail[1].split(':')[1]);
   assert.equal(tail[2].split(':')[1], tail[3].split(':')[1]);
   assert.notEqual(tail[1].split(':')[2], tail[3].split(':')[2]);
   assert.deepEqual(engine.getState().filters[0].value, { min: '2', max: '6' });
   const state = engine.getState();
   assert.throws(() => { state.filters[0].value.min = '9'; }, TypeError);
   assert.throws(() => { state.filters.push({}); }, TypeError);
   const exported = engine.exportState();
   assert.throws(() => { exported.filters[0].value.max = '9'; }, TypeError);
   assert.equal(JSON.parse(JSON.stringify(exported)).filters[0].value.min, '2');
   const criteria = engine.getCriteria();
   assert.throws(() => { criteria.criteria[1].value.push('USD'); }, TypeError);
   assert.deepEqual(engine.getCriteria().criteria.find((item) => item.instanceId === currency).value, ['EUR']);
   assert.throws(() => { engine.getDefinitions()[1].operators.push('nope'); }, TypeError);
   engine.destroy();
});

test('reentrant addFilter and transaction return their results without interleaving', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal', allowMultipleInstances: true }]
   });
   const first = engine.addFilter('amount', { value: '1' });
   /** @type {string[]} */
   const trace = [];
   let armed = false;
   let started = false;
   let created = '';
   /** @type {string|undefined} */
   let returned;
   engine.state$.subscribe((state) => {
      trace.push(`state:${state.revision}:${state.filters.map((item) => item.value).join(',')}`);
      if (!armed || started) {
         return;
      }
      started = true;
      assert.equal(engine.getState().revision, state.revision);
      created = engine.addFilter('amount', { value: '4' });
      assert.notEqual(created, '');
      assert.equal(engine.getState().filters.some((item) => item.instanceId === created), false);
      returned = engine.transaction((tx) => {
         tx.setValue(created, '8');
         assert.equal(tx.getState().filters.find((item) => item.instanceId === created).value, '8');
         return 'kept';
      });
      assert.equal(returned, 'kept');
      assert.equal(engine.getState().revision, state.revision);
      assert.throws(() => engine.addFilter('missing'), (error) => error.code === 'E_UNKNOWN_DEFINITION');
      assert.throws(() => engine.transaction(() => engine.transaction(() => {})), (error) => error.code === 'E_NESTED_TRANSACTION');
      assert.throws(() => engine.transaction(() => Promise.resolve('later')), (error) => error.code === 'E_ASYNC_TRANSACTION');
      assert.equal(engine.getState().revision, state.revision);
      assert.equal(engine.getState().filters.some((item) => item.instanceId === created), false);
   });
   engine.events$.subscribe((event) => {
      trace.push(`event:${event.revision}:${event.transactionId}:${event.type}`);
   });
   armed = true;
   const before = trace.length;
   engine.setValue(first, '2');
   const tail = trace.slice(before);
   assert.deepEqual(tail.map((item) => item.split(':')[0]), ['state', 'event', 'state', 'event', 'state', 'event']);
   assert.equal(tail[0].split(':')[1], tail[1].split(':')[1]);
   assert.equal(tail[2].split(':')[1], tail[3].split(':')[1]);
   assert.equal(tail[4].split(':')[1], tail[5].split(':')[1]);
   assert.notEqual(tail[1].split(':')[2], tail[3].split(':')[2]);
   assert.notEqual(tail[3].split(':')[2], tail[5].split(':')[2]);
   assert.deepEqual(tail.filter((item) => item.startsWith('event')).map((item) => item.split(':')[3]), [
      'valueChanged',
      'filterAdded',
      'valueChanged'
   ]);
   assert.equal(returned, 'kept');
   assert.equal(engine.getState().filters.find((item) => item.instanceId === first).value, '2');
   assert.equal(engine.getState().filters.find((item) => item.instanceId === created).value, '8');
   engine.destroy();
});

test('repeated edits in one transaction collapse to the net change', () => {
   const engine = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal' }],
      initialFilters: [{ instanceId: 'amount-min', definitionId: 'amount', value: '1' }]
   });
   const seen = watch(engine);
   engine.transaction((tx) => {
      tx.setValue('amount-min', '2');
      tx.setValue('amount-min', '3');
   });
   assert.equal(seen.events.length, 1);
   assert.equal(seen.events[0].type, 'valueChanged');
   assert.equal(seen.events[0].current.value, '3');
   assert.equal(seen.events[0].previous.value, '1');
   const revision = engine.getState().revision;
   engine.transaction((tx) => {
      tx.setValue('amount-min', '9');
      tx.setValue('amount-min', '3');
   });
   assert.equal(engine.getState().revision, revision);
   assert.equal(seen.events.length, 1);
   engine.destroy();
});

test('replacing a definition callback is a catalog change and an identical update is not', () => {
   const allow = () => null;
   const reject = () => [{ code: 'E_CUSTOM', message: 'Rejected.' }];
   const providerA = () => [{ value: 'EUR', label: 'Euro' }];
   const providerB = () => [{ value: 'USD', label: 'US Dollar' }];
   const parseA = (value) => ({ status: 'valid', value, errors: [] });
   const parseB = () => ({ status: 'invalid', value: null, errors: [{ code: 'E_CUSTOM', message: 'Unparsed.' }] });
   const compareA = () => 0;
   const compareB = () => null;
   const engine = new Core_FilterEngine({
      definitions: [
         { id: 'amount', type: 'decimal', validate: allow, compare: compareA },
         { id: 'currency', type: 'select', options: providerA },
         { id: 'code', type: 'string', parse: parseA }
      ]
   });
   const seen = watch(engine);
   const quiet = engine.getState().revision;
   engine.updateDefinition('amount', { validate: allow, compare: compareA });
   assert.equal(engine.getState().revision, quiet);
   assert.equal(seen.events.length, 0);

   engine.updateDefinition('amount', { validate: reject });
   const replaced = seen.events.at(-1);
   assert.equal(replaced.type, 'catalogChanged');
   assert.equal(replaced.definitionId, 'amount');
   assert.equal(engine.getState().revision, quiet + 1);
   assert.equal(engine.getState().filters.length, 0);
   assert.equal(engine.getDefinitions().find((item) => item.id === 'amount').validate, reject);
   assert.equal(engine.getDefinitions().find((item) => item.id === 'amount').compare, compareA);
   const exported = JSON.parse(JSON.stringify(engine.exportState()));
   assert.equal(exported.schemaVersion, 1);
   assert.deepEqual(exported.definitions, []);

   engine.updateDefinition('amount', { validate: allow });
   const amount = engine.addFilter('amount', { value: '10' });
   assert.equal(engine.getState().filters.find((item) => item.instanceId === amount).status, 'valid');
   engine.updateDefinition('amount', { validate: reject });
   assert.equal(engine.getState().filters.find((item) => item.instanceId === amount).status, 'invalid');
   assert.equal(engine.getCriteria().criteria, null);
   const revalidated = seen.events.filter((event) => event.revision === engine.getState().revision);
   assert.deepEqual(revalidated.map((event) => event.type), ['catalogChanged', 'validationChanged']);
   assert.equal(revalidated[0].transactionId, revalidated[1].transactionId);
   assert.equal(revalidated[0].state, revalidated[1].state);
   assert.equal(revalidated[1].instanceId, amount);

   const beforeProvider = engine.getState().revision;
   engine.updateDefinition('currency', { options: providerB });
   assert.equal(engine.getState().revision, beforeProvider + 1);
   assert.equal(seen.events.at(-1).type, 'catalogChanged');
   assert.equal(seen.events.at(-1).definitionId, 'currency');
   assert.equal(engine.getDefinitions().find((item) => item.id === 'currency').provider, providerB);

   const code = engine.addFilter('code', { value: 'ABC' });
   assert.equal(engine.getState().filters.find((item) => item.instanceId === code).status, 'valid');
   engine.updateDefinition('code', { parse: parseB });
   assert.equal(engine.getState().filters.find((item) => item.instanceId === code).status, 'invalid');
   assert.equal(engine.getDefinitions().find((item) => item.id === 'code').parse, parseB);
   const parsed = seen.events.filter((event) => event.revision === engine.getState().revision);
   assert.deepEqual(parsed.map((event) => event.type), ['catalogChanged', 'validationChanged']);

   const beforeCompare = engine.getState().revision;
   const eventCount = seen.events.length;
   engine.updateDefinition('amount', { compare: compareB });
   assert.equal(engine.getState().revision, beforeCompare + 1);
   assert.equal(seen.events.at(-1).type, 'catalogChanged');
   assert.equal(engine.getDefinitions().find((item) => item.id === 'amount').compare, compareB);
   engine.updateDefinition('amount', { validate: reject, compare: compareB });
   engine.updateDefinition('currency', { options: providerB });
   engine.updateDefinition('code', { parse: parseB });
   assert.equal(engine.getState().revision, beforeCompare + 1);
   assert.equal(seen.events.length, eventCount + 1);
   assert.equal(JSON.parse(JSON.stringify(engine.exportState())).schemaVersion, 1);
   engine.destroy();
});

test('a rejected canonical value is accepted again and raw drafts stay', () => {
   const allow = () => null;
   const reject = () => [{ code: 'E_CUSTOM', message: 'Rejected.' }];
   const parseOk = (value) => ({ status: 'valid', value, errors: [] });
   const parseNo = () => ({ status: 'invalid', value: null, errors: [{ code: 'E_CUSTOM', message: 'Unparsed.' }] });
   const engine = new Core_FilterEngine({
      definitions: [
         { id: 'amount', type: 'decimal', allowMultipleInstances: true, validate: allow },
         { id: 'code', type: 'string', allowMultipleInstances: true, parse: parseOk }
      ]
   });
   const seen = watch(engine);
   const read = (id) => engine.getState().filters.find((item) => item.instanceId === id);
   const amount = engine.addFilter('amount', { value: '15' });
   const pending = engine.addFilter('amount', { value: '1' });
   const broken = engine.addFilter('amount', { value: '2' });
   engine.applyEditorChange(pending, { rawValue: '12,', value: null, status: 'pending', touched: true });
   engine.applyEditorChange(broken, {
      rawValue: 'abc',
      value: null,
      status: 'invalid',
      errors: [{ code: 'E_INVALID_SHAPE', message: 'Invalid value.' }],
      touched: true
   });
   const pendingDraft = read(pending);
   const brokenDraft = read(broken);

   const origin = engine.getState().revision;
   engine.updateDefinition('amount', { validate: reject });
   assert.equal(engine.getState().revision, origin + 1);
   assert.equal(read(amount).status, 'invalid');
   assert.equal(read(amount).value, null);
   assert.equal(read(amount).rawValue, '15');
   assert.equal(read(amount).errors[0].code, 'E_CUSTOM');
   assert.equal(engine.getCriteria().criteria, null);
   let batch = seen.events.filter((event) => event.revision === engine.getState().revision);
   assert.deepEqual(batch.map((event) => event.type), ['catalogChanged', 'validationChanged']);
   assert.equal(batch[1].instanceId, amount);
   assert.equal(batch[0].transactionId, batch[1].transactionId);
   assert.equal(batch[0].state, batch[1].state);
   assert.equal(batch[0].state.revision, origin + 1);
   assert.deepEqual(read(pending), pendingDraft);
   assert.deepEqual(read(broken), brokenDraft);

   engine.updateDefinition('amount', { validate: allow });
   assert.equal(engine.getState().revision, origin + 2);
   assert.equal(read(amount).status, 'valid');
   assert.equal(read(amount).value, '15');
   assert.equal(read(amount).rawValue, undefined);
   assert.deepEqual(read(amount).errors, []);
   assert.deepEqual(read(pending), pendingDraft);
   assert.deepEqual(read(broken), brokenDraft);
   batch = seen.events.filter((event) => event.revision === engine.getState().revision);
   assert.deepEqual(batch.map((event) => event.type), ['catalogChanged', 'validationChanged']);
   assert.equal(batch[1].instanceId, amount);
   assert.equal(batch[0].transactionId, batch[1].transactionId);
   assert.notEqual(batch[0].transactionId, seen.events.find((event) => event.revision === origin + 1).transactionId);
   assert.equal(engine.getCriteria().criteria, null);

   const code = engine.addFilter('code', { value: 'ABC' });
   const codePending = engine.addFilter('code', { value: 'Z' });
   engine.applyEditorChange(codePending, { rawValue: 'ab', value: null, status: 'pending', touched: true });
   const codeDraft = read(codePending);
   const codeOrigin = engine.getState().revision;
   engine.updateDefinition('code', { parse: parseNo });
   assert.equal(engine.getState().revision, codeOrigin + 1);
   assert.equal(read(code).status, 'invalid');
   assert.equal(read(code).value, null);
   assert.equal(read(code).rawValue, 'ABC');
   assert.equal(engine.getCriteria().criteria, null);
   batch = seen.events.filter((event) => event.revision === engine.getState().revision);
   assert.deepEqual(batch.map((event) => event.type), ['catalogChanged', 'validationChanged']);
   assert.equal(batch[1].instanceId, code);
   assert.equal(batch[0].transactionId, batch[1].transactionId);
   assert.deepEqual(read(codePending), codeDraft);
   assert.deepEqual(read(pending), pendingDraft);
   assert.deepEqual(read(broken), brokenDraft);

   engine.updateDefinition('code', { parse: parseOk });
   assert.equal(engine.getState().revision, codeOrigin + 2);
   assert.equal(read(code).status, 'valid');
   assert.equal(read(code).value, 'ABC');
   assert.equal(read(code).rawValue, undefined);
   assert.deepEqual(read(codePending), codeDraft);
   assert.deepEqual(read(pending), pendingDraft);
   assert.deepEqual(read(broken), brokenDraft);
   batch = seen.events.filter((event) => event.revision === engine.getState().revision);
   assert.deepEqual(batch.map((event) => event.type), ['catalogChanged', 'validationChanged']);
   assert.equal(batch[0].transactionId, batch[1].transactionId);
   assert.equal(batch[0].revision, codeOrigin + 2);
   engine.destroy();

   const clean = new Core_FilterEngine({
      definitions: [{ id: 'amount', type: 'decimal', validate: allow }]
   });
   const watched = watch(clean);
   const id = clean.addFilter('amount', { value: '15' });
   const start = clean.getState().revision;
   clean.updateDefinition('amount', { validate: reject });
   assert.equal(clean.getCriteria().criteria, null);
   clean.updateDefinition('amount', { validate: allow });
   assert.equal(clean.getState().revision, start + 2);
   assert.equal(clean.getState().filters[0].status, 'valid');
   assert.deepEqual(clean.getCriteria().criteria, [{
      instanceId: id,
      definitionId: 'amount',
      operator: 'eq',
      value: '15'
   }]);
   const restored = watched.events.filter((event) => event.revision === clean.getState().revision);
   assert.deepEqual(restored.map((event) => event.type), ['catalogChanged', 'validationChanged']);
   assert.equal(restored[0].state.filters[0].value, '15');
   clean.destroy();
});
