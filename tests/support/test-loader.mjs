import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const ajaxMockUrl = pathToFileURL(path.join(root, 'tests/support/ajax-mock.mjs')).href;

/**
 * Redirects rxjs/ajax to the test mock so Core_AjaxService stays unchanged.
 *
 * @param {string} specifier
 * @param {import('node:module').ResolveHookContext} context
 * @param {import('node:module').ResolveHook} nextResolve
 */
export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'rxjs/ajax') {
        return { url: ajaxMockUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
}
