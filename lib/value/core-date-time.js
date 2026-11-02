/**
 * Strict date, time, and datetime parsing.
 * Local datetimes and offset datetimes are never converted into each other.
 * Month names are a fixed English table (not Intl) so results do not depend on ICU.
 */
import { valueEmpty, valueInvalid, valuePending, valueValid } from './core-value-result.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * @param {number} year
 * @param {number} month 1-12
 * @returns {number}
 */
export function daysInMonth(year, month) {
   if (month === 2) {
      const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      return leap ? 29 : 28;
   }
   return [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] || 0;
}

/**
 * @param {number} value
 * @returns {string}
 */
function pad2(value) {
   return String(value).padStart(2, '0');
}

/**
 * @param {number} value
 * @returns {string}
 */
function pad4(value) {
   return String(value).padStart(4, '0');
}

/**
 * @param {string} format
 * @returns {string[]}
 */
function tokenizeFormat(format) {
   return format.match(/yyyy|MMM|MM|dd|HH|mm|ss|S+|xxx|[\s\S]/g) || [];
}

/**
 * @param {string} token
 * @returns {boolean}
 */
function isKeyword(token) {
   return /^(?:yyyy|MMM|MM|dd|HH|mm|ss|S+|xxx)$/.test(token);
}

/**
 * @param {string} input
 * @param {number} index
 * @param {number} count
 * @param {number} min
 * @param {number} max
 * @returns {{ error: 'pending'|'invalid' }|{ ok: true, num: number, len: number }}
 */
function readDigits(input, index, count, min, max) {
   const slice = input.slice(index);
   const match = /^(\d+)/.exec(slice);
   if (!match) {
      return { error: 'invalid' };
   }
   if (match[1].length < count) {
      return index + match[1].length === input.length
         ? { error: 'pending' }
         : { error: 'invalid' };
   }
   const num = Number(match[1].slice(0, count));
   if (num < min || num > max) {
      return { error: 'invalid' };
   }
   return { ok: true, num, len: count };
}

/**
 * @param {string} input
 * @param {number} index
 * @returns {{ error: 'pending'|'invalid' }|{ ok: true, month: number, len: number }}
 */
function readMonthName(input, index) {
   const match = /^[A-Za-z]+/.exec(input.slice(index));
   if (!match) {
      return { error: 'invalid' };
   }
   const word = match[0];
   const exact = MONTHS.find((name) => name.toLowerCase() === word.toLowerCase());
   if (exact) {
      return { ok: true, month: MONTHS.indexOf(exact) + 1, len: word.length };
   }
   const prefix = MONTHS.some((name) => name.toLowerCase().startsWith(word.toLowerCase()));
   if (prefix && index + word.length === input.length) {
      return { error: 'pending' };
   }
   return { error: 'invalid' };
}

/**
 * @param {string} input
 * @param {number} index
 * @returns {{ error: 'pending'|'invalid' }|{ ok: true, offset: string, len: number }}
 */
function readOffset(input, index) {
   const rest = input.slice(index);
   if (rest === '') {
      return { error: 'pending' };
   }
   if (rest[0] === 'Z') {
      return { ok: true, offset: 'Z', len: 1 };
   }
   if (rest[0] !== '+' && rest[0] !== '-') {
      return { error: 'invalid' };
   }
   const match = /^([+-])(\d{0,2})(:?)(\d{0,2})/.exec(rest);
   if (!match) {
      return { error: 'invalid' };
   }
   const hh = match[2];
   const colon = match[3];
   const mm = match[4];
   const consumed = match[1].length + hh.length + colon.length + mm.length;
   const complete = hh.length === 2 && colon === ':' && mm.length === 2;
   if (!complete) {
      return index + consumed === input.length ? { error: 'pending' } : { error: 'invalid' };
   }
   const hour = Number(hh);
   const minute = Number(mm);
   if (hour > 23 || minute > 59) {
      return { error: 'invalid' };
   }
   return { ok: true, offset: `${match[1]}${hh}:${mm}`, len: consumed };
}

/**
 * @param {Record<string, number|string|undefined>} fields
 * @param {{ fractionDigits?: number }} [options]
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
function canonicalFromFields(fields, options = {}) {
   if (fields.day != null || fields.month != null || fields.year != null) {
      if (fields.day == null || fields.month == null || fields.year == null) {
         return valuePending();
      }
      const year = /** @type {number} */ (fields.year);
      const month = /** @type {number} */ (fields.month);
      const day = /** @type {number} */ (fields.day);
      if (day < 1 || day > daysInMonth(year, month)) {
         return valueInvalid('E_INVALID_SHAPE', 'That date does not exist.');
      }
   }

   let date = '';
   if (fields.year != null) {
      date = `${pad4(/** @type {number} */ (fields.year))}-${pad2(/** @type {number} */ (fields.month))}-${pad2(/** @type {number} */ (fields.day))}`;
   }

   let time = '';
   if (fields.hour != null || fields.minute != null || fields.second != null || fields.fraction != null) {
      const hour = /** @type {number} */ (fields.hour ?? 0);
      const minute = /** @type {number} */ (fields.minute ?? 0);
      const second = /** @type {number} */ (fields.second ?? 0);
      time = `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
      if (typeof fields.fraction === 'string') {
         time += `.${fields.fraction}`;
      }
   }

   if (date && time) {
      const offset = fields.offset ? String(fields.offset) : '';
      return valueValid(`${date}T${time}${offset}`);
   }
   if (date) {
      return valueValid(date);
   }
   if (time) {
      return valueValid(time);
   }
   return valueInvalid('E_INVALID_SHAPE', 'Enter a valid value.');
}

/**
 * @param {string} input
 * @param {string} format
 * @param {{ fractionDigits?: number, temporal?: 'local'|'offset' }} [options]
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
function parseWithFormat(input, format, options = {}) {
   const tokens = tokenizeFormat(format);
   /** @type {Record<string, number|string|undefined>} */
   const fields = {};
   let index = 0;

   for (const token of tokens) {
      if (index >= input.length) {
         return valuePending();
      }
      if (!isKeyword(token)) {
         if (input[index] !== token) {
            return valueInvalid('E_INVALID_SHAPE', 'Unexpected character.');
         }
         index += 1;
         continue;
      }
      if (token === 'yyyy') {
         const read = readDigits(input, index, 4, 1, 9999);
         if ('error' in read) {
            return read.error === 'pending'
               ? valuePending()
               : valueInvalid('E_INVALID_SHAPE', 'Enter a four-digit year.');
         }
         fields.year = read.num;
         index += read.len;
      } else if (token === 'MM') {
         const read = readDigits(input, index, 2, 1, 12);
         if ('error' in read) {
            return read.error === 'pending'
               ? valuePending()
               : valueInvalid('E_INVALID_SHAPE', 'Enter a valid month.');
         }
         fields.month = read.num;
         index += read.len;
      } else if (token === 'MMM') {
         const read = readMonthName(input, index);
         if ('error' in read) {
            return read.error === 'pending'
               ? valuePending()
               : valueInvalid('E_INVALID_SHAPE', 'Enter an English month abbreviation.');
         }
         fields.month = read.month;
         index += read.len;
      } else if (token === 'dd') {
         const read = readDigits(input, index, 2, 1, 31);
         if ('error' in read) {
            return read.error === 'pending'
               ? valuePending()
               : valueInvalid('E_INVALID_SHAPE', 'Enter a valid day.');
         }
         fields.day = read.num;
         index += read.len;
      } else if (token === 'HH') {
         const read = readDigits(input, index, 2, 0, 23);
         if ('error' in read) {
            return read.error === 'pending'
               ? valuePending()
               : valueInvalid('E_INVALID_SHAPE', 'Enter a valid hour.');
         }
         fields.hour = read.num;
         index += read.len;
      } else if (token === 'mm') {
         const read = readDigits(input, index, 2, 0, 59);
         if ('error' in read) {
            return read.error === 'pending'
               ? valuePending()
               : valueInvalid('E_INVALID_SHAPE', 'Enter a valid minute.');
         }
         fields.minute = read.num;
         index += read.len;
      } else if (token === 'ss') {
         const read = readDigits(input, index, 2, 0, 59);
         if ('error' in read) {
            return read.error === 'pending'
               ? valuePending()
               : valueInvalid('E_INVALID_SHAPE', 'Enter a valid second.');
         }
         fields.second = read.num;
         index += read.len;
      } else if (/^S+$/.test(token)) {
         const read = readDigits(input, index, token.length, 0, Number('9'.repeat(token.length)));
         if ('error' in read) {
            return read.error === 'pending'
               ? valuePending()
               : valueInvalid('E_PRECISION', 'Fractional seconds do not match the declared precision.', {
                  rejected: input
               });
         }
         fields.fraction = input.slice(index, index + token.length);
         index += token.length;
      } else if (token === 'xxx') {
         const read = readOffset(input, index);
         if ('error' in read) {
            return read.error === 'pending'
               ? valuePending()
               : valueInvalid('E_INVALID_SHAPE', 'Enter an explicit offset (Z or ±HH:mm).');
         }
         fields.offset = read.offset;
         index += read.len;
      }
   }

   if (index < input.length) {
      const rest = input.slice(index).trim();
      if (options.temporal !== 'offset' && /^Z$|^[+-]\d{2}:\d{2}$/.test(rest)) {
         return valueInvalid('E_TEMPORAL_MIX', 'A local datetime cannot include an offset.');
      }
      if (/^\.\d+$/.test(input.slice(index))) {
         return valueInvalid('E_PRECISION', 'Fractional seconds are not declared for this value.', {
            rejected: input
         });
      }
      return valueInvalid('E_INVALID_SHAPE', 'Unexpected trailing characters.');
   }

   if (fields.second == null && (fields.hour != null || fields.minute != null)) {
      fields.second = 0;
   }
   if (options.temporal === 'offset' && fields.offset == null && (fields.year != null && fields.hour != null)) {
      return valueInvalid('E_TEMPORAL_MIX', 'An offset datetime requires an explicit offset.');
   }
   return canonicalFromFields(fields, options);
}

/**
 * @param {string} text
 * @param {number|undefined} fractionDigits
 * @param {string} timeBody
 * @returns {import('./core-value-result.js').ValueParseResult|null}
 */
function checkFraction(text, fractionDigits, timeBody) {
   const match = /^(\d{2}:\d{2}:\d{2})(?:\.(\d+))?$/.exec(timeBody);
   if (!match) {
      return null;
   }
   const fraction = match[2];
   const declared = fractionDigits ?? 0;
   if (fraction == null) {
      return declared === 0 ? null : valueInvalid('E_PRECISION', 'Fractional seconds are required.', { rejected: text });
   }
   if (declared === 0) {
      return valueInvalid('E_PRECISION', 'Fractional seconds are not declared for this value.', { rejected: text });
   }
   if (fraction.length !== declared) {
      return valueInvalid('E_PRECISION', 'Fractional seconds do not match the declared precision.', { rejected: text });
   }
   return null;
}

/**
 * @param {string} text
 * @returns {import('./core-value-result.js').ValueParseResult|null}
 */
function tryCanonicalDate(text) {
   const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
   if (!match) {
      return null;
   }
   const year = Number(match[1]);
   const month = Number(match[2]);
   const day = Number(match[3]);
   if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
      return valueInvalid('E_INVALID_SHAPE', 'That date does not exist.');
   }
   return valueValid(`${match[1]}-${match[2]}-${match[3]}`);
}

/**
 * @param {string} text
 * @param {number|undefined} fractionDigits
 * @returns {import('./core-value-result.js').ValueParseResult|null}
 */
function tryCanonicalTime(text, fractionDigits) {
   if (!/^(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/.test(text)) {
      return null;
   }
   const fractionError = checkFraction(text, fractionDigits, text);
   if (fractionError) {
      return fractionError;
   }
   const match = /^(\d{2}):(\d{2}):(\d{2})/.exec(text);
   if (!match) {
      return null;
   }
   const hour = Number(match[1]);
   const minute = Number(match[2]);
   const second = Number(match[3]);
   if (hour > 23 || minute > 59 || second > 59) {
      return valueInvalid('E_INVALID_SHAPE', 'That time does not exist.');
   }
   return valueValid(text);
}

/**
 * @param {unknown} raw
 * @returns {import('./core-value-result.js').ValueParseResult|null}
 */
function prepareRaw(raw) {
   if (raw == null) {
      return valueEmpty();
   }
   if (typeof raw !== 'string') {
      return valueInvalid('E_INVALID_SHAPE', 'A date or time value must be a string.');
   }
   if (raw.trim() === '') {
      return valueEmpty();
   }
   return null;
}

/**
 * @param {unknown} raw
 * @param {{ format?: string }} [options]
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
export function parseDate(raw, options = {}) {
   const prepared = prepareRaw(raw);
   if (prepared) {
      return prepared;
   }
   const text = /** @type {string} */ (raw).trim();
   const canonical = tryCanonicalDate(text);
   if (canonical) {
      return canonical;
   }
   return parseWithFormat(text, options.format || 'yyyy-MM-dd', options);
}

/**
 * @param {unknown} raw
 * @param {{ format?: string, fractionDigits?: number }} [options]
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
export function parseTime(raw, options = {}) {
   const prepared = prepareRaw(raw);
   if (prepared) {
      return prepared;
   }
   const text = /** @type {string} */ (raw).trim();
   const canonical = tryCanonicalTime(text, options.fractionDigits);
   if (canonical) {
      return canonical;
   }
   const format = options.fractionDigits
      ? `${options.format || 'HH:mm:ss'}.${'S'.repeat(options.fractionDigits)}`
      : (options.format || 'HH:mm:ss');
   return parseWithFormat(text, format, options);
}

/**
 * @param {unknown} raw
 * @param {{ format?: string, temporal?: 'local'|'offset', fractionDigits?: number }} [options]
 * @returns {import('./core-value-result.js').ValueParseResult}
 */
export function parseDateTime(raw, options = {}) {
   const prepared = prepareRaw(raw);
   if (prepared) {
      return prepared;
   }
   const text = /** @type {string} */ (raw).trim();
   const temporal = options.temporal === 'offset' ? 'offset' : 'local';
   const offsetMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})$/.exec(text);
   const localMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/.exec(text);

   if (temporal === 'local' && offsetMatch) {
      return valueInvalid('E_TEMPORAL_MIX', 'A local datetime cannot include an offset.');
   }
   if (temporal === 'offset' && localMatch && !offsetMatch) {
      return valueInvalid('E_TEMPORAL_MIX', 'An offset datetime requires an explicit offset.');
   }

   const chosen = temporal === 'offset' ? offsetMatch : localMatch;
   if (chosen) {
      const datePart = tryCanonicalDate(chosen[1]);
      if (datePart?.status === 'invalid') {
         return datePart;
      }
      const timePart = tryCanonicalTime(chosen[2], options.fractionDigits);
      if (timePart?.status === 'invalid') {
         return timePart;
      }
      if (datePart?.status === 'valid' && timePart?.status === 'valid') {
         return valueValid(text);
      }
   }

   let format = options.format || (temporal === 'offset'
      ? 'yyyy-MM-ddTHH:mm:ss xxx'
      : 'yyyy-MM-ddTHH:mm:ss');
   if (options.fractionDigits && !/S/.test(format)) {
      format = format.replace('ss', `ss.${'S'.repeat(options.fractionDigits)}`);
   }
   return parseWithFormat(text, format, { ...options, temporal });
}

/**
 * @param {string} canonical
 * @param {string} format
 * @returns {string}
 */
function formatFromCanonical(canonical, format) {
   const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?)?$/.exec(canonical)
      || /^(?:(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?)$/.exec(canonical);
   if (!match) {
      return canonical;
   }
   /** @type {Record<string, string>} */
   const bag = {};
   if (match.length > 5 && match[1] && match[1].length === 4) {
      bag.yyyy = match[1];
      bag.MM = match[2];
      bag.dd = match[3];
      bag.MMM = MONTHS[Number(match[2]) - 1] || match[2];
      if (match[4]) {
         bag.HH = match[4];
         bag.mm = match[5];
         bag.ss = match[6];
         if (match[7]) {
            bag.fraction = match[7];
         }
         if (match[8]) {
            bag.xxx = match[8];
         }
      }
   } else {
      bag.HH = match[1];
      bag.mm = match[2];
      bag.ss = match[3];
      if (match[4]) {
         bag.fraction = match[4];
      }
   }
   return format.replace(/yyyy|MMM|MM|dd|HH|mm|ss|S+|xxx/g, (token) => {
      if (/^S+$/.test(token)) {
         return bag.fraction || '';
      }
      return bag[token] ?? '';
   });
}

/**
 * @param {string|null|undefined} canonical
 * @param {{ format?: string }} [options]
 * @returns {string}
 */
export function formatDate(canonical, options = {}) {
   if (!canonical) {
      return '';
   }
   return formatFromCanonical(canonical, options.format || 'yyyy-MM-dd');
}

/**
 * @param {string|null|undefined} canonical
 * @param {{ format?: string }} [options]
 * @returns {string}
 */
export function formatTime(canonical, options = {}) {
   if (!canonical) {
      return '';
   }
   return formatFromCanonical(canonical, options.format || 'HH:mm:ss');
}

/**
 * @param {string|null|undefined} canonical
 * @param {{ format?: string, temporal?: 'local'|'offset' }} [options]
 * @returns {string}
 */
export function formatDateTime(canonical, options = {}) {
   if (!canonical) {
      return '';
   }
   const format = options.format || (options.temporal === 'offset'
      ? 'yyyy-MM-ddTHH:mm:ss xxx'
      : 'yyyy-MM-ddTHH:mm:ss');
   return formatFromCanonical(canonical, format);
}

/**
 * Days since Unix epoch for a civil date. Gregorian, proleptic.
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @returns {number}
 */
function unixDays(year, month, day) {
   const y = month <= 2 ? year - 1 : year;
   const era = Math.floor(y / 400);
   const yoe = y - era * 400;
   const mp = month + (month > 2 ? -3 : 9);
   const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
   const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
   return era * 146097 + doe - 719468;
}

/**
 * @param {string} fractionA
 * @param {string} fractionB
 * @returns {-1|0|1}
 */
function compareFraction(fractionA, fractionB) {
   const width = Math.max(fractionA.length, fractionB.length);
   const a = fractionA.padEnd(width, '0');
   const b = fractionB.padEnd(width, '0');
   if (a === b) {
      return 0;
   }
   return a < b ? -1 : 1;
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {-1|0|1|null}
 */
export function compareDate(left, right) {
   if (!/^\d{4}-\d{2}-\d{2}$/.test(left) || !/^\d{4}-\d{2}-\d{2}$/.test(right)) {
      return null;
   }
   if (left === right) {
      return 0;
   }
   return left < right ? -1 : 1;
}

/**
 * @param {string} value
 * @returns {{ h: number, m: number, s: number, frac: string }|null}
 */
function splitTime(value) {
   const match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value);
   if (!match) {
      return null;
   }
   return {
      h: Number(match[1]),
      m: Number(match[2]),
      s: Number(match[3]),
      frac: match[4] || ''
   };
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {-1|0|1|null}
 */
export function compareTime(left, right) {
   const a = splitTime(left);
   const b = splitTime(right);
   if (!a || !b) {
      return null;
   }
   if (a.h !== b.h) {
      return a.h < b.h ? -1 : 1;
   }
   if (a.m !== b.m) {
      return a.m < b.m ? -1 : 1;
   }
   if (a.s !== b.s) {
      return a.s < b.s ? -1 : 1;
   }
   return compareFraction(a.frac, b.frac);
}

/**
 * @param {string} value
 * @returns {{ date: string, time: string, offset: string|null }|null}
 */
function splitDateTime(value) {
   const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})?$/.exec(value);
   if (!match) {
      return null;
   }
   return { date: match[1], time: match[2], offset: match[3] || null };
}

/**
 * Compare two datetimes. Local values compare as civil time.
 * Offset values compare as instants. Mixing the two returns null.
 *
 * @param {string} left
 * @param {string} right
 * @returns {-1|0|1|null}
 */
export function compareDateTime(left, right) {
   const a = splitDateTime(left);
   const b = splitDateTime(right);
   if (!a || !b) {
      return null;
   }
   if ((a.offset == null) !== (b.offset == null)) {
      return null;
   }
   if (a.offset == null) {
      const dateCmp = compareDate(a.date, b.date);
      if (dateCmp == null || dateCmp !== 0) {
         return dateCmp;
      }
      return compareTime(a.time, b.time);
   }
   const aDays = unixDays(Number(a.date.slice(0, 4)), Number(a.date.slice(5, 7)), Number(a.date.slice(8, 10)));
   const bDays = unixDays(Number(b.date.slice(0, 4)), Number(b.date.slice(5, 7)), Number(b.date.slice(8, 10)));
   const aTime = splitTime(a.time);
   const bTime = splitTime(b.time);
   if (!aTime || !bTime) {
      return null;
   }
   const aOffset = offsetMinutes(a.offset);
   const bOffset = offsetMinutes(b.offset);
   const aMinutes = aDays * 1440 + aTime.h * 60 + aTime.m - aOffset;
   const bMinutes = bDays * 1440 + bTime.h * 60 + bTime.m - bOffset;
   if (aMinutes !== bMinutes) {
      return aMinutes < bMinutes ? -1 : 1;
   }
   if (aTime.s !== bTime.s) {
      return aTime.s < bTime.s ? -1 : 1;
   }
   return compareFraction(aTime.frac, bTime.frac);
}

/**
 * @param {string} offset
 * @returns {number}
 */
function offsetMinutes(offset) {
   if (offset === 'Z') {
      return 0;
   }
   const sign = offset[0] === '-' ? -1 : 1;
   const hours = Number(offset.slice(1, 3));
   const minutes = Number(offset.slice(4, 6));
   return sign * (hours * 60 + minutes);
}
