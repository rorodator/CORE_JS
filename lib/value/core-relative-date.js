/**
 * Symbolic relative dates. These values are NOT resolved to absolute ranges.
 * The consumer turns a preset into calendar bounds.
 *
 * Canonical JSON:
 * - { "preset": "today" }
 * - { "preset": "this-month" }
 * - { "preset": "last-n-days", "amount": 7 }
 * - { "preset": "next-n-days", "amount": 7 }
 */
import { valueEmpty, valueInvalid, valueValid } from './core-value-result.js';

/**
 * @typedef {{ needsAmount: boolean, label: (amount?: number) => string }} RelativePreset
 */

/** @type {Record<string, RelativePreset>} */
const BUILTIN = {
   today: { needsAmount: false, label: () => 'Today' },
   'this-month': { needsAmount: false, label: () => 'This month' },
   'last-n-days': {
      needsAmount: true,
      label: (amount = 0) => (amount === 1 ? 'Last 1 day' : `Last ${amount} days`)
   },
   'next-n-days': {
      needsAmount: true,
      label: (amount = 0) => (amount === 1 ? 'Next 1 day' : `Next ${amount} days`)
   }
};

/** @type {Map<string, RelativePreset>} */
const customPresets = new Map();

/**
 * @param {string} preset
 * @param {RelativePreset} definition
 */
export function registerRelativePreset(preset, definition) {
   if (!preset || BUILTIN[preset] || customPresets.has(preset)) {
      const error = new Error(`Relative preset already registered: ${preset}`);
      error.code = 'E_DUPLICATE_ID';
      throw error;
   }
   if (!definition || typeof definition.label !== 'function') {
      const error = new Error('A relative preset needs a label function.');
      error.code = 'E_INVALID_SHAPE';
      throw error;
   }
   customPresets.set(preset, {
      needsAmount: definition.needsAmount === true,
      label: definition.label
   });
}

/**
 * @param {string} preset
 */
export function unregisterRelativePreset(preset) {
   customPresets.delete(preset);
}

/**
 * @param {string} preset
 * @returns {RelativePreset|null}
 */
function lookupPreset(preset) {
   return BUILTIN[preset] || customPresets.get(preset) || null;
}

/**
 * @param {unknown} amount
 * @returns {number|null}
 */
function readAmount(amount) {
   if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
      return null;
   }
   return amount;
}

/**
 * @param {Record<string, unknown>} source
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
function fromObject(source) {
   const keys = Object.keys(source);
   if (keys.some((key) => key !== 'preset' && key !== 'amount')) {
      return valueInvalid('E_INVALID_SHAPE', 'A relative date only allows preset and amount.');
   }
   if (typeof source.preset !== 'string' || source.preset === '') {
      return valueInvalid('E_INVALID_SHAPE', 'A relative date needs a preset code.');
   }
   const definition = lookupPreset(source.preset);
   if (!definition) {
      return valueInvalid('E_UNKNOWN_PRESET', 'Unknown relative date.', { preset: source.preset });
   }
   if (definition.needsAmount) {
      const amount = readAmount(source.amount);
      if (amount == null) {
         return valueInvalid('E_INVALID_SHAPE', 'This preset needs a strictly positive integer amount.');
      }
      return valueValid({ preset: source.preset, amount });
   }
   if (Object.prototype.hasOwnProperty.call(source, 'amount')) {
      return valueInvalid('E_INVALID_SHAPE', 'This preset does not take an amount.');
   }
   return valueValid({ preset: source.preset });
}

/**
 * @param {string} text
 * @returns {import('./core-value-result.js').ValueParseResult|null}
 */
function fromLabel(text) {
   const folded = text.trim();
   if (/^today$/i.test(folded)) {
      return valueValid({ preset: 'today' });
   }
   if (/^this month$/i.test(folded)) {
      return valueValid({ preset: 'this-month' });
   }
   const last = /^last (\d+) days?$/i.exec(folded);
   const next = /^next (\d+) days?$/i.exec(folded);
   const hit = last || next;
   if (!hit) {
      return null;
   }
   if (!/^\d+$/.test(hit[1])) {
      return valueInvalid('E_INVALID_SHAPE', 'This preset needs a strictly positive integer amount.');
   }
   const amount = readAmount(Number(hit[1]));
   if (amount == null || String(amount) !== hit[1]) {
      return valueInvalid('E_INVALID_SHAPE', 'This preset needs a strictly positive integer amount.');
   }
   return valueValid({
      preset: last ? 'last-n-days' : 'next-n-days',
      amount
   });
}

/**
 * @param {unknown} raw
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
export function parseRelativeDate(raw) {
   if (raw == null || raw === '') {
      return valueEmpty();
   }
   if (typeof raw === 'string') {
      const text = raw.trim();
      if (text === '') {
         return valueEmpty();
      }
      if (text.startsWith('{')) {
         try {
            const parsed = JSON.parse(text);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
               return valueInvalid('E_INVALID_SHAPE', 'A relative date must be an object.');
            }
            return fromObject(parsed);
         } catch {
            return valueInvalid('E_INVALID_SHAPE', 'Relative date JSON is invalid.');
         }
      }
      const labeled = fromLabel(text);
      if (labeled) {
         return labeled;
      }
      const coded = /^([a-z0-9-]+)(?::(\d+))?$/i.exec(text);
      if (!coded) {
         return valueInvalid('E_UNKNOWN_PRESET', 'Unknown relative date.');
      }
      /** @type {Record<string, unknown>} */
      const source = { preset: coded[1].toLowerCase() };
      if (coded[2] != null) {
         if (!/^[1-9]\d*$/.test(coded[2]) || !Number.isSafeInteger(Number(coded[2]))) {
            return valueInvalid('E_INVALID_SHAPE', 'This preset needs a strictly positive integer amount.');
         }
         source.amount = Number(coded[2]);
      }
      return fromObject(source);
   }
   if (typeof raw === 'object' && !Array.isArray(raw)) {
      return fromObject(/** @type {Record<string, unknown>} */ (raw));
   }
   return valueInvalid('E_INVALID_SHAPE', 'A relative date must be an object.');
}

/**
 * English display label. This is not a calendar range.
 *
 * @param {{ preset: string, amount?: number }|null|undefined} value
 * @returns {string}
 */
export function formatRelativeDate(value) {
   if (!value || typeof value !== 'object') {
      return '';
   }
   const definition = lookupPreset(value.preset);
   if (!definition) {
      return '';
   }
   return definition.label(value.amount);
}

/**
 * Equality of the symbolic value only. No absolute ordering.
 *
 * @param {{ preset?: string, amount?: number }|null|undefined} left
 * @param {{ preset?: string, amount?: number }|null|undefined} right
 * @returns {-1|0|1|null}
 */
export function compareRelativeDate(left, right) {
   if (!left || !right || !left.preset || !right.preset) {
      return null;
   }
   if (left.preset !== right.preset) {
      return left.preset < right.preset ? -1 : 1;
   }
   const a = left.amount ?? 0;
   const b = right.amount ?? 0;
   if (a === b) {
      return 0;
   }
   return a < b ? -1 : 1;
}
