/**
 * Case- and accent-insensitive text match.
 * Combining marks are stripped (NFD). Letters that are not decomposable (œ, ł)
 * stay as they are. Does not change autocomplete or multi-select helpers.
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function foldText(value) {
   return String(value ?? '')
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase();
}

/**
 * @param {unknown} haystack
 * @param {unknown} needle
 * @returns {boolean}
 */
export function textIncludes(haystack, needle) {
   return foldText(haystack).includes(foldText(needle));
}

/**
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
export function textEquals(left, right) {
   return foldText(left) === foldText(right);
}
