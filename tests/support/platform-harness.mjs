import { Core } from '../../services/core/core.js';

/**
 * Boots Core with globals expected by platform services in Node tests.
 *
 * @returns {Core}
 */
export function bootCore() {
    const core = new Core();
    globalThis.$core = core;
    return core;
}
