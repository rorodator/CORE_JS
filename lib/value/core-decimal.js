/**
 * Exact integer and decimal strings. Never uses Number to parse, compare, or round.
 * Canonical decimal form: optional "-", digits, optional "." and fraction digits.
 * Grouping separators are display-only.
 */
import { valueEmpty, valueInvalid, valuePending, valueValid } from './core-value-result.js';

/** Space-like group separators accepted when the configured one is a space. */
const SPACE_GROUPS = new Set([' ', '\u00A0', '\u202F', '\u2009']);

/**
 * @param {{ locale?: string, decimalSeparator?: string, groupSeparator?: string }} [options]
 * @returns {{ decimalSeparator: string, groupSeparator: string }}
 */
export function resolveNumberFormat(options = {}) {
   const locale = String(options.locale || 'en').toLowerCase();
   const french = locale === 'fr' || locale.startsWith('fr-');
   return {
      decimalSeparator: options.decimalSeparator ?? (french ? ',' : '.'),
      groupSeparator: options.groupSeparator ?? (french ? '\u00A0' : ',')
   };
}

/**
 * @param {string} actual
 * @param {string} configured
 * @returns {boolean}
 */
function sameGroupChar(actual, configured) {
   if (actual === configured) {
      return true;
   }
   return SPACE_GROUPS.has(configured) && SPACE_GROUPS.has(actual);
}

/**
 * @param {string} body Integer text including group separators.
 * @param {string} groupSeparator
 * @returns {boolean}
 */
function isValidGrouping(body, groupSeparator) {
   /** @type {string[]} */
   const parts = [];
   let current = '';
   for (const ch of body) {
      if (sameGroupChar(ch, groupSeparator)) {
         parts.push(current);
         current = '';
      } else if (ch >= '0' && ch <= '9') {
         current += ch;
      } else {
         return false;
      }
   }
   parts.push(current);
   if (parts.length === 1) {
      return /^\d+$/.test(parts[0]);
   }
   if (parts.some((part) => part.length === 0)) {
      return false;
   }
   if (parts[0].length < 1 || parts[0].length > 3) {
      return false;
   }
   for (let index = 1; index < parts.length; index += 1) {
      if (parts[index].length !== 3) {
         return false;
      }
   }
   return true;
}

/**
 * @param {string} body
 * @param {string} groupSeparator
 * @returns {boolean}
 */
function endsWithGroup(body, groupSeparator) {
   if (!body) {
      return false;
   }
   return sameGroupChar(body[body.length - 1], groupSeparator);
}

/**
 * @param {string} digits
 * @returns {string}
 */
function stripLeadingZeros(digits) {
   const stripped = digits.replace(/^0+/, '');
   return stripped === '' ? '0' : stripped;
}

/**
 * @param {string} canonical
 * @param {{ maxFractionDigits?: number|null, excessPrecision?: 'reject'|'keep', integer?: boolean }} options
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
function applyPrecision(canonical, options) {
   if (options.integer || options.maxFractionDigits == null) {
      return valueValid(canonical);
   }
   const fraction = canonical.includes('.') ? canonical.split('.')[1] : '';
   if (fraction.length <= options.maxFractionDigits) {
      return valueValid(canonical);
   }
   if (options.excessPrecision === 'keep') {
      return valueValid(canonical);
   }
   return valueInvalid('E_PRECISION', 'Too many decimal places.', { exact: canonical });
}

/**
 * Normalize a separator-free digit string into a canonical integer or decimal.
 * @param {string} text
 * @param {{ integer?: boolean, maxFractionDigits?: number|null, excessPrecision?: 'reject'|'keep' }} options
 * @returns {import('./core-value-result.js').ValueParseResult|null}
 */
function parseCanonicalBody(text, options) {
   const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
   if (!match) {
      return null;
   }
   if (options.integer && match[3] != null) {
      return valueInvalid('E_INVALID_SHAPE', 'An integer cannot contain a decimal separator.');
   }
   const sign = match[1];
   const intPart = stripLeadingZeros(match[2]);
   const fraction = match[3];
   const negativeZero = sign === '-' && intPart === '0' && (fraction == null || /^0+$/.test(fraction));
   const signed = sign === '-' && !negativeZero ? '-' : '';
   const canonical = fraction == null
      ? `${signed}${intPart}`
      : `${signed}${intPart}.${fraction}`;
   return applyPrecision(canonical, options);
}

/**
 * Canonical grammar only: optional "-", digits, optional "." and fraction digits.
 * "." is always the decimal point. Grouping and a localized decimal separator are rejected.
 *
 * @param {unknown} raw
 * @param {Parameters<typeof parseCanonicalBody>[1]} [options]
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
export function parseCanonicalNumber(raw, options = {}) {
   const prepared = prepareNumericRaw(raw);
   if (prepared) {
      return prepared;
   }
   const parsed = parseCanonicalBody(/** @type {string} */ (preparedText(raw)), options);
   if (parsed) {
      return parsed;
   }
   return valueInvalid('E_INVALID_SHAPE', 'A canonical number cannot contain grouping or a localized decimal separator.');
}

/**
 * Localized display text. When the group separator is ".", a grouped value such as
 * "1.234" is one thousand two hundred thirty-four, not the canonical decimal "1.234".
 * Canonical "." is still accepted when it cannot be the group separator (en, fr).
 *
 * @param {unknown} raw
 * @param {{
 *   locale?: string,
 *   decimalSeparator?: string,
 *   groupSeparator?: string,
 *   maxFractionDigits?: number|null,
 *   excessPrecision?: 'reject'|'keep',
 *   integer?: boolean
 * }} [options]
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
export function parseLocalizedNumber(raw, options = {}) {
   const prepared = prepareNumericRaw(raw);
   if (prepared) {
      return prepared;
   }
   const text = /** @type {string} */ (preparedText(raw));
   const { groupSeparator } = resolveNumberFormat(options);
   if (groupSeparator !== '.') {
      const canonical = parseCanonicalBody(text, options);
      if (canonical) {
         return canonical;
      }
   }
   return parseLocalizedBody(text, options);
}

/**
 * @param {unknown} raw
 * @param {Parameters<typeof parseLocalizedNumber>[1] & { source?: 'canonical'|'localized' }} [options]
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
export function parseNumber(raw, options = {}) {
   if (options.source === 'canonical') {
      return parseCanonicalNumber(raw, options);
   }
   return parseLocalizedNumber(raw, options);
}

/**
 * @param {unknown} raw
 * @returns {import('./core-value-result.js').ValueParseResult|null}
 */
function prepareNumericRaw(raw) {
   if (raw == null) {
      return valueEmpty();
   }
   if (typeof raw !== 'string') {
      return valueInvalid('E_INVALID_SHAPE', 'A numeric value must be a string.');
   }
   const text = raw.trim();
   if (text === '') {
      return valueEmpty();
   }
   if (text === '-') {
      return valuePending();
   }
   if (text === '+') {
      return valueInvalid('E_INVALID_SHAPE', 'A leading plus is not allowed.');
   }
   return null;
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function preparedText(raw) {
   return /** @type {string} */ (raw).trim();
}

/**
 * @param {string} text
 * @param {{
 *   locale?: string,
 *   decimalSeparator?: string,
 *   groupSeparator?: string,
 *   maxFractionDigits?: number|null,
 *   excessPrecision?: 'reject'|'keep',
 *   integer?: boolean
 * }} options
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
function parseLocalizedBody(text, options) {
   const { decimalSeparator, groupSeparator } = resolveNumberFormat(options);
   if (decimalSeparator === groupSeparator) {
      return valueInvalid('E_INVALID_SHAPE', 'Decimal and group separators must differ.');
   }

   let index = 0;
   if (text[0] === '+') {
      return valueInvalid('E_INVALID_SHAPE', 'A leading plus is not allowed.');
   }
   let sign = '';
   if (text[0] === '-') {
      sign = '-';
      index = 1;
      if (index >= text.length) {
         return valuePending();
      }
   }

   let intDigits = '';
   let sawGroup = false;
   const intStart = index;
   while (index < text.length) {
      const ch = text[index];
      if (ch >= '0' && ch <= '9') {
         intDigits += ch;
         index += 1;
         continue;
      }
      if (sameGroupChar(ch, groupSeparator)) {
         sawGroup = true;
         index += 1;
         continue;
      }
      break;
   }

   const intBody = text.slice(intStart, index);
   const decimalHere = !options.integer && index < text.length && text[index] === decimalSeparator;

   if (sawGroup) {
      if (!isValidGrouping(intBody, groupSeparator)) {
         if (endsWithGroup(intBody, groupSeparator) && index === text.length && intDigits !== '') {
            return valuePending();
         }
         return valueInvalid('E_INVALID_SHAPE', 'Invalid grouping.');
      }
   }

   /** @type {string|null} */
   let fraction = null;
   if (decimalHere) {
      index += 1;
      fraction = '';
      if (index === text.length) {
         return valuePending();
      }
      while (index < text.length) {
         const ch = text[index];
         if (ch >= '0' && ch <= '9') {
            fraction += ch;
            index += 1;
            continue;
         }
         if (sameGroupChar(ch, groupSeparator) || ch === decimalSeparator) {
            return valueInvalid('E_INVALID_SHAPE', 'Invalid decimal number.');
         }
         return valueInvalid('E_INVALID_SHAPE', 'Unexpected character in number.');
      }
   }

   if (index !== text.length) {
      const ch = text[index];
      if (!options.integer && ch === decimalSeparator) {
         return valueInvalid('E_INVALID_SHAPE', 'Invalid decimal number.');
      }
      return valueInvalid('E_INVALID_SHAPE', 'Unexpected character in number.');
   }

   if (intDigits === '' && fraction == null) {
      return valueInvalid('E_INVALID_SHAPE', 'Missing digits.');
   }
   if (intDigits === '') {
      intDigits = '0';
   }
   intDigits = stripLeadingZeros(intDigits);

   const zero = intDigits === '0' && (fraction == null || /^0+$/.test(fraction));
   const signed = sign === '-' && !zero ? '-' : '';
   const canonicalText = fraction == null
      ? `${signed}${intDigits}`
      : `${signed}${intDigits}.${fraction}`;
   return applyPrecision(canonicalText, options);
}

/**
 * @param {unknown} raw
 * @param {Parameters<typeof parseNumber>[1]} [options]
 */
export function parseInteger(raw, options = {}) {
   return parseNumber(raw, { ...options, integer: true });
}

/**
 * @param {unknown} raw
 * @param {Parameters<typeof parseNumber>[1]} [options]
 */
export function parseDecimal(raw, options = {}) {
   return parseNumber(raw, { ...options, integer: false });
}

/**
 * @param {string} digits
 * @param {string} groupSeparator
 * @returns {string}
 */
function groupDigits(digits, groupSeparator) {
   const chars = digits.split('');
   /** @type {string[]} */
   const out = [];
   for (let index = 0; index < chars.length; index += 1) {
      if (index > 0 && (chars.length - index) % 3 === 0) {
         out.push(groupSeparator);
      }
      out.push(chars[index]);
   }
   return out.join('');
}

/**
 * Display form. Never rounds or truncates significant fraction digits.
 * `maxFractionDigits` is ignored here; it is a validation rule in {@link parseNumber}.
 * `minFractionDigits` pads the display only and is off unless explicitly set.
 *
 * @param {string|null|undefined} canonical
 * @param {{
 *   locale?: string,
 *   decimalSeparator?: string,
 *   groupSeparator?: string,
 *   minFractionDigits?: number|null
 * }} [options]
 * @returns {string}
 */
export function formatDecimal(canonical, options = {}) {
   if (canonical == null || canonical === '') {
      return '';
   }
   const text = String(canonical);
   const negative = text.startsWith('-');
   const body = negative ? text.slice(1) : text;
   const [intPart, fracPart = ''] = body.split('.');
   const { decimalSeparator, groupSeparator } = resolveNumberFormat(options);
   let fraction = fracPart;
   if (options.minFractionDigits != null) {
      while (fraction.length < options.minFractionDigits) {
         fraction += '0';
      }
   }
   const grouped = groupDigits(intPart || '0', groupSeparator);
   const shown = fraction.length > 0 ? `${grouped}${decimalSeparator}${fraction}` : grouped;
   return negative ? `-${shown}` : shown;
}

/**
 * @param {string|null|undefined} canonical
 * @param {Parameters<typeof formatDecimal>[1]} [options]
 * @returns {string}
 */
export function formatInteger(canonical, options = {}) {
   return formatDecimal(canonical, options);
}

/**
 * @param {string} canonical
 * @returns {{ sign: -1|1, int: string, frac: string }|null}
 */
function splitCanonical(canonical) {
   const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(canonical);
   if (!match) {
      return null;
   }
   return {
      sign: match[1] === '-' ? -1 : 1,
      int: stripLeadingZeros(match[2]),
      frac: match[3] || ''
   };
}

/**
 * @param {{ int: string, frac: string }} left
 * @param {{ int: string, frac: string }} right
 * @returns {-1|0|1}
 */
function compareAbsolute(left, right) {
   if (left.int.length !== right.int.length) {
      return left.int.length < right.int.length ? -1 : 1;
   }
   if (left.int !== right.int) {
      return left.int < right.int ? -1 : 1;
   }
   const leftFrac = left.frac.replace(/0+$/, '');
   const rightFrac = right.frac.replace(/0+$/, '');
   const width = Math.max(leftFrac.length, rightFrac.length);
   const a = leftFrac.padEnd(width, '0');
   const b = rightFrac.padEnd(width, '0');
   if (a === b) {
      return 0;
   }
   return a < b ? -1 : 1;
}

/**
 * Numeric compare of canonical strings. Returns null when either side is not canonical.
 * `1.10` equals `1.1`. The strings themselves are not rewritten.
 *
 * @param {string|null|undefined} left
 * @param {string|null|undefined} right
 * @returns {-1|0|1|null}
 */
export function compareDecimal(left, right) {
   if (left == null || right == null) {
      return null;
   }
   const a = splitCanonical(String(left));
   const b = splitCanonical(String(right));
   if (!a || !b) {
      return null;
   }
   const aZero = a.int === '0' && /^0*$/.test(a.frac);
   const bZero = b.int === '0' && /^0*$/.test(b.frac);
   if (aZero && bZero) {
      return 0;
   }
   if (a.sign !== b.sign) {
      return a.sign < b.sign ? -1 : 1;
   }
   const magnitude = compareAbsolute(a, b);
   if (magnitude === 0) {
      return 0;
   }
   return a.sign < 0 ? /** @type {-1|1} */ (-magnitude) : magnitude;
}

/**
 * @param {string|null|undefined} left
 * @param {string|null|undefined} right
 * @returns {-1|0|1|null}
 */
export function compareInteger(left, right) {
   return compareDecimal(left, right);
}
