import { Observable } from 'rxjs';

/** @type {import('rxjs/ajax').AjaxConfig|null} */
let lastConfig = null;

/** @type {((config: import('rxjs/ajax').AjaxConfig) => import('rxjs/ajax').AjaxResponse|Error|{ xhr: Partial<XMLHttpRequest> }|{ message: string })|null} */
let behavior = null;

/**
 * Configures the next ajax() call behavior.
 *
 * @param {(config: import('rxjs/ajax').AjaxConfig) => *} fn
 */
export function setAjaxBehavior(fn) {
    behavior = fn;
}

/** Resets captured config and behavior between tests. */
export function resetAjaxMock() {
    lastConfig = null;
    behavior = null;
}

/** @returns {import('rxjs/ajax').AjaxConfig|null} */
export function getLastAjaxConfig() {
    return lastConfig;
}

/**
 * Minimal rxjs/ajax stand-in for contract tests.
 *
 * @param {import('rxjs/ajax').AjaxConfig} config
 * @returns {import('rxjs').Observable<import('rxjs/ajax').AjaxResponse>}
 */
export function ajax(config) {
    lastConfig = config;

    return new Observable((subscriber) => {
        try {
            const outcome = behavior ? behavior(config) : {
                status: 200,
                statusText: 'OK',
                response: null,
            };

            if (outcome instanceof Error || outcome?.message && !outcome?.status && !outcome?.xhr) {
                subscriber.error(outcome);
                return;
            }

            if (outcome?.xhr) {
                subscriber.error(outcome);
                return;
            }

            subscriber.next({
                status: outcome.status ?? 200,
                statusText: outcome.statusText ?? 'OK',
                response: outcome.response ?? null,
                xhr: outcome.xhr ?? {},
            });
            subscriber.complete();
        } catch (error) {
            subscriber.error(error);
        }
    });
}
