/**
 * Value types, operators, and comparators shared by formatted fields.
 * This module is DOM-free. It is not a filter engine.
 */
import { compareDecimal, formatDecimal, parseDecimal, parseInteger } from './core-decimal.js';
import {
   compareDate,
   compareDateTime,
   compareTime,
   formatDate,
   formatDateTime,
   formatTime,
   parseDate,
   parseDateTime,
   parseTime
} from './core-date-time.js';
import { compareRelativeDate, formatRelativeDate, parseRelativeDate } from './core-relative-date.js';
import { valueEmpty, valueInvalid, valueValid } from './core-value-result.js';

/** @typedef {import('./core-value-result.js').ValueParseResult} ValueParseResult */

/**
 * @typedef {{
 *   name: string,
 *   operators: readonly string[],
 *   defaultOperator: string,
 *   parse: (raw: unknown, options?: object) => ValueParseResult,
 *   format: (value: unknown, options?: object) => string,
 *   compare: (left: any, right: any, options?: object) => -1|0|1|null
 * }} ValueTypeDefinition
 */

const STRING_OPS = ['eq', 'neq', 'contains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
const EMAIL_OPS = ['eq', 'neq', 'contains', 'isEmpty', 'isNotEmpty'];
const NUMBER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'outside', 'isEmpty', 'isNotEmpty'];
const TEMPORAL_OPS = ['eq', 'neq', 'before', 'after', 'gt', 'gte', 'lt', 'lte', 'between', 'outside', 'isEmpty', 'isNotEmpty'];
const BOOL_OPS = ['eq', 'neq', 'isEmpty', 'isNotEmpty'];
const SELECT_OPS = ['eq', 'neq', 'in', 'notIn', 'isEmpty', 'isNotEmpty'];
const LIST_OPS = ['in', 'notIn', 'containsAny', 'containsAll', 'isEmpty', 'isNotEmpty'];
const RELATIVE_OPS = ['eq', 'neq', 'isEmpty', 'isNotEmpty'];
const RANGE_OPS = ['between', 'outside', 'isEmpty', 'isNotEmpty'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Practical email check, not a full RFC parser.
 * @param {unknown} raw
 * @returns {ValueParseResult}
 */
function parseEmail(raw) {
   if (raw == null || raw === '') {
      return valueEmpty();
   }
   if (typeof raw !== 'string' || !EMAIL_PATTERN.test(raw)) {
      return valueInvalid('E_INVALID_SHAPE', 'Enter a valid email address.');
   }
   return valueValid(raw);
}

/**
 * @param {unknown} raw
 * @returns {ValueParseResult}
 */
function parseString(raw) {
   if (raw == null || raw === '') {
      return valueEmpty();
   }
   if (typeof raw !== 'string') {
      return valueInvalid('E_INVALID_SHAPE', 'Expected a string.');
   }
   return valueValid(raw);
}

/**
 * `false` is a value. "0" and "1" are not booleans.
 * @param {unknown} raw
 * @returns {ValueParseResult}
 */
function parseBoolean(raw) {
   if (raw == null || raw === '') {
      return valueEmpty();
   }
   if (typeof raw === 'boolean') {
      return valueValid(raw);
   }
   if (typeof raw !== 'string') {
      return valueInvalid('E_INVALID_SHAPE', 'Expected a boolean.');
   }
   const text = raw.trim().toLowerCase();
   if (text === 'true' || text === 'yes') {
      return valueValid(true);
   }
   if (text === 'false' || text === 'no') {
      return valueValid(false);
   }
   return valueInvalid('E_INVALID_SHAPE', 'Enter yes or no.');
}

/**
 * @param {boolean} value
 * @returns {string}
 */
function formatBoolean(value) {
   if (value === true) {
      return 'Yes';
   }
   if (value === false) {
      return 'No';
   }
   return '';
}

/**
 * @param {unknown} raw
 * @returns {ValueParseResult}
 */
function parseStringList(raw) {
   if (raw == null || raw === '') {
      return valueEmpty();
   }
   /** @type {unknown} */
   let source = raw;
   if (typeof raw === 'string') {
      try {
         source = JSON.parse(raw);
      } catch {
         return valueInvalid('E_INVALID_SHAPE', 'Expected a list of strings.');
      }
   }
   if (!Array.isArray(source)) {
      return valueInvalid('E_INVALID_SHAPE', 'Expected a list of strings.');
   }
   if (source.length === 0) {
      return valueEmpty();
   }
   if (source.some((item) => typeof item !== 'string')) {
      return valueInvalid('E_INVALID_SHAPE', 'List values must be strings.');
   }
   return valueValid(Object.freeze([...source]));
}

/**
 * @param {string} inner
 * @param {unknown} raw
 * @param {object} [options]
 * @returns {ValueParseResult}
 */
function parseBound(inner, raw, options = {}) {
   if (raw == null || raw === '') {
      return valueEmpty();
   }
   const source = /** @type {{ source?: string }} */ (options).source === 'localized' ? 'localized' : 'canonical';
   return parseValue(inner, raw, { ...options, source });
}

/**
 * @param {unknown} raw
 * @param {{ valueType?: string, boundType?: string }} [options]
 * @returns {ValueParseResult}
 */
export function parseRange(raw, options = {}) {
   if (raw == null || raw === '') {
      return valueEmpty();
   }
   /** @type {unknown} */
   let source = raw;
   if (typeof raw === 'string') {
      const text = raw.trim();
      if (text === '') {
         return valueEmpty();
      }
      try {
         source = JSON.parse(text);
      } catch {
         return valueInvalid('E_INVALID_SHAPE', 'A range must be an object with min and max.');
      }
   }
   if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return valueInvalid('E_INVALID_SHAPE', 'A range must be an object with min and max.');
   }
   const record = /** @type {Record<string, unknown>} */ (source);
   if (Object.keys(record).some((key) => key !== 'min' && key !== 'max')) {
      return valueInvalid('E_INVALID_SHAPE', 'A range only allows min and max.');
   }
   const inner = options.valueType || options.boundType || 'decimal';
   const minResult = parseBound(inner, record.min, options);
   const maxResult = parseBound(inner, record.max, options);
   const errors = [...minResult.errors, ...maxResult.errors];
   if (minResult.status === 'invalid' || maxResult.status === 'invalid') {
      return { status: 'invalid', value: null, errors };
   }
   if (minResult.status === 'pending' || maxResult.status === 'pending') {
      return { status: 'pending', value: null, errors: [] };
   }
   if (minResult.status === 'empty' && maxResult.status === 'empty') {
      return valueEmpty();
   }
   const value = {
      min: minResult.status === 'valid' ? minResult.value : null,
      max: maxResult.status === 'valid' ? maxResult.value : null
   };
   if (value.min != null && value.max != null) {
      const order = compareValues(inner, value.min, value.max, options);
      if (order != null && order > 0) {
         return valueInvalid('E_RANGE_ORDER', 'Minimum is greater than maximum.', { exact: value });
      }
   }
   return valueValid(value);
}

/**
 * @param {{ min?: unknown, max?: unknown }|null|undefined} value
 * @param {object} [options]
 * @returns {string}
 */
function formatRange(value, options = {}) {
   if (!value) {
      return '';
   }
   const inner = /** @type {{ valueType?: string }} */ (options).valueType || 'decimal';
   const min = value.min == null ? '' : formatValue(inner, value.min, options);
   const max = value.max == null ? '' : formatValue(inner, value.max, options);
   if (!min && !max) {
      return '';
   }
   return `${min} – ${max}`;
}

/** @type {Record<string, ValueTypeDefinition>} */
const TYPES = {
   string: {
      name: 'string',
      operators: STRING_OPS,
      defaultOperator: 'contains',
      parse: parseString,
      format: (value) => (value == null ? '' : String(value)),
      compare: (left, right) => {
         if (typeof left !== 'string' || typeof right !== 'string') {
            return null;
         }
         if (left === right) {
            return 0;
         }
         return left < right ? -1 : 1;
      }
   },
   email: {
      name: 'email',
      operators: EMAIL_OPS,
      defaultOperator: 'eq',
      parse: parseEmail,
      format: (value) => (value == null ? '' : String(value)),
      compare: (left, right) => (left === right ? 0 : null)
   },
   integer: {
      name: 'integer',
      operators: NUMBER_OPS,
      defaultOperator: 'eq',
      parse: (raw, options) => parseInteger(raw, options),
      format: (value, options) => formatDecimal(/** @type {string} */ (value), options),
      compare: (left, right) => compareDecimal(/** @type {string} */ (left), /** @type {string} */ (right))
   },
   decimal: {
      name: 'decimal',
      operators: NUMBER_OPS,
      defaultOperator: 'eq',
      parse: (raw, options) => parseDecimal(raw, options),
      format: (value, options) => formatDecimal(/** @type {string} */ (value), options),
      compare: (left, right) => compareDecimal(/** @type {string} */ (left), /** @type {string} */ (right))
   },
   boolean: {
      name: 'boolean',
      operators: BOOL_OPS,
      defaultOperator: 'eq',
      parse: parseBoolean,
      format: (value) => formatBoolean(/** @type {boolean} */ (value)),
      compare: (left, right) => (left === right ? 0 : null)
   },
   date: {
      name: 'date',
      operators: TEMPORAL_OPS,
      defaultOperator: 'eq',
      parse: (raw, options) => parseDate(raw, options),
      format: (value, options) => formatDate(/** @type {string} */ (value), options),
      compare: (left, right) => compareDate(String(left), String(right))
   },
   time: {
      name: 'time',
      operators: TEMPORAL_OPS,
      defaultOperator: 'eq',
      parse: (raw, options) => parseTime(raw, options),
      format: (value, options) => formatTime(/** @type {string} */ (value), options),
      compare: (left, right) => compareTime(String(left), String(right))
   },
   datetime: {
      name: 'datetime',
      operators: TEMPORAL_OPS,
      defaultOperator: 'eq',
      parse: (raw, options) => parseDateTime(raw, options),
      format: (value, options) => formatDateTime(/** @type {string} */ (value), options),
      compare: (left, right) => compareDateTime(String(left), String(right))
   },
   relativeDate: {
      name: 'relativeDate',
      operators: RELATIVE_OPS,
      defaultOperator: 'eq',
      parse: (raw) => parseRelativeDate(raw),
      format: (value) => formatRelativeDate(/** @type {{ preset: string, amount?: number }} */ (value)),
      compare: (left, right) => compareRelativeDate(left, right)
   },
   select: {
      name: 'select',
      operators: SELECT_OPS,
      defaultOperator: 'eq',
      parse: parseString,
      format: (value) => (value == null ? '' : String(value)),
      compare: (left, right) => (left === right ? 0 : null)
   },
   autocomplete: {
      name: 'autocomplete',
      operators: SELECT_OPS,
      defaultOperator: 'eq',
      parse: parseString,
      format: (value) => (value == null ? '' : String(value)),
      compare: (left, right) => (left === right ? 0 : null)
   },
   multiSelect: {
      name: 'multiSelect',
      operators: LIST_OPS,
      defaultOperator: 'containsAny',
      parse: parseStringList,
      format: (value) => (Array.isArray(value) ? value.join(', ') : ''),
      compare: () => null
   },
   tags: {
      name: 'tags',
      operators: LIST_OPS,
      defaultOperator: 'containsAny',
      parse: parseStringList,
      format: (value) => (Array.isArray(value) ? value.join(', ') : ''),
      compare: () => null
   },
   treeSelect: {
      name: 'treeSelect',
      operators: LIST_OPS,
      defaultOperator: 'containsAny',
      parse: parseStringList,
      format: (value) => (Array.isArray(value) ? value.join(', ') : ''),
      compare: () => null
   },
   range: {
      name: 'range',
      operators: RANGE_OPS,
      defaultOperator: 'between',
      parse: (raw, options) => parseRange(raw, options),
      format: (value, options) => formatRange(/** @type {{ min?: unknown, max?: unknown }} */ (value), options),
      compare: () => null
   }
};

/** @type {Map<string, ValueTypeDefinition>} */
const customTypes = new Map();

/**
 * @param {ValueTypeDefinition} definition
 */
export function registerValueType(definition) {
   if (!definition?.name || TYPES[definition.name] || customTypes.has(definition.name)) {
      const error = new Error(`Value type already registered: ${definition?.name}`);
      error.code = 'E_DUPLICATE_ID';
      throw error;
   }
   customTypes.set(definition.name, definition);
}

/**
 * @param {string} name
 */
export function unregisterValueType(name) {
   customTypes.delete(name);
}

/**
 * @param {string} type
 * @returns {ValueTypeDefinition|null}
 */
export function getValueType(type) {
   return TYPES[type] || customTypes.get(type) || null;
}

/**
 * @returns {string[]}
 */
export function listValueTypes() {
   return [...Object.keys(TYPES), ...customTypes.keys()];
}

/**
 * @param {string} type
 * @returns {readonly string[]}
 */
export function operatorsFor(type) {
   return getValueType(type)?.operators ?? [];
}

/**
 * @param {string} type
 * @returns {string|null}
 */
export function defaultOperator(type) {
   return getValueType(type)?.defaultOperator ?? null;
}

/**
 * @param {string} operator
 * @returns {'none'|'single'|'list'|'range'}
 */
export function operatorCardinality(operator) {
   if (operator === 'isEmpty' || operator === 'isNotEmpty') {
      return 'none';
   }
   if (operator === 'in' || operator === 'notIn' || operator === 'containsAny' || operator === 'containsAll') {
      return 'list';
   }
   if (operator === 'between' || operator === 'outside') {
      return 'range';
   }
   return 'single';
}

/**
 * @param {string} type
 * @param {string} operator
 * @returns {boolean}
 */
export function operatorSupports(type, operator) {
   return operatorsFor(type).includes(operator);
}

/**
 * @param {string} type
 * @param {unknown} raw
 * @param {object} [options]
 * @returns {ValueParseResult}
 */
export function parseValue(type, raw, options = {}) {
   const definition = getValueType(type);
   if (!definition) {
      return valueInvalid('E_INVALID_SHAPE', `Unknown value type: ${type}`);
   }
   return definition.parse(raw, options);
}

/**
 * @param {string} type
 * @param {unknown} value
 * @param {object} [options]
 * @returns {string}
 */
export function formatValue(type, value, options = {}) {
   const definition = getValueType(type);
   if (!definition || value == null) {
      return '';
   }
   return definition.format(value, options);
}

/**
 * @param {string} type
 * @param {unknown} left
 * @param {unknown} right
 * @param {object} [options]
 * @returns {-1|0|1|null}
 */
export function compareValues(type, left, right, options = {}) {
   const definition = getValueType(type);
   if (!definition) {
      return null;
   }
   return definition.compare(left, right, options);
}

/**
 * `0` and `false` are never empty.
 * @param {string} type
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEmptyValue(type, value) {
   if (value == null) {
      return true;
   }
   if (type === 'boolean') {
      return false;
   }
   if (value === false) {
      return false;
   }
   if (value === '0' || value === 0) {
      return false;
   }
   if (value === '') {
      return true;
   }
   if (Array.isArray(value)) {
      return value.length === 0;
   }
   if (typeof value === 'object' && value && 'min' in value && 'max' in value) {
      return value.min == null && value.max == null;
   }
   return false;
}
