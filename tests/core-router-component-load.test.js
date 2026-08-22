import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { Core_Router } from '../lib/routing/core-router.js';
import { bootCore } from './support/platform-harness.mjs';

/**
 * @param {string} tag
 * @param {typeof HTMLElement} Class
 */
function defineElement(tag, Class) {
    if (!customElements.get(tag)) {
        customElements.define(tag, Class);
    }
}

/**
 * @param {import('../services/core/core.js').Core} core
 * @param {string} name
 * @param {Record<string, Function>} impl
 */
function registerMockService(core, name, impl) {
    core.registerService(name, class MockService {
        constructor() {
            Object.assign(this, impl);
        }
    });
}

/**
 * @param {Element} router
 * @param {string} tag
 * @returns {Element|null}
 */
function findChildTag(router, tag) {
    return Array.from(router.children).find((child) => child.tagName.toLowerCase() === tag) ?? null;
}

/** @returns {Promise<void>} */
function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
    bootCore();
});

test('ensure success renders the route component', async () => {
    class StablePage extends HTMLElement {}
    class TargetPage extends HTMLElement {}
    defineElement('stable-page', StablePage);
    defineElement('target-page', TargetPage);

    const logCalls = [];
    const core = globalThis.$core;
    registerMockService(core, 'log', { error: (payload) => logCalls.push(payload) });
    registerMockService(core, 'config', {
        getRelativePath: () => '/target',
        getRoute: (name) => (name === 'target' ? '/target' : '/stable'),
    });
    registerMockService(core, 'components', {
        ensure: async (tag) => {
            assert.ok(['stable-page', 'target-page'].includes(tag));
        },
    });

    const router = new Core_Router();
    router.addRoute({ routeName: 'stable', route: '/stable', tagName: 'stable-page', isDefault: true });
    router.addRoute({ routeName: 'target', route: '/target', tagName: 'target-page' });

    router.processRouteFound('/stable', router.routes[0]);
    await flushPromises();
    assert.ok(findChildTag(router, 'stable-page'));

    router.processRouteFound('/target', router.routes[1]);
    await flushPromises();

    assert.equal(findChildTag(router, 'stable-page'), null);
    assert.ok(findChildTag(router, 'target-page'));
    assert.equal(logCalls.length, 0);
});

test('ensure rejection logs, emits one event, and keeps the current view', async () => {
    class StablePage extends HTMLElement {}
    defineElement('stable-page-b', StablePage);

    const logCalls = [];
    const loadError = new Error('chunk missing');
    const events = [];
    const core = globalThis.$core;

    registerMockService(core, 'log', { error: (payload) => logCalls.push(payload) });
    registerMockService(core, 'config', {
        getRelativePath: () => '/broken',
        getRoute: (routeName) => (routeName === 'broken' ? '/broken' : '/stable'),
    });
    registerMockService(core, 'components', {
        ensure: (tag) => {
            if (tag === 'missing-page') {
                return Promise.reject(loadError);
            }
            return Promise.resolve();
        },
    });

    document.addEventListener(Core_Router.COMPONENT_LOAD_ERROR_EVENT, (event) => {
        events.push(event);
    });

    const router = new Core_Router();
    router.addRoute({ routeName: 'stable', route: '/stable', tagName: 'stable-page-b', isDefault: true });
    router.addRoute({ routeName: 'broken', route: '/broken', tagName: 'missing-page' });

    router.processRouteFound('/stable', router.routes[0]);
    await flushPromises();
    const stableChild = findChildTag(router, 'stable-page-b');
    assert.ok(stableChild);

    router.processRouteFound('/broken', router.routes[1]);
    await flushPromises();

    assert.equal(events.length, 1);
    assert.equal(events[0].type, Core_Router.COMPONENT_LOAD_ERROR_EVENT);
    assert.equal(events[0].detail.tag, 'missing-page');
    assert.equal(events[0].detail.url, '/broken');
    assert.equal(events[0].detail.route, 'broken');
    assert.equal(events[0].detail.error, loadError);

    assert.equal(logCalls.length, 1);
    assert.deepEqual(logCalls[0], {
        event: Core_Router.COMPONENT_LOAD_ERROR_EVENT,
        message: 'Router component load failed',
        tag: 'missing-page',
        url: '/broken',
        route: 'broken',
        errorName: 'Error',
        errorMessage: 'chunk missing',
    });

    assert.equal(findChildTag(router, 'stable-page-b'), stableChild);
    assert.equal(findChildTag(router, 'missing-page'), null);
});

test('ensure rejection does not leave an unhandled rejection', async () => {
    class StablePage extends HTMLElement {}
    defineElement('stable-page-c', StablePage);

    const unhandled = [];
    const previous = process.listeners('unhandledRejection');
    process.removeAllListeners('unhandledRejection');
    process.on('unhandledRejection', (reason) => unhandled.push(reason));

    try {
        const core = globalThis.$core;
        registerMockService(core, 'log', { error: () => {} });
        registerMockService(core, 'config', {
            getRelativePath: () => '/broken',
            getRoute: (name) => (name === 'broken' ? '/broken' : '/stable'),
        });
        registerMockService(core, 'components', {
            ensure: (tag) => {
                if (tag === 'missing-page-c') {
                    return Promise.reject(new Error('load failed'));
                }
                return Promise.resolve();
            },
        });

        const router = new Core_Router();
        router.addRoute({ routeName: 'stable', route: '/stable', tagName: 'stable-page-c', isDefault: true });
        router.addRoute({ routeName: 'broken', route: '/broken', tagName: 'missing-page-c' });

        router.processRouteFound('/stable', router.routes[0]);
        await flushPromises();
        router.processRouteFound('/broken', router.routes[1]);
        await flushPromises();

        assert.equal(unhandled.length, 0);
    } finally {
        process.removeAllListeners('unhandledRejection');
        previous.forEach((listener) => process.on('unhandledRejection', listener));
    }
});
