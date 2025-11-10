/**
 * Core_ComponentLoaderService
 *
 * Generic component loader/registry to enable lazy loading of custom elements
 * by their tag name. This service keeps a mapping of tag → loader and exposes
 * simple methods to guarantee a component is defined before usage.
 *
 * Design:
 * - A "loader" can be either:
 *   - a function returning a Promise from a dynamic import (preferred), or
 *   - a string module path that will be used with a dynamic import internally.
 * - Consumers only call ensure('tag') before creating/using the element.
 * - Optionally, prefetch('tag') can be used to prime the browser cache.
 *
 * Usage:
 *   const loader = $svc('components');
 *   loader.register('user-list', () => import('../../features/user/user-list/user-list-component.js'));
 *   await loader.ensure('user-list'); // guarantees <user-list> is defined
 *
 * Notes:
 * - The module behind the loader MUST define the custom element when imported.
 * - For best chunking, register function loaders (arrow with import(...)).
 */
export class Core_ComponentLoaderService {
  constructor() {
    /**
     * Component registry.
     * Maps custom element tag → modulePath or loader function.
     * When a loader function is provided, it MUST return a Promise resolving
     * to the dynamically imported module (i.e., return import('...')).
     * @type {Map<string, (string|(() => Promise<any>))>}
     */
    this._mapping = new Map();
  }

  /**
   * Register one component mapping.
   * @param {string} tag Custom element tag (e.g., 'user-list')
   * @param {string|(() => Promise<any>)} moduleOrLoader Module path or loader function
   */
  register(tag, moduleOrLoader) {
    if (tag && moduleOrLoader) this._mapping.set(tag, moduleOrLoader);
  }

  /**
   * Register many mappings at once.
   * The provided object should be: { 'tag': modulePathOrLoader, ... }
   * @param {Record<string, string|(() => Promise<any>)>} map
   */
  registerMany(map) {
    if (!map) return;
    Object.entries(map).forEach(([tag, spec]) => this.register(tag, spec));
  }

  /**
   * Ensure a custom element is defined.
   * If not already defined, imports the module for the given tag using the
   * registered loader (function preferred) or a dynamic import on the path.
   *
   * @param {string} tag Custom element tag to ensure
   * @returns {Promise<void>}
   * @throws {Error} If no mapping exists for the given tag
   */
  async ensure(tag) {
    if (customElements.get(tag)) return;
    const spec = this._mapping.get(tag);
    if (!spec) throw new Error(`No import mapping for <${tag}>`);
    if (typeof spec === 'function') {
      await spec(); // loader returns a dynamic import Promise
    } else {
      await import(spec);
    }
  }

  /**
   * Prefetch the module behind a component (best-effort).
   * Useful to improve perceived performance by warming the cache when idle.
   *
   * @param {string} tag Custom element tag to prefetch
   * @returns {Promise<void>}
   */
  async prefetch(tag) {
    const spec = this._mapping.get(tag);
    if (!spec) return;
    try {
      if (typeof spec === 'function') {
        await spec();
      } else {
        await import(spec);
      }
    } catch (_) {}
  }
}
