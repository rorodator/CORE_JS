/**
 * Shared parse results for value primitives. No DOM, no Number coercion of business values.
 */

/**
 * @typedef {'empty'|'pending'|'valid'|'invalid'} ValueStatus
 * @typedef {{ code: string, message: string, details?: Readonly<Record<string, unknown>> }} ValueError
 * @typedef {{ status: ValueStatus, value: unknown, errors: ValueError[] }} ValueParseResult
 */

/** @returns {ValueParseResult} */
export function valueEmpty() {
   return { status: 'empty', value: null, errors: [] };
}

/** @returns {ValueParseResult} */
export function valuePending() {
   return { status: 'pending', value: null, errors: [] };
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Readonly<Record<string, unknown>>} [details]
 * @returns {ValueParseResult}
 */
export function valueInvalid(code, message, details) {
   /** @type {ValueError} */
   const error = { code, message };
   if (details) {
      error.details = details;
   }
   return { status: 'invalid', value: null, errors: [error] };
}

/**
 * @param {unknown} value
 * @returns {ValueParseResult}
 */
export function valueValid(value) {
   return { status: 'valid', value, errors: [] };
}
