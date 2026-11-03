/**
 * Filter state engine. No DOM and no network. The caller owns any data backend.
 * One instance per bar: `new Core_FilterEngine(config)`, not a $svc singleton.
 */
import { BehaviorSubject, Subject } from 'rxjs';
import { readonlyObservable } from '../utils/core-readonly-observable.js';
import {
   defaultOperator,
   getValueType,
   operatorCardinality,
   operatorsFor,
   parseValue
} from '../value/core-value-registry.js';
import { Core_FilterError } from './core-filter-error.js';

/**
 * @typedef {'user'|'api'|'system'} ChangeSource
 * @typedef {'empty'|'pending'|'valid'|'invalid'} InputStatus
 * @typedef {'none'|'single'|'list'|'range'} Cardinality
 */

const EDITOR_BY_TYPE = {
   string: 'text',
   email: 'text',
   integer: 'formatted',
   decimal: 'formatted',
   boolean: 'boolean',
   date: 'formatted',
   time: 'formatted',
   datetime: 'formatted',
   relativeDate: 'formatted',
   select: 'select',
   multiSelect: 'multiSelect',
   autocomplete: 'autocomplete',
   tags: 'tags',
   treeSelect: 'treeSelect',
   range: 'range'
};

const LIST_EDITORS = ['multiSelect', 'tags', 'treeSelect', 'autocomplete'];
const VALIDATION_MODES = ['immediate', 'touched', 'manual'];
const STATUSES = ['empty', 'pending', 'valid', 'invalid'];
const DEFINITION_KEYS = [
   'id', 'label', 'description', 'type', 'valueType', 'editor', 'operators', 'defaultOperator',
   'allowMultipleInstances', 'maxInstances', 'required', 'pinnable', 'format', 'validation',
   'editorOptions', 'options', 'group', 'groupPath', 'keywords', 'visible', 'disabled',
   'providerRef', 'editorRef', 'parseRef', 'formatRef', 'validateRef', 'compareRef'
];
const FILTER_KEYS = [
   'instanceId', 'definitionId', 'operator', 'value', 'pinned', 'pinLocked', 'removable',
   'selectedLabel', 'touched', 'status', 'rawValue'
];

/**
 * @param {string} code
 * @param {string} message
 * @param {Readonly<Record<string, unknown>>} [details]
 * @returns {never}
 */
function fail(code, message, details) {
   throw new Core_FilterError(code, message, details);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
   return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} id
 * @returns {string}
 */
function labelFromId(id) {
   const spaced = id
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z\d])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .trim()
      .toLowerCase();
   return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : id;
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function cloneJson(value) {
   if (value === undefined) {
      return undefined;
   }
   return JSON.parse(JSON.stringify(value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isJsonValue(value) {
   if (value === undefined) {
      return false;
   }
   try {
      JSON.stringify(value);
      return true;
   } catch {
      return false;
   }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isThenable(value) {
   return Boolean(value) && (typeof value === 'object' || typeof value === 'function') && typeof /** @type {{ then?: unknown }} */ (value).then === 'function';
}

/**
 * @param {unknown} base
 * @param {unknown} override
 * @returns {Record<string, unknown>}
 */
function mergePlain(base, override) {
   /** @type {Record<string, unknown>} */
   const out = isPlainObject(base) ? { .../** @type {Record<string, unknown>} */ (cloneJson(base)) } : {};
   if (!isPlainObject(override)) {
      return out;
   }
   for (const [key, value] of Object.entries(/** @type {Record<string, unknown>} */ (override))) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
         continue;
      }
      if (isPlainObject(value) && isPlainObject(out[key])) {
         out[key] = mergePlain(out[key], value);
      } else if (typeof value === 'function') {
         out[key] = value;
      } else {
         out[key] = cloneJson(value);
      }
   }
   return out;
}

/**
 * @param {unknown} value
 * @param {string} [instanceId]
 * @returns {object[]}
 */
function copyErrors(value, instanceId) {
   if (!Array.isArray(value)) {
      return [];
   }
   return value.map((error) => {
      const source = /** @type {{ code?: string, message?: string, details?: object }} */ (error || {});
      /** @type {{ code: string, message?: string, instanceId?: string, details?: object }} */
      const copy = { code: source.code || 'E_INVALID_SHAPE' };
      if (source.message) {
         copy.message = source.message;
      }
      if (instanceId) {
         copy.instanceId = instanceId;
      }
      if (source.details && isJsonValue(source.details)) {
         copy.details = /** @type {object} */ (cloneJson(source.details));
      }
      return copy;
   });
}

/**
 * @param {unknown} value
 * @returns {value is string|boolean|null}
 */
function isScalar(value) {
   return value == null || typeof value === 'string' || typeof value === 'boolean';
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function freezeDeep(value) {
   if (!value || typeof value !== 'object') {
      return value;
   }
   for (const child of Object.values(value)) {
      freezeDeep(child);
   }
   return Object.isFrozen(value) ? value : Object.freeze(value);
}

export class Core_FilterEngine {

   /**
    * @param {object} [config]
    */
   constructor(config = {}) {
      if (config != null && !isPlainObject(config)) {
         fail('E_INVALID_SHAPE', 'Filter engine config must be an object.');
      }
      const source = /** @type {Record<string, any>} */ (config || {});
      this._destroyed = false;
      this._inTx = false;
      this._txSeq = 0;
      this._revision = 0;
      this._source = /** @type {ChangeSource} */ ('api');
      this._ops = [];
      this._origin = null;
      /** @type {Array<() => void>} */
      this._pending = [];
      this._emitting = false;
      /** @type {object|null} */
      this._deferredTail = null;
      this._work = {
         /** @type {Map<string, any>} */
         definitions: new Map(),
         /** @type {string[]} */
         order: [],
         /** @type {Set<string>} */
         runtime: new Set(),
         /** @type {any[]} */
         filters: []
      };
      this._live = this._work;
      this._locale = typeof source.defaults?.locale === 'string' ? source.defaults.locale : 'en';
      this._validation = this._readValidation(source.defaults?.validation);
      this._globalFormat = mergePlain({}, source.defaults?.format);
      this._typeDefaults = this._readTypeDefaults(source.defaults?.types);
      this._behavior = {
         maxFilters: this._readLimit(source.behavior?.maxFilters, 'behavior.maxFilters'),
         allowCrossGroupMove: source.behavior?.allowCrossGroupMove === true
      };
      this._ui = {
         layout: source.ui?.layout || 'wrap',
         density: source.ui?.density || 'inline',
         validationMode: this._validation.mode
      };
      if (!['wrap', 'scroll', 'vertical'].includes(this._ui.layout)) {
         fail('E_INVALID_SHAPE', 'ui.layout must be wrap, scroll, or vertical.');
      }
      this._registry = this._readRegistry(source.extensions?.registry);
      this._idCounter = 0;
      for (const definition of source.definitions || []) {
         this._insertDefinition(definition, false);
      }
      for (const filter of source.initialFilters || []) {
         this._insertFilter(filter, true);
      }
      this._baseline = this._cloneModel();
      this._stateSubject = new BehaviorSubject(this.getState());
      this._eventsSubject = new Subject();
      this._state$ = readonlyObservable(this._stateSubject);
      this._events$ = readonlyObservable(this._eventsSubject);
   }

   /** @returns {Map<string, any>} */
   get _definitions() {
      return this._work.definitions;
   }

   /** @param {Map<string, any>} value */
   set _definitions(value) {
      this._work.definitions = value;
   }

   /** @returns {string[]} */
   get _order() {
      return this._work.order;
   }

   /** @param {string[]} value */
   set _order(value) {
      this._work.order = value;
   }

   /** @returns {Set<string>} */
   get _runtime() {
      return this._work.runtime;
   }

   /** @param {Set<string>} value */
   set _runtime(value) {
      this._work.runtime = value;
   }

   /** @returns {any[]} */
   get _filters() {
      return this._work.filters;
   }

   /** @param {any[]} value */
   set _filters(value) {
      this._work.filters = value;
   }

   /** @returns {import('rxjs').Observable<object>} */
   get state$() {
      return this._state$;
   }

   /** @returns {import('rxjs').Observable<object>} */
   get events$() {
      return this._events$;
   }

   /**
    * @returns {readonly object[]}
    */
   getDefinitions() {
      this._assertLive();
      return Object.freeze(this._live.order.map((id) => this._publicDefinition(this._live.definitions.get(id))));
   }

   /**
    * @returns {object}
    */
   getState() {
      this._assertLive();
      return this._projectState(this._live, this._revision);
   }

   /**
    * @returns {object}
    */
   getCriteria() {
      this._assertLive();
      return this._projectCriteria(this._live);
   }

   /**
    * @returns {object}
    */
   getResolvedConfig() {
      this._assertLive();
      return Object.freeze({
         defaults: Object.freeze({
            locale: this._locale,
            validation: Object.freeze({ ...this._validation }),
            format: Object.freeze(cloneJson(this._globalFormat)),
            types: Object.freeze(cloneJson(this._typeDefaults))
         }),
         behavior: Object.freeze({ ...this._behavior }),
         ui: Object.freeze({ ...this._ui }),
         definitions: this.getDefinitions(),
         extensions: Object.freeze({
            registry: Object.freeze({
               providers: Object.freeze({ ...this._registry.providers }),
               editors: Object.freeze({ ...this._registry.editors }),
               parsers: Object.freeze({ ...this._registry.parsers }),
               formatters: Object.freeze({ ...this._registry.formatters }),
               validators: Object.freeze({ ...this._registry.validators }),
               comparators: Object.freeze({ ...this._registry.comparators })
            })
         })
      });
   }

   /**
    * @returns {object}
    */
   validate() {
      this._apply(() => {
         for (const instance of this._filters) {
            if (!instance.touched) {
               const before = JSON.stringify(this._publicInstance(instance));
               instance.touched = true;
               if (before !== JSON.stringify(this._publicInstance(instance))) {
                  this._record({
                     type: 'validationChanged',
                     instanceId: instance.instanceId,
                     definitionId: instance.definitionId
                  });
               }
            }
         }
      });
      const criteria = this._projectCriteria(this._inTx ? this._work : this._live);
      return Object.freeze({
         valid: criteria.valid,
         errors: criteria.errors
      });
   }

   /**
    * @returns {object}
    */
   exportState() {
      this._assertLive();
      return this._projectSnapshot(this._live);
   }

   /**
    * @param {object} definition
    */
   addDefinition(definition) {
      this._apply(() => {
         this._insertDefinition(definition, true);
         this._record({ type: 'catalogChanged', definitionId: definition?.id });
      });
   }

   /**
    * @param {string} id
    * @param {object} patch
    */
   updateDefinition(id, patch) {
      this._apply(() => {
         const current = this._requireDefinition(id);
         if (!isPlainObject(patch)) {
            fail('E_INVALID_SHAPE', 'A definition patch must be an object.');
         }
         if ('id' in patch && patch.id !== id) {
            fail('E_INCOMPATIBLE_UPDATE', 'A definition id cannot change.');
         }
         const nextInput = { ...this._definitionInput(current), ...patch, id };
         if (isPlainObject(patch.format)) {
            nextInput.format = mergePlain(current.format, patch.format);
         }
         if (isPlainObject(patch.validation)) {
            nextInput.validation = mergePlain(current.validation, patch.validation);
         }
         if (isPlainObject(patch.editorOptions)) {
            nextInput.editorOptions = mergePlain(current.editorOptions, patch.editorOptions);
         }
         const rebuilt = this._normalizeDefinition(nextInput, this._runtime.has(id));
         this._assertDefinitionCompatible(current, rebuilt);
         const before = new Map(this._filters.filter((item) => item.definitionId === id).map((item) => [item.instanceId, JSON.stringify(this._publicInstance(item))]));
         this._definitions.set(id, rebuilt);
         for (const instance of this._filters.filter((item) => item.definitionId === id)) {
            this._revalidate(instance, rebuilt);
         }
         if (!this._sameDefinition(current, rebuilt)) {
            this._record({ type: 'catalogChanged', definitionId: id });
         }
         for (const instance of this._filters.filter((item) => item.definitionId === id)) {
            if (before.get(instance.instanceId) !== JSON.stringify(this._publicInstance(instance))) {
               this._record({ type: 'validationChanged', instanceId: instance.instanceId, definitionId: id });
            }
         }
      });
   }

   /**
    * @param {string} id
    * @param {{ cascade?: boolean }} [options]
    */
   removeDefinition(id, options = {}) {
      this._apply(() => {
         this._requireDefinition(id);
         const instances = this._filters.filter((item) => item.definitionId === id);
         if (instances.length > 0 && options?.cascade !== true) {
            fail('E_INCOMPATIBLE_UPDATE', 'Remove the instances first, or pass { cascade: true }.');
         }
         for (const instance of instances) {
            this._record({ type: 'filterRemoved', instanceId: instance.instanceId, definitionId: id });
         }
         this._filters = this._filters.filter((item) => item.definitionId !== id);
         this._definitions.delete(id);
         this._order = this._order.filter((item) => item !== id);
         this._runtime.delete(id);
         this._record({ type: 'catalogChanged', definitionId: id });
      });
   }

   /**
    * @param {string} definitionId
    * @param {object} [options]
    * @returns {string}
    */
   addFilter(definitionId, options = {}) {
      /** @type {string} */
      let created = '';
      this._apply(() => {
         created = this._insertFilter({ ...options, definitionId }, false);
         this._record({ type: 'filterAdded', instanceId: created, definitionId });
      });
      return created;
   }

   /**
    * @param {string} instanceId
    */
   removeFilter(instanceId) {
      this._apply(() => {
         const index = this._filters.findIndex((item) => item.instanceId === instanceId);
         if (index < 0) {
            fail('E_UNKNOWN_INSTANCE', `Unknown filter instance: ${instanceId}`);
         }
         const [removed] = this._filters.splice(index, 1);
         this._record({ type: 'filterRemoved', instanceId, definitionId: removed.definitionId });
      });
   }

   /**
    * @param {string} instanceId
    */
   clearFilter(instanceId) {
      this._apply(() => {
         const instance = this._requireInstance(instanceId);
         const definition = this._requireDefinition(instance.definitionId);
         if (operatorCardinality(instance.operator) === 'none') {
            return;
         }
         const empty = this._emptyValue(operatorCardinality(instance.operator));
         if (this._sameOperand(instance, empty, 'empty') && instance.rawValue === undefined) {
            return;
         }
         instance.value = empty;
         instance.rawValue = undefined;
         instance.status = 'empty';
         instance.errors = [];
         instance.selectedLabel = undefined;
         instance.rejectedCanonical = false;
         this._applyRequired(instance, definition);
         this._record({ type: 'filterCleared', instanceId, definitionId: instance.definitionId });
      });
   }

   /**
    * @param {string} instanceId
    * @param {unknown} value
    */
   setValue(instanceId, value) {
      this._apply(() => {
         const instance = this._requireInstance(instanceId);
         const definition = this._requireDefinition(instance.definitionId);
         const next = this._acceptCanonical(definition, instance.operator, value);
         if (this._sameOperand(instance, next.value, next.status) && instance.rawValue === undefined && this._sameErrors(instance.errors, next.errors)) {
            return;
         }
         instance.value = next.value;
         instance.rawValue = next.rawValue;
         instance.status = next.status;
         instance.errors = next.errors;
         instance.rejectedCanonical = false;
         if (next.status === 'valid') {
            instance.selectedLabel = this._labelFor(definition, next.value, instance.selectedLabel);
         }
         this._record({ type: 'valueChanged', instanceId, definitionId: instance.definitionId });
      });
   }

   /**
    * Editor channel. Keeps raw text and pending/invalid. Does not accept a localized string as a canonical value.
    * @param {string} instanceId
    * @param {object} change
    * @param {ChangeSource} [source]
    */
   applyEditorChange(instanceId, change, source = 'user') {
      const previous = this._source;
      this._source = source;
      try {
         this._apply(() => {
            const instance = this._requireInstance(instanceId);
            const definition = this._requireDefinition(instance.definitionId);
            if (!isPlainObject(change) || !STATUSES.includes(change.status)) {
               fail('E_INVALID_SHAPE', 'An editor change needs a status of empty, pending, valid, or invalid.');
            }
            const next = this._acceptEditorChange(definition, instance.operator, change);
            if (this._sameOperand(instance, next.value, next.status)
               && JSON.stringify(instance.rawValue ?? null) === JSON.stringify(next.rawValue ?? null)
               && instance.touched === next.touched
               && this._sameErrors(instance.errors, next.errors)) {
               return;
            }
            instance.value = next.value;
            instance.rawValue = next.rawValue;
            instance.status = next.status;
            instance.errors = next.errors;
            instance.touched = next.touched;
            instance.rejectedCanonical = false;
            if (next.status === 'valid') {
               instance.selectedLabel = this._labelFor(definition, next.value, change.selectedLabel || instance.selectedLabel);
            } else if (typeof change.selectedLabel === 'string') {
               instance.selectedLabel = change.selectedLabel;
            }
            this._record({ type: 'valueChanged', instanceId, definitionId: instance.definitionId });
         });
      } finally {
         this._source = previous;
      }
   }

   /**
    * @param {string} instanceId
    * @param {string} operator
    */
   setOperator(instanceId, operator) {
      this._apply(() => {
         const instance = this._requireInstance(instanceId);
         const definition = this._requireDefinition(instance.definitionId);
         if (typeof operator !== 'string' || !definition.operators.includes(operator)) {
            fail('E_UNSUPPORTED_OPERATOR', `Operator is not allowed for ${definition.id}: ${operator}`);
         }
         if (instance.operator === operator) {
            return;
         }
         const converted = this._convertValue(definition, instance, operator);
         instance.operator = operator;
         instance.value = converted.value;
         instance.rawValue = undefined;
         instance.status = converted.status;
         instance.errors = converted.errors;
         instance.rejectedCanonical = false;
         this._record({ type: 'operatorChanged', instanceId, definitionId: instance.definitionId });
      });
   }

   /**
    * @param {string} instanceId
    * @param {number} targetIndex Index in the final visual order.
    */
   moveFilter(instanceId, targetIndex) {
      this._apply(() => {
         const index = this._filters.findIndex((item) => item.instanceId === instanceId);
         if (index < 0) {
            fail('E_UNKNOWN_INSTANCE', `Unknown filter instance: ${instanceId}`);
         }
         if (!Number.isInteger(targetIndex)) {
            fail('E_INVALID_SHAPE', 'A filter index must be an integer.');
         }
         if (targetIndex < 0 || targetIndex >= this._filters.length) {
            fail('E_INVALID_SHAPE', 'A filter index is outside the list.');
         }
         if (index === targetIndex) {
            return;
         }
         const instance = this._filters[index];
         const pinnedCount = this._filters.filter((item) => item.pinned).length;
         const groupStart = instance.pinned ? 0 : pinnedCount;
         const groupEnd = instance.pinned ? pinnedCount - 1 : this._filters.length - 1;
         const crosses = targetIndex < groupStart || targetIndex > groupEnd;
         if (crosses && !this._behavior.allowCrossGroupMove) {
            fail('E_INCOMPATIBLE_UPDATE', 'Moving a filter into the other pin group is disabled.');
         }
         this._filters.splice(index, 1);
         if (crosses) {
            const pinnedRemaining = this._filters.filter((item) => item.pinned).length;
            instance.pinned = targetIndex < pinnedRemaining;
            if (!instance.pinned) {
               instance.pinLocked = false;
            }
         }
         this._filters.splice(targetIndex, 0, instance);
         this._record({ type: 'filterMoved', instanceId, definitionId: instance.definitionId });
      });
   }

   /**
    * @param {string} instanceId
    * @param {boolean} pinned
    */
   setPinned(instanceId, pinned) {
      this._apply(() => {
         const instance = this._requireInstance(instanceId);
         if (typeof pinned !== 'boolean') {
            fail('E_INVALID_SHAPE', 'pinned must be a boolean.');
         }
         if (instance.pinned === pinned && (pinned || instance.pinLocked === false)) {
            return;
         }
         instance.pinned = pinned;
         if (!pinned) {
            instance.pinLocked = false;
         }
         this._placeByPin(instance);
         this._record({ type: 'pinChanged', instanceId, definitionId: instance.definitionId });
      });
   }

   /**
    * @param {readonly object[]} filters
    */
   setFilters(filters) {
      this._apply(() => {
         if (!Array.isArray(filters)) {
            fail('E_INVALID_SHAPE', 'setFilters expects an array.');
         }
         const next = [];
         const seen = new Set();
         for (const filter of filters) {
            const instance = this._buildFilter(filter, false, seen, next);
            next.push(instance);
         }
         this._filters = [
            ...next.filter((item) => item.pinned),
            ...next.filter((item) => !item.pinned)
         ];
         this._record({ type: 'stateReplaced', wholesale: true });
      });
   }

   reset() {
      this._apply(() => {
         const restored = this._cloneModel(this._baseline);
         this._definitions = restored.definitions;
         this._order = restored.order;
         this._runtime = restored.runtime;
         this._filters = restored.filters;
         this._record({ type: 'stateReset', wholesale: true });
      });
   }

   /**
    * @param {object} snapshot
    */
   importState(snapshot) {
      this._apply(() => {
         const next = this._readSnapshot(snapshot);
         this._definitions = next.definitions;
         this._order = next.order;
         this._runtime = next.runtime;
         this._filters = next.filters;
         this._record({ type: 'stateReplaced', wholesale: true });
      });
   }

   /**
    * Run mutations with an event source. The screen facade wraps user commands in `withSource('user', ...)`.
    * Method signatures stay unchanged.
    * @template T
    * @param {ChangeSource} source
    * @param {() => T} fn
    * @returns {T}
    */
   withSource(source, fn) {
      this._assertLive();
      if (source !== 'user' && source !== 'api' && source !== 'system') {
         fail('E_INVALID_SHAPE', 'Event source must be user, api, or system.');
      }
      if (typeof fn !== 'function') {
         fail('E_INVALID_SHAPE', 'withSource expects a function.');
      }
      const previous = this._source;
      this._source = source;
      try {
         return fn();
      } finally {
         this._source = previous;
      }
   }

   /**
    * @template T
    * @param {(tx: object) => T} fn
    * @returns {T}
    */
   transaction(fn) {
      this._assertLive();
      if (this._inTx) {
         fail('E_NESTED_TRANSACTION', 'A transaction cannot start inside a transaction.');
      }
      if (typeof fn !== 'function') {
         fail('E_INVALID_SHAPE', 'transaction expects a function.');
      }
      if (this._emitting) {
         return this._deferMutation(() => this._invokeTransaction(fn));
      }
      const committed = this._cloneModel(this._live);
      this._origin = committed;
      this._work = this._cloneModel(committed);
      this._inTx = true;
      this._ops = [];
      /** @type {T} */
      let result;
      try {
         result = this._invokeTransaction(fn);
      } catch (error) {
         this._work = this._live;
         this._origin = null;
         this._inTx = false;
         this._ops = [];
         throw error;
      }
      this._inTx = false;
      if (this._sameModel(committed, this._work)) {
         this._work = this._live;
         this._origin = null;
         this._ops = [];
         return result;
      }
      this._live = this._work;
      this._commit(this._ops);
      this._ops = [];
      this._origin = null;
      return result;
   }

   destroy() {
      if (this._destroyed) {
         return;
      }
      this._destroyed = true;
      this._stateSubject.complete();
      this._eventsSubject.complete();
   }

   /**
    * @param {() => void} mutator
    */
   _apply(mutator) {
      this._assertLive();
      if (this._inTx) {
         mutator();
         return;
      }
      if (this._emitting) {
         this._deferMutation(mutator);
         return;
      }
      const committed = this._cloneModel(this._live);
      this._origin = committed;
      this._work = this._cloneModel(committed);
      this._ops = [];
      try {
         mutator();
      } catch (error) {
         this._work = this._live;
         this._origin = null;
         this._ops = [];
         throw error;
      }
      if (this._ops.length === 0 || this._sameModel(committed, this._work)) {
         this._work = this._live;
         this._origin = null;
         this._ops = [];
         return;
      }
      this._live = this._work;
      this._commit(this._ops);
      this._ops = [];
      this._origin = null;
   }

   /**
    * @param {object[]} ops
    */
   _commit(ops) {
      const revision = this._revision + 1;
      const events = this._materialize(ops, this._projectState(this._work, revision));
      if (events.length === 0) {
         this._live = this._origin;
         this._work = this._origin;
         return;
      }
      this._revision = revision;
      const state = this.getState();
      const transactionId = `tx-${++this._txSeq}`;
      const frozenEvents = events.map((event) => freezeDeep({
         ...event,
         revision,
         transactionId,
         state
      }));
      this._emitting = true;
      try {
         this._stateSubject.next(state);
         for (const event of frozenEvents) {
            this._eventsSubject.next(event);
         }
      } finally {
         this._emitting = false;
      }
      this._drain();
   }

   _drain() {
      while (this._pending.length > 0 && !this._destroyed) {
         const job = this._pending.shift();
         job();
      }
   }

   /**
    * Run a transaction callback against the draft already opened by the caller.
    * @template T
    * @param {(tx: object) => T} fn
    * @returns {T}
    */
   _invokeTransaction(fn) {
      const tx = this._transactionFacade();
      try {
         const result = fn(tx);
         if (isThenable(result)) {
            fail('E_ASYNC_TRANSACTION', 'A transaction callback must be synchronous.');
         }
         return result;
      } finally {
         tx._close();
      }
   }

   /**
    * Apply a mutation while a notification is in progress.
    * The draft runs now, so the caller receives the real return value.
    * The commit is published only after the current notification, so revisions stay in order.
    * A nested or asynchronous transaction still fails immediately and publishes nothing.
    * @template T
    * @param {() => T} run
    * @returns {T}
    */
   _deferMutation(run) {
      const base = this._deferredTail || this._live;
      const origin = this._cloneModel(base);
      const frame = {
         work: this._work,
         origin: this._origin,
         ops: this._ops,
         inTx: this._inTx
      };
      this._origin = origin;
      this._work = this._cloneModel(origin);
      this._ops = [];
      this._inTx = true;
      /** @type {T} */
      let result;
      try {
         result = run();
      } catch (error) {
         this._work = frame.work;
         this._origin = frame.origin;
         this._ops = frame.ops;
         this._inTx = frame.inTx;
         throw error;
      }
      const model = this._work;
      const ops = this._ops.slice();
      const changed = ops.length > 0 && !this._sameModel(origin, model);
      this._work = frame.work;
      this._origin = frame.origin;
      this._ops = frame.ops;
      this._inTx = frame.inTx;
      if (!changed) {
         return result;
      }
      this._deferredTail = model;
      this._pending.push(() => {
         if (this._destroyed) {
            return;
         }
         if (this._deferredTail === model) {
            this._deferredTail = null;
         }
         this._live = model;
         this._work = model;
         this._origin = origin;
         this._commit(ops);
         this._ops = [];
         this._origin = null;
      });
      return result;
   }

   /**
    * @param {object} op
    */
   _record(op) {
      this._ops.push({ ...op, source: this._source });
   }

   /**
    * @param {object[]} ops
    * @param {object} state
    * @returns {object[]}
    */
   _materialize(ops, state) {
      const wholesale = ops.filter((op) => op.wholesale);
      const selected = wholesale.length > 0 ? [wholesale[wholesale.length - 1]] : this._coalesce(ops);
      const filters = new Map(state.filters.map((filter) => [filter.instanceId, filter]));
      const originFilters = new Map((this._origin?.filters || []).map((filter) => [filter.instanceId, this._publicInstance(filter)]));
      return selected.map((op) => {
         /** @type {Record<string, unknown>} */
         const event = { type: op.type };
         event.source = op.source || this._source;
         if (op.instanceId) {
            event.instanceId = op.instanceId;
            event.previous = op.type === 'filterAdded' ? null : (originFilters.get(op.instanceId) || null);
            event.current = op.type === 'filterRemoved' ? null : (filters.get(op.instanceId) || null);
         }
         if (op.definitionId) {
            event.definitionId = op.definitionId;
         }
         return event;
      });
   }

   /**
    * @param {object[]} ops
    * @returns {object[]}
    */
   _coalesce(ops) {
      /** @type {object[]} */
      const emitted = [];
      /** @type {Map<string, number>} */
      const index = new Map();
      for (const op of ops) {
         const key = op.type === 'valueChanged' || op.type === 'filterCleared'
            ? `value:${op.instanceId}`
            : `${op.type}:${op.instanceId || ''}:${op.definitionId || ''}`;
         if (index.has(key)) {
            emitted[index.get(key)] = op;
         } else {
            index.set(key, emitted.length);
            emitted.push(op);
         }
      }
      const origin = this._origin?.filters || [];
      const originIds = new Set(origin.map((filter) => filter.instanceId));
      const endIds = new Set(this._filters.map((filter) => filter.instanceId));
      const originIndex = new Map(origin.map((filter, index) => [filter.instanceId, index]));
      const removedDuring = new Set(ops.filter((op) => op.type === 'filterRemoved').map((op) => op.instanceId));
      const addedDuring = new Set(ops.filter((op) => op.type === 'filterAdded').map((op) => op.instanceId));
      const recreated = new Set([...removedDuring].filter((id) => addedDuring.has(id) && originIds.has(id) && endIds.has(id)));
      return emitted.filter((op) => {
         const start = origin.find((filter) => filter.instanceId === op.instanceId);
         const end = this._filters.find((filter) => filter.instanceId === op.instanceId);
         if (op.type === 'filterAdded') {
            return endIds.has(op.instanceId) && (!originIds.has(op.instanceId) || removedDuring.has(op.instanceId));
         }
         if (op.type === 'filterRemoved') {
            if (!originIds.has(op.instanceId)) {
               return false;
            }
            return !endIds.has(op.instanceId) || recreated.has(op.instanceId);
         }
         if (recreated.has(op.instanceId)) {
            return false;
         }
         if (op.instanceId && !end) {
            return false;
         }
         if ((op.type === 'valueChanged' || op.type === 'filterCleared') && start && end) {
            return !this._sameOperand(start, end.value, end.status)
               || JSON.stringify(start.rawValue ?? null) !== JSON.stringify(end.rawValue ?? null)
               || !this._sameErrors(start.errors, end.errors);
         }
         if (op.type === 'operatorChanged' && start && end) {
            return start.operator !== end.operator;
         }
         if (op.type === 'pinChanged' && start && end) {
            return start.pinned !== end.pinned || start.pinLocked !== end.pinLocked;
         }
         if (op.type === 'filterMoved' && start && end) {
            return originIndex.get(op.instanceId) !== this._filters.indexOf(end) || start.pinned !== end.pinned;
         }
         if (op.type === 'validationChanged' && start && end) {
            return start.touched !== end.touched || start.status !== end.status || !this._sameErrors(start.errors, end.errors);
         }
         if (op.type === 'catalogChanged') {
            const before = this._origin?.definitions?.get(op.definitionId);
            const after = this._definitions.get(op.definitionId);
            if (!before || !after) {
               return true;
            }
            return !this._sameDefinition(before, after);
         }
         return true;
      });
   }

   /**
    * @returns {object}
    */
   _model() {
      return this._work;
   }

   /**
    * @param {object} model
    */
   _swap(model) {
      this._work = model;
   }

   /**
    * @param {object} [model]
    */
   _cloneModel(model = this._model()) {
      /** @type {Map<string, any>} */
      const definitions = new Map();
      for (const [id, definition] of model.definitions) {
         definitions.set(id, this._cloneDefinition(definition));
      }
      return {
         definitions,
         order: [...model.order],
         runtime: new Set(model.runtime),
         filters: model.filters.map((instance) => this._cloneInstance(instance))
      };
   }

   /**
    * @param {object} left
    * @param {object} right
    * @returns {boolean}
    */
   _sameModel(left, right) {
      return JSON.stringify(this._projectSnapshot(left, true)) === JSON.stringify(this._projectSnapshot(right, true))
         && this._sameDefinitionList(left, right);
   }

   /**
    * @param {unknown} validation
    */
   _readValidation(validation) {
      const mode = isPlainObject(validation) && validation.mode ? validation.mode : 'touched';
      if (!VALIDATION_MODES.includes(mode)) {
         fail('E_INVALID_SHAPE', 'validation.mode must be immediate, touched, or manual.');
      }
      return { mode };
   }

   /**
    * @param {unknown} types
    */
   _readTypeDefaults(types) {
      if (types == null) {
         return {};
      }
      if (!isPlainObject(types)) {
         fail('E_INVALID_SHAPE', 'defaults.types must be an object.');
      }
      /** @type {Record<string, unknown>} */
      const out = {};
      for (const [type, value] of Object.entries(types)) {
         out[type] = {
            format: mergePlain({}, /** @type {any} */ (value)?.format),
            validation: mergePlain({}, /** @type {any} */ (value)?.validation)
         };
      }
      return out;
   }

   /**
    * @param {unknown} value
    * @param {string} label
    * @returns {number|null}
    */
   _readLimit(value, label) {
      if (value == null) {
         return null;
      }
         if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
         fail('E_INVALID_SHAPE', `${label} must be a non-negative integer or null.`);
      }
      return value;
   }

   /**
    * @param {unknown} registry
    */
   _readRegistry(registry) {
      const source = isPlainObject(registry) ? registry : {};
      /** @type {Record<string, Record<string, Function>>} */
      const out = {};
      for (const key of ['providers', 'editors', 'parsers', 'formatters', 'validators', 'comparators']) {
         const bucket = source[key] || {};
         if (!isPlainObject(bucket)) {
            fail('E_INVALID_SHAPE', `extensions.registry.${key} must be an object.`);
         }
         out[key] = {};
         for (const [id, fn] of Object.entries(bucket)) {
            if (typeof fn !== 'function') {
               fail('E_UNRESOLVED_REFERENCE', `Registry entry ${key}.${id} must be a function.`);
            }
            out[key][id] = fn;
         }
      }
      return out;
   }

   /**
    * @param {any} definition
    * @param {boolean} runtime
    */
   _insertDefinition(definition, runtime) {
      const normalized = this._normalizeDefinition(definition, runtime);
      if (this._definitions.has(normalized.id)) {
         fail('E_DUPLICATE_ID', `Definition already exists: ${normalized.id}`);
      }
      this._definitions.set(normalized.id, normalized);
      this._order.push(normalized.id);
      if (runtime) {
         this._runtime.add(normalized.id);
      }
   }

   /**
    * @param {any} input
    * @param {boolean} runtime
    */
   _normalizeDefinition(input, runtime) {
      if (!isPlainObject(input) || typeof input.id !== 'string' || input.id.trim() === '') {
         fail('E_INVALID_SHAPE', 'A definition needs a non-empty string id.');
      }
      const id = input.id;
      const type = input.valueType || input.type;
      if (typeof type !== 'string' || type === '') {
         fail('E_INVALID_SHAPE', `Definition ${id} needs a type.`);
      }
      const known = getValueType(type);
      const typeDefaults = this._typeDefaults[type] || {};
      const operators = Array.isArray(input.operators)
         ? [...input.operators]
         : (known ? [...operatorsFor(type)] : null);
      if (!operators || operators.length === 0 || operators.some((item) => typeof item !== 'string')) {
         fail('E_INVALID_SHAPE', `Definition ${id} needs a list of operators.`);
      }
      const fallback = known ? defaultOperator(type) : operators[0];
      const operator = input.defaultOperator || fallback;
      if (!operators.includes(operator)) {
         fail('E_UNSUPPORTED_OPERATOR', `Default operator is not allowed for ${id}: ${operator}`);
      }
      const executable = this._resolveExecutables(input, runtime);
      const format = mergePlain(mergePlain(this._globalFormat, typeDefaults.format), input.format);
      const validation = mergePlain(mergePlain(this._validation, typeDefaults.validation), input.validation);
      const options = this._normalizeOptions(input.options, id);
      const groupPath = Array.isArray(input.groupPath)
         ? input.groupPath.map((item) => {
            if (typeof item !== 'string' || item.trim() === '') {
               fail('E_INVALID_SHAPE', `Definition ${id} has an empty group path segment.`);
            }
            return item;
         })
         : (typeof input.group === 'string' && input.group.trim() !== ''
            ? input.group.split('/').map((item) => item.trim()).filter(Boolean)
            : []);
      return {
         id,
         label: typeof input.label === 'string' && input.label.trim() !== '' ? input.label : labelFromId(id),
         description: typeof input.description === 'string' ? input.description : '',
         type,
         valueType: type,
         editor: typeof input.editor === 'string' ? input.editor : (EDITOR_BY_TYPE[type] || 'custom'),
         operators,
         defaultOperator: operator,
         allowMultipleInstances: input.allowMultipleInstances === true,
         maxInstances: this._readLimit(input.maxInstances, `${id}.maxInstances`),
         required: input.required === true,
         pinnable: input.pinnable !== false,
         format,
         validation,
         editorOptions: mergePlain({}, input.editorOptions),
         options: options.options,
         provider: executable.provider || options.provider,
         group: groupPath.length > 0 ? groupPath.join(' / ') : '',
         groupPath,
         keywords: Array.isArray(input.keywords) ? input.keywords.filter((item) => typeof item === 'string') : [],
         visible: input.visible !== false,
         disabled: input.disabled === true,
         providerRef: executable.providerRef,
         editorRef: executable.editorRef,
         parseRef: executable.parseRef,
         formatRef: executable.formatRef,
         validateRef: executable.validateRef,
         compareRef: executable.compareRef,
         parse: executable.parse,
         formatter: executable.formatter,
         validate: executable.validate,
         compare: executable.compare,
         runtime
      };
   }

   /**
    * @param {any} input
    * @param {boolean} runtime
    */
   _resolveExecutables(input, runtime) {
      const pairs = [
         ['provider', 'providerRef', 'providers'],
         ['parse', 'parseRef', 'parsers'],
         ['validate', 'validateRef', 'validators'],
         ['compare', 'compareRef', 'comparators']
      ];
      /** @type {Record<string, any>} */
      const resolved = {};
      for (const [fnKey, refKey, bucket] of pairs) {
         const fn = input[fnKey];
         const ref = input[refKey];
         if (typeof fn === 'function' && ref != null) {
            fail('E_INVALID_SHAPE', `Definition ${input.id} cannot set both ${fnKey} and ${refKey}.`);
         }
         if (typeof fn === 'function') {
            if (runtime) {
               fail('E_UNRESOLVED_REFERENCE', `Runtime definition ${input.id} must use ${refKey} instead of an inline function.`);
            }
            resolved[fnKey] = fn;
            resolved[refKey] = null;
            continue;
         }
         if (ref == null) {
            resolved[fnKey] = null;
            resolved[refKey] = null;
            continue;
         }
         if (typeof ref !== 'string' || !this._registry[bucket][ref]) {
            fail('E_UNRESOLVED_REFERENCE', `Missing ${bucket} registry entry: ${ref}`);
         }
         resolved[fnKey] = this._registry[bucket][ref];
         resolved[refKey] = ref;
      }
      if (typeof input.format === 'function') {
         fail('E_UNRESOLVED_REFERENCE', `Definition ${input.id} must use formatRef; format is an options object.`);
      }
      if (input.formatRef != null) {
         if (typeof input.formatRef !== 'string' || !this._registry.formatters[input.formatRef]) {
            fail('E_UNRESOLVED_REFERENCE', `Missing formatters registry entry: ${input.formatRef}`);
         }
         resolved.formatter = this._registry.formatters[input.formatRef];
         resolved.formatRef = input.formatRef;
      } else {
         resolved.formatter = null;
         resolved.formatRef = null;
      }
      if (input.editorRef != null) {
         if (typeof input.editorRef !== 'string' || !this._registry.editors[input.editorRef]) {
            fail('E_UNRESOLVED_REFERENCE', `Missing editors registry entry: ${input.editorRef}`);
         }
         resolved.editorRef = input.editorRef;
      } else {
         resolved.editorRef = null;
      }
      if (typeof input.options === 'function' && input.providerRef) {
         fail('E_INVALID_SHAPE', `Definition ${input.id} cannot set both options function and providerRef.`);
      }
      if (typeof input.options === 'function' && runtime) {
         fail('E_UNRESOLVED_REFERENCE', `Runtime definition ${input.id} must use providerRef instead of an inline provider.`);
      }
      return resolved;
   }

   /**
    * @param {unknown} options
    * @param {string} id
    */
   _normalizeOptions(options, id) {
      if (typeof options === 'function') {
         return { provider: options, options: null };
      }
      if (options == null) {
         return { provider: null, options: null };
      }
      if (!Array.isArray(options)) {
         fail('E_INVALID_SHAPE', `Definition ${id} options must be an array or a provider function.`);
      }
      return {
         provider: null,
         options: options.map((item) => {
            if (typeof item === 'string' || typeof item === 'boolean') {
               return { value: item, label: typeof item === 'boolean' ? (item ? 'Yes' : 'No') : item };
            }
            if (isPlainObject(item) && (typeof item.value === 'string' || typeof item.value === 'boolean')) {
               if (item.label != null && typeof item.label !== 'string') {
                  fail('E_INVALID_SHAPE', `Definition ${id} has an option label that is not a string.`);
               }
               return { value: item.value, label: item.label || String(item.value) };
            }
            fail('E_INVALID_SHAPE', `Definition ${id} has an option that is not a string or boolean.`);
         })
      };
   }

   /**
    * @param {any} current
    * @param {any} next
    */
   _assertDefinitionCompatible(current, next) {
      const instances = this._filters.filter((item) => item.definitionId === current.id);
      if (instances.length === 0) {
         return;
      }
      if (next.type !== current.type) {
         fail('E_INCOMPATIBLE_UPDATE', `Definition ${current.id} cannot change type while instances exist.`);
      }
      if (!next.allowMultipleInstances && instances.length > 1) {
         fail('E_INCOMPATIBLE_UPDATE', `Definition ${current.id} still has several instances.`);
      }
      if (next.maxInstances != null && instances.length > next.maxInstances) {
         fail('E_LIMIT_REACHED', `Definition ${current.id} has more instances than the new maximum.`);
      }
      for (const instance of instances) {
         if (!next.operators.includes(instance.operator)) {
            fail('E_INCOMPATIBLE_UPDATE', `Definition ${current.id} would drop operator ${instance.operator}.`);
         }
      }
   }

   /**
    * @param {object} input
    * @param {boolean} initial
    * @returns {string}
    */
   _insertFilter(input, initial) {
      const instance = this._buildFilter(input, initial, new Set(this._filters.map((item) => item.instanceId)), this._filters);
      this._filters.push(instance);
      this._placeByPin(instance);
      return instance.instanceId;
   }

   /**
    * @param {any} input
    * @param {boolean} initial
    * @param {Set<string>} seen
    * @param {any[]} existing
    */
   _buildFilter(input, initial, seen, existing) {
      if (!isPlainObject(input) || typeof input.definitionId !== 'string') {
         fail('E_INVALID_SHAPE', 'A filter needs a definitionId.');
      }
      const definition = this._definitions.get(input.definitionId);
      if (!definition) {
         fail('E_UNKNOWN_DEFINITION', `Unknown definition: ${input.definitionId}`);
      }
      const siblings = existing.filter((item) => item.definitionId === definition.id);
      if (!definition.allowMultipleInstances && siblings.length >= 1) {
         fail('E_DUPLICATION_FORBIDDEN', `Definition ${definition.id} does not allow another instance.`);
      }
      if (definition.maxInstances != null && siblings.length >= definition.maxInstances) {
         fail('E_LIMIT_REACHED', `Definition ${definition.id} has reached maxInstances.`);
      }
      if (this._behavior.maxFilters != null && existing.length >= this._behavior.maxFilters) {
         fail('E_LIMIT_REACHED', 'The filter list has reached maxFilters.');
      }
      let instanceId = input.instanceId;
      if (instanceId == null) {
         do {
            this._idCounter += 1;
            instanceId = `${definition.id}-${this._idCounter}`;
         } while (seen.has(instanceId));
      }
      if (typeof instanceId !== 'string' || instanceId.trim() === '') {
         fail('E_INVALID_SHAPE', 'instanceId must be a non-empty string.');
      }
      if (seen.has(instanceId)) {
         fail('E_DUPLICATE_ID', `Filter instance already exists: ${instanceId}`);
      }
      seen.add(instanceId);
      const operator = input.operator || definition.defaultOperator;
      if (!definition.operators.includes(operator)) {
         fail('E_UNSUPPORTED_OPERATOR', `Operator is not allowed for ${definition.id}: ${operator}`);
      }
      const cardinality = operatorCardinality(operator);
      const parsed = input.value === undefined
         ? { value: this._emptyValue(cardinality), rawValue: undefined, status: /** @type {InputStatus} */ ('empty'), errors: [] }
         : this._acceptCanonical(definition, operator, input.value);
      let status = parsed.status;
      let value = parsed.value;
      let errors = parsed.errors;
      const requested = STATUSES.includes(input.status) ? input.status : null;
      if ((requested === 'pending' || requested === 'invalid') && parsed.status !== 'valid') {
         status = requested;
         value = null;
         if (parsed.errors.length > 0) {
            errors = parsed.errors;
         } else if (requested === 'invalid') {
            errors = Array.isArray(input.errors) && input.errors.length > 0
               ? copyErrors(input.errors, instanceId)
               : [{ code: 'E_INVALID_SHAPE', message: 'Invalid value.' }];
         } else {
            errors = Array.isArray(input.errors) ? copyErrors(input.errors, instanceId) : [];
         }
      }
      /** @type {any} */
      const instance = {
         instanceId,
         definitionId: definition.id,
         operator,
         value,
         rawValue: input.rawValue === undefined ? parsed.rawValue : input.rawValue,
         status,
         touched: input.touched === true,
         pinned: input.pinned === true,
         pinLocked: typeof input.pinLocked === 'boolean' ? input.pinLocked : input.pinned === true,
         pinnable: definition.pinnable,
         removable: input.removable === undefined ? true : input.removable === true,
         selectedLabel: typeof input.selectedLabel === 'string' ? input.selectedLabel : undefined,
         errors
      };
      if (instance.status === 'empty') {
         instance.value = this._emptyValue(cardinality);
         this._applyRequired(instance, definition);
      }
      if (operatorCardinality(operator) === 'none') {
         instance.value = null;
         instance.status = 'valid';
         instance.errors = [];
         instance.rawValue = undefined;
      }
      if (instance.status === 'valid') {
         instance.selectedLabel = this._labelFor(definition, instance.value, instance.selectedLabel);
      }
      return instance;
   }

   /**
    * @param {any} definition
    * @param {string} operator
    * @param {unknown} value
    */
   _acceptCanonical(definition, operator, value) {
      const cardinality = operatorCardinality(operator);
      this._assertShape(definition, cardinality, value);
      if (cardinality === 'none') {
         return { value: null, rawValue: undefined, status: /** @type {InputStatus} */ ('valid'), errors: [] };
      }
      const parsed = this._parse(definition, value, cardinality);
      if (parsed.status === 'empty') {
         const instance = {
            value: this._emptyValue(cardinality),
            rawValue: undefined,
            status: /** @type {InputStatus} */ ('empty'),
            errors: /** @type {object[]} */ ([])
         };
         this._applyRequired(instance, definition);
         return instance;
      }
      if (parsed.status !== 'valid') {
         return {
            value: null,
            rawValue: isJsonValue(value) ? cloneJson(value) : undefined,
            status: /** @type {InputStatus} */ ('invalid'),
            errors: copyErrors(parsed.errors, undefined)
         };
      }
      let stored = parsed.value;
      /** @type {object[]} */
      let errors = [];
      let status = /** @type {InputStatus} */ ('valid');
      if (operator === 'outside' && isPlainObject(stored) && (stored.min == null || stored.max == null)) {
         status = 'invalid';
         errors = [{ code: 'E_RANGE_BOUNDS', message: 'outside requires both bounds.' }];
         return { value: null, rawValue: cloneJson(stored), status, errors };
      }
      const custom = definition.validate ? definition.validate(stored, { definitionId: definition.id, operator }) : null;
      if (Array.isArray(custom) && custom.length > 0) {
         return { value: null, rawValue: cloneJson(stored), status: 'invalid', errors: copyErrors(custom, undefined) };
      }
      return { value: stored, rawValue: undefined, status, errors };
   }

   /**
    * @param {any} definition
    * @param {string} operator
    * @param {any} change
    */
   _acceptEditorChange(definition, operator, change) {
      const touched = change.touched !== false;
      const cardinality = operatorCardinality(operator);
      if (change.status === 'valid') {
         const accepted = this._acceptCanonical(definition, operator, change.value);
         return { ...accepted, touched, rawValue: change.rawValue === undefined ? accepted.rawValue : change.rawValue };
      }
      if (change.status === 'empty') {
         const instance = {
            value: this._emptyValue(cardinality),
            rawValue: change.rawValue,
            status: /** @type {InputStatus} */ ('empty'),
            errors: /** @type {object[]} */ ([]),
            touched
         };
         this._applyRequired(instance, definition);
         return instance;
      }
      const errors = Array.isArray(change.errors) && change.errors.length > 0
         ? copyErrors(change.errors, undefined)
         : [{ code: 'E_INVALID_SHAPE', message: change.status === 'pending' ? 'Incomplete value.' : 'Invalid value.' }];
      return {
         value: null,
         rawValue: change.rawValue,
         status: change.status,
         errors: change.status === 'pending' ? copyErrors(change.errors || [], undefined) : errors,
         touched
      };
   }

   /**
    * @param {any} definition
    * @param {Cardinality} cardinality
    * @param {unknown} value
    */
   _assertShape(definition, cardinality, value) {
      if (cardinality === 'none') {
         if (value != null) {
            fail('E_INVALID_SHAPE', 'This operator does not take a value.');
         }
         return;
      }
      if (cardinality === 'list') {
         if (value == null) {
            return;
         }
         if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' && typeof item !== 'boolean' && item != null)) {
            fail('E_INVALID_SHAPE', 'A list value must be an array of strings or booleans.');
         }
         return;
      }
      if (cardinality === 'range') {
         if (value == null) {
            return;
         }
         if (!isPlainObject(value) || Object.keys(value).some((key) => key !== 'min' && key !== 'max') || !isScalar(value.min) || !isScalar(value.max)) {
            fail('E_INVALID_SHAPE', 'A range value must be { min, max } with scalar bounds.');
         }
         return;
      }
      if (definition.type === 'relativeDate') {
         if (value != null && !isPlainObject(value)) {
            fail('E_INVALID_SHAPE', 'A relative date must be an object.');
         }
         return;
      }
      if (definition.type === 'boolean') {
         if (value != null && typeof value !== 'boolean') {
            fail('E_INVALID_SHAPE', 'A boolean canonical value must be true or false.');
         }
         return;
      }
      if (value != null && typeof value !== 'string') {
         fail('E_INVALID_SHAPE', 'A scalar canonical value must be a string.');
      }
   }

   /**
    * @param {any} definition
    * @param {unknown} value
    * @param {Cardinality} cardinality
    */
   _parse(definition, value, cardinality) {
      if (value == null || (cardinality === 'list' && Array.isArray(value) && value.length === 0)) {
         return { status: 'empty', value: null, errors: [] };
      }
      if (definition.parse) {
         return definition.parse(value, { ...definition.format, source: 'canonical' });
      }
      if (cardinality === 'list' && Array.isArray(value) && this._typeParsesList(definition.type)) {
         return parseValue(definition.type, value, { ...definition.format, source: 'canonical' });
      }
      if (cardinality === 'list' && Array.isArray(value)) {
         /** @type {unknown[]} */
         const items = [];
         /** @type {object[]} */
         const errors = [];
         for (const item of value) {
            const parsed = parseValue(definition.type, item, { ...definition.format, source: 'canonical' });
            if (parsed.status !== 'valid') {
               errors.push(...parsed.errors);
            } else {
               items.push(parsed.value);
            }
         }
         if (errors.length > 0) {
            return { status: 'invalid', value: null, errors };
         }
         return { status: 'valid', value: items, errors: [] };
      }
      const type = definition.type === 'range' ? (definition.format.valueType || 'decimal') : definition.type;
      const parsedType = cardinality === 'range' && definition.type !== 'range' ? definition.type : type;
      if (cardinality === 'range' && definition.type !== 'range') {
         return parseValue('range', value, { ...definition.format, valueType: parsedType, source: 'canonical' });
      }
      return parseValue(definition.type, value, { ...definition.format, source: 'canonical' });
   }

   /**
    * List-native types parse one complete array. Scalar types used with in/notIn do not.
    * @param {string} type
    * @returns {boolean}
    */
   _typeParsesList(type) {
      const operator = defaultOperator(type);
      return typeof operator === 'string' && operatorCardinality(operator) === 'list';
   }

   /**
    * @param {Cardinality} cardinality
    * @returns {unknown}
    */
   _emptyValue(cardinality) {
      if (cardinality === 'list') {
         return [];
      }
      if (cardinality === 'range') {
         return { min: null, max: null };
      }
      return null;
   }

   /**
    * @param {any} instance
    * @param {any} definition
    */
   _applyRequired(instance, definition) {
      if (!definition.required || operatorCardinality(instance.operator) === 'none') {
         return;
      }
      if (instance.status === 'empty') {
         instance.errors = [{ code: 'E_REQUIRED', message: 'This field is required.', instanceId: instance.instanceId }];
      }
   }

   /**
    * @param {any} definition
    * @param {any} instance
    * @param {string} operator
    */
   _convertValue(definition, instance, operator) {
      const from = operatorCardinality(instance.operator);
      const to = operatorCardinality(operator);
      if (to === 'none') {
         return { value: null, status: /** @type {InputStatus} */ ('valid'), errors: [] };
      }
      if (instance.status !== 'valid') {
         const empty = this._acceptCanonical(definition, operator, this._emptyValue(to));
         return empty;
      }
      if (from === to) {
         return this._acceptCanonical(definition, operator, instance.value);
      }
      if (to === 'list' && from === 'single' && (typeof instance.value === 'string' || typeof instance.value === 'boolean')) {
         return this._acceptCanonical(definition, operator, [instance.value]);
      }
      if (to === 'single' && from === 'list' && Array.isArray(instance.value) && instance.value.length === 1) {
         return this._acceptCanonical(definition, operator, instance.value[0]);
      }
      if (to === 'single' && from === 'range' && isPlainObject(instance.value)) {
         const present = [instance.value.min, instance.value.max].filter((item) => item != null);
         if (present.length === 1) {
            return this._acceptCanonical(definition, operator, present[0]);
         }
      }
      return this._acceptCanonical(definition, operator, this._emptyValue(to));
   }

   /**
    * @param {any} instance
    * @param {any} definition
    */
   _revalidate(instance, definition) {
      if (operatorCardinality(instance.operator) === 'none') {
         instance.value = null;
         instance.status = 'valid';
         instance.errors = [];
         instance.rejectedCanonical = false;
         return;
      }
      const recovering = instance.status === 'invalid' && instance.rejectedCanonical === true;
      if (instance.status === 'pending' || (instance.status === 'invalid' && !recovering)) {
         return;
      }
      const candidate = recovering
         ? (instance.rawValue !== undefined ? instance.rawValue : instance.value)
         : instance.value;
      if (recovering && candidate === undefined) {
         return;
      }
      let next;
      try {
         next = this._acceptCanonical(definition, instance.operator, candidate);
      } catch (error) {
         if (error instanceof Core_FilterError && error.code === 'E_INVALID_SHAPE') {
            return;
         }
         throw error;
      }
      if (recovering && (next.status !== 'valid' || JSON.stringify(next.value ?? null) !== JSON.stringify(candidate ?? null))) {
         return;
      }
      const wasValid = instance.status === 'valid';
      instance.value = next.value;
      instance.status = next.status;
      instance.errors = next.errors;
      if (wasValid && next.status === 'invalid') {
         instance.rejectedCanonical = true;
         if (next.rawValue !== undefined) {
            instance.rawValue = next.rawValue;
         }
         return;
      }
      instance.rejectedCanonical = false;
      if (recovering && next.status === 'valid') {
         instance.rawValue = undefined;
      } else if (next.rawValue !== undefined) {
         instance.rawValue = next.rawValue;
      }
   }

   /**
    * @param {any} instance
    */
   _placeByPin(instance) {
      const index = this._filters.indexOf(instance);
      if (index < 0) {
         return;
      }
      this._filters.splice(index, 1);
      if (instance.pinned) {
         const pinnedCount = this._filters.filter((item) => item.pinned).length;
         this._filters.splice(pinnedCount, 0, instance);
         return;
      }
      this._filters.push(instance);
   }

   /**
    * @param {string} id
    */
   _requireDefinition(id) {
      const definition = this._definitions.get(id);
      if (!definition) {
         fail('E_UNKNOWN_DEFINITION', `Unknown definition: ${id}`);
      }
      return definition;
   }

   /**
    * @param {string} instanceId
    */
   _requireInstance(instanceId) {
      const instance = this._filters.find((item) => item.instanceId === instanceId);
      if (!instance) {
         fail('E_UNKNOWN_INSTANCE', `Unknown filter instance: ${instanceId}`);
      }
      return instance;
   }

   /**
    * @param {any} definition
    * @param {unknown} value
    * @param {unknown} current
    * @returns {string|undefined}
    */
   _labelFor(definition, value, current) {
      if (typeof value !== 'string' && typeof value !== 'boolean') {
         return typeof current === 'string' ? current : undefined;
      }
      const match = (definition.options || []).find((option) => option.value === value);
      if (match) {
         return match.label;
      }
      return typeof current === 'string' ? current : undefined;
   }

   /**
    * @param {any} instance
    * @param {unknown} value
    * @param {string} status
    */
   _sameOperand(instance, value, status) {
      return instance.status === status && JSON.stringify(instance.value ?? null) === JSON.stringify(value ?? null);
   }

   /**
    * @param {object[]} left
    * @param {object[]} right
    */
   _sameErrors(left, right) {
      return JSON.stringify(left) === JSON.stringify(right);
   }

   /**
    * @param {any} definition
    */
   _definitionInput(definition) {
      return {
         id: definition.id,
         label: definition.label,
         description: definition.description,
         type: definition.type,
         editor: definition.editor,
         operators: [...definition.operators],
         defaultOperator: definition.defaultOperator,
         allowMultipleInstances: definition.allowMultipleInstances,
         maxInstances: definition.maxInstances,
         required: definition.required,
         pinnable: definition.pinnable,
         format: definition.format,
         validation: definition.validation,
         editorOptions: definition.editorOptions,
         options: definition.provider && !definition.providerRef ? definition.provider : definition.options,
         groupPath: [...definition.groupPath],
         keywords: [...definition.keywords],
         visible: definition.visible,
         disabled: definition.disabled,
         providerRef: definition.providerRef,
         editorRef: definition.editorRef,
         parseRef: definition.parseRef,
         formatRef: definition.formatRef,
         validateRef: definition.validateRef,
         compareRef: definition.compareRef,
         parse: definition.parseRef ? undefined : definition.parse,
         validate: definition.validateRef ? undefined : definition.validate,
         compare: definition.compareRef ? undefined : definition.compare
      };
   }

   /**
    * @param {any} definition
    * @returns {string}
    */
   _definitionJson(definition) {
      return JSON.stringify(this._serializeDefinition(definition));
   }

   /**
    * Snapshot JSON omits callbacks. Identity still counts as a catalog change.
    * @param {any} left
    * @param {any} right
    * @returns {boolean}
    */
   _sameDefinition(left, right) {
      return this._definitionJson(left) === this._definitionJson(right) && this._sameExecutables(left, right);
   }

   /**
    * @param {object} left
    * @param {object} right
    * @returns {boolean}
    */
   _sameDefinitionList(left, right) {
      const leftIds = left.order || [];
      const rightIds = right.order || [];
      if (leftIds.length !== rightIds.length) {
         return false;
      }
      for (let index = 0; index < leftIds.length; index += 1) {
         if (leftIds[index] !== rightIds[index]) {
            return false;
         }
         const before = left.definitions.get(leftIds[index]);
         const after = right.definitions.get(rightIds[index]);
         if (!this._sameExecutables(before, after)) {
            return false;
         }
      }
      return true;
   }

   /**
    * @param {any} left
    * @param {any} right
    * @returns {boolean}
    */
   _sameExecutables(left, right) {
      if (!left || !right) {
         return false;
      }
      return left.provider === right.provider
         && left.parse === right.parse
         && left.formatter === right.formatter
         && left.validate === right.validate
         && left.compare === right.compare;
   }

   /**
    * @param {any} definition
    */
   _serializeDefinition(definition) {
      /** @type {Record<string, unknown>} */
      const out = {};
      for (const key of DEFINITION_KEYS) {
         if (key === 'options') {
            if (definition.options) {
               out.options = cloneJson(definition.options);
            }
            continue;
         }
         const value = definition[key];
         if (value == null || value === '' || (Array.isArray(value) && value.length === 0 && key === 'keywords')) {
            continue;
         }
         out[key] = typeof value === 'function' ? undefined : cloneJson(value);
      }
      return out;
   }

   /**
    * @param {any} definition
    */
   _publicDefinition(definition) {
      const copy = this._serializeDefinition(definition);
      copy.options = definition.provider && !definition.options ? undefined : copy.options;
      if (definition.provider) {
         copy.provider = definition.provider;
      }
      if (definition.parse) {
         copy.parse = definition.parse;
      }
      if (definition.formatter) {
         copy.formatValue = definition.formatter;
      }
      if (definition.validate) {
         copy.validate = definition.validate;
      }
      if (definition.compare) {
         copy.compare = definition.compare;
      }
      return freezeDeep(copy);
   }

   /**
    * @param {any} instance
    */
   _publicInstance(instance) {
      /** @type {Record<string, unknown>} */
      const out = {
         instanceId: instance.instanceId,
         definitionId: instance.definitionId,
         operator: instance.operator,
         value: cloneJson(instance.value),
         status: instance.status,
         touched: instance.touched === true,
         pinned: instance.pinned === true,
         pinLocked: instance.pinLocked === true,
         removable: instance.removable !== false,
         errors: Object.freeze(copyErrors(instance.errors, instance.instanceId).map((error) => Object.freeze(error)))
      };
      if (instance.rawValue !== undefined) {
         out.rawValue = typeof instance.rawValue === 'function' ? instance.rawValue : cloneJson(instance.rawValue);
      }
      if (typeof instance.selectedLabel === 'string') {
         out.selectedLabel = instance.selectedLabel;
      }
      return freezeDeep(out);
   }

   /**
    * @param {object} model
    * @param {number} revision
    */
   _projectState(model, revision) {
      const filters = Object.freeze(model.filters.map((instance) => this._publicInstance(instance)));
      const errors = [];
      for (const filter of filters) {
         errors.push(...filter.errors);
      }
      const valid = filters.every((filter) => filter.status === 'valid' || (filter.status === 'empty' && filter.errors.length === 0));
      return freezeDeep({
         filters,
         valid,
         errors: Object.freeze(errors),
         revision
      });
   }

   /**
    * @param {object} model
    */
   _projectCriteria(model) {
      /** @type {object[]} */
      const errors = [];
      /** @type {object[]} */
      const criteria = [];
      let blocked = false;
      for (const instance of model.filters) {
         errors.push(...copyErrors(instance.errors, instance.instanceId));
         if (instance.status === 'pending' || instance.status === 'invalid') {
            blocked = true;
            continue;
         }
         if (instance.status === 'empty') {
            if (instance.errors.length > 0) {
               blocked = true;
            }
            continue;
         }
         criteria.push(Object.freeze({
            instanceId: instance.instanceId,
            definitionId: instance.definitionId,
            operator: instance.operator,
            value: cloneJson(instance.value)
         }));
      }
      return freezeDeep({
         valid: !blocked,
         combinator: 'AND',
         criteria: blocked ? null : Object.freeze(criteria),
         errors: Object.freeze(errors.map((error) => Object.freeze(error)))
      });
   }

   /**
    * @param {object} model
    * @param {boolean} [includeInitial]
    */
   _projectSnapshot(model, includeInitial = false) {
      const definitions = model.order
         .filter((id) => includeInitial || model.runtime.has(id))
         .map((id) => this._serializeDefinition(model.definitions.get(id)));
      const filters = model.filters.map((instance) => {
         /** @type {Record<string, unknown>} */
         const out = {
            instanceId: instance.instanceId,
            definitionId: instance.definitionId,
            operator: instance.operator,
            value: cloneJson(instance.value),
            pinned: instance.pinned === true,
            pinLocked: instance.pinLocked === true,
            removable: instance.removable !== false,
            touched: instance.touched === true,
            status: instance.status
         };
         if (typeof instance.selectedLabel === 'string') {
            out.selectedLabel = instance.selectedLabel;
         }
         if (instance.rawValue !== undefined && isJsonValue(instance.rawValue)) {
            out.rawValue = cloneJson(instance.rawValue);
         }
         return out;
      });
      return freezeDeep({
         schemaVersion: 1,
         definitions,
         filters
      });
   }

   /**
    * @param {object} snapshot
    */
   _readSnapshot(snapshot) {
      if (!isPlainObject(snapshot)) {
         fail('E_INVALID_SHAPE', 'A snapshot must be an object.');
      }
      if (snapshot.schemaVersion !== 1) {
         fail('E_SCHEMA_VERSION', 'Only snapshot schemaVersion 1 is accepted.');
      }
      const allowedTop = new Set(['schemaVersion', 'definitions', 'filters']);
      for (const key of Object.keys(snapshot)) {
         if (!allowedTop.has(key)) {
            fail('E_INVALID_SHAPE', `Unknown snapshot field: ${key}`);
         }
      }
      if (!Array.isArray(snapshot.definitions) || !Array.isArray(snapshot.filters)) {
         fail('E_INVALID_SHAPE', 'A snapshot needs definitions and filters arrays.');
      }
      const model = this._cloneModel(this._baseline);
      model.runtime.clear();
      model.order = model.order.filter((id) => model.definitions.has(id) && !this._baseline.runtime.has(id) ? false : model.definitions.has(id));
      model.order = [...this._baseline.order];
      model.definitions = new Map();
      for (const id of this._baseline.order) {
         if (!this._baseline.runtime.has(id)) {
            model.definitions.set(id, this._cloneDefinition(this._baseline.definitions.get(id)));
         }
      }
      model.order = [...model.definitions.keys()];
      model.filters = [];
      const savedCounter = this._idCounter;
      const previous = this._model();
      try {
         this._swap(model);
         for (const definition of snapshot.definitions) {
            this._assertExactKeys(definition, new Set(['id', ...DEFINITION_KEYS]), 'snapshot definition');
            this._insertDefinition(definition, true);
         }
         const seen = new Set();
         for (const filter of snapshot.filters) {
            this._assertExactKeys(filter, new Set(FILTER_KEYS), 'snapshot filter');
            model.filters.push(this._buildFilter(filter, false, seen, model.filters));
         }
         model.filters = [
            ...model.filters.filter((item) => item.pinned),
            ...model.filters.filter((item) => !item.pinned)
         ];
         this._swap(previous);
         this._idCounter = savedCounter;
      } catch (error) {
         this._swap(previous);
         this._idCounter = savedCounter;
         throw error;
      }
      return model;
   }

   /**
    * @param {unknown} value
    * @param {Set<string>} allowed
    * @param {string} label
    */
   _assertExactKeys(value, allowed, label) {
      if (!isPlainObject(value)) {
         fail('E_INVALID_SHAPE', `A ${label} must be an object.`);
      }
      for (const key of Object.keys(value)) {
         if (!allowed.has(key)) {
            fail('E_INVALID_SHAPE', `Unknown ${label} field: ${key}`);
         }
      }
   }

   /**
    * @param {any} definition
    */
   _cloneDefinition(definition) {
      return {
         ...definition,
         operators: [...definition.operators],
         format: cloneJson(definition.format),
         validation: cloneJson(definition.validation),
         editorOptions: cloneJson(definition.editorOptions),
         options: cloneJson(definition.options),
         groupPath: [...definition.groupPath],
         keywords: [...definition.keywords]
      };
   }

   /**
    * @param {any} instance
    */
   _cloneInstance(instance) {
      return {
         ...instance,
         value: cloneJson(instance.value),
         rawValue: instance.rawValue === undefined || !isJsonValue(instance.rawValue) ? instance.rawValue : cloneJson(instance.rawValue),
         errors: copyErrors(instance.errors, instance.instanceId)
      };
   }

   _transactionFacade() {
      const engine = this;
      return {
         _closed: false,
         _close() {
            this._closed = true;
         },
         _guard() {
            if (this._closed) {
               fail('E_INCOMPATIBLE_UPDATE', 'This transaction is closed.');
            }
         },
         addDefinition(definition) {
            this._guard();
            return engine.addDefinition(definition);
         },
         updateDefinition(id, patch) {
            this._guard();
            return engine.updateDefinition(id, patch);
         },
         removeDefinition(id, options) {
            this._guard();
            return engine.removeDefinition(id, options);
         },
         addFilter(definitionId, options) {
            this._guard();
            return engine.addFilter(definitionId, options);
         },
         removeFilter(instanceId) {
            this._guard();
            return engine.removeFilter(instanceId);
         },
         clearFilter(instanceId) {
            this._guard();
            return engine.clearFilter(instanceId);
         },
         setValue(instanceId, value) {
            this._guard();
            return engine.setValue(instanceId, value);
         },
         setOperator(instanceId, operator) {
            this._guard();
            return engine.setOperator(instanceId, operator);
         },
         moveFilter(instanceId, targetIndex) {
            this._guard();
            return engine.moveFilter(instanceId, targetIndex);
         },
         setPinned(instanceId, pinned) {
            this._guard();
            return engine.setPinned(instanceId, pinned);
         },
         setFilters(filters) {
            this._guard();
            return engine.setFilters(filters);
         },
         reset() {
            this._guard();
            return engine.reset();
         },
         importState(snapshot) {
            this._guard();
            return engine.importState(snapshot);
         },
         getState() {
            this._guard();
            return engine._projectState(engine._model(), engine._revision);
         },
         getCriteria() {
            this._guard();
            return engine._projectCriteria(engine._model());
         }
      };
   }

   _assertLive() {
      if (this._destroyed) {
         fail('E_DESTROYED', 'This filter engine has been destroyed.');
      }
   }
}
