import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { Core_Router } from '../lib/routing/core-router.js';
import { Core_RouterService } from '../services/core/core-router-service.js';
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

/**
 * @param {Record<string, string>} routes routeName → path pattern
 * @param {{ baseUrl?: string }} [options]
 */
function configureRoutes(routes, options = {}) {
    const config = $svc('config');
    config.setBaseUrl(options.baseUrl ?? '/');
    config.setRoutes(routes);
}

/**
 * @param {Core_Router} router
 * @param {Record<string, { tagName: string, isDefault?: boolean }>} routeTags
 */
function registerTagRoutes(router, routeTags) {
    for (const [routeName, meta] of Object.entries(routeTags)) {
        router.addRoute({
            routeName,
            route: $svc('config').getRoute(routeName),
            tagName: meta.tagName,
            isDefault: meta.isDefault === true,
        });
    }
}

/**
 * @param {Record<string, Function>} impl
 */
function registerMockComponents(impl) {
    globalThis.$core.registerService('components', class MockComponents {
        constructor() {
            Object.assign(this, impl);
        }
    });
}

/**
 * @param {Core_Router} router
 * @param {{ href?: string, paramURL?: string }} [options]
 */
async function seedRouter(router, options = {}) {
    if (options.href) {
        globalThis.location.href = options.href;
    }
    if (options.paramURL) {
        router.route(options.paramURL);
    } else {
        router.route();
    }
    await flushPromises();
}

beforeEach(() => {
    globalThis.__historyCalls.length = 0;
    Core_RouterService.router = null;
    globalThis.location.href = 'http://localhost/';
    bootCore();
    configureRoutes({
        explore: '/explore',
        journeys: '/journeys',
    });
});

afterEach(() => {
    Core_RouterService.router = null;
});

test('goTo adds query on same route — same component instance and one routeChanged', async () => {
    class ExplorePage extends HTMLElement {}
    defineElement('explore-page', ExplorePage);

    const ensureCalls = [];
    registerMockComponents({
        ensure: async (tag) => {
            ensureCalls.push(tag);
        },
    });

    const routeEvents = [];
    document.addEventListener('routeChanged', (event) => routeEvents.push(event));

    const router = new Core_Router();
    registerTagRoutes(router, { explore: { tagName: 'explore-page', isDefault: true } });
    globalThis.location.href = 'http://localhost/explore';
    await seedRouter(router);
    const firstInstance = findChildTag(router, 'explore-page');
    assert.ok(firstInstance);
    assert.equal(ensureCalls.length, 1);
    assert.equal(routeEvents.length, 1);

    const routerSvc = new Core_RouterService();
    routerSvc.router = router;
    routeEvents.length = 0;
    Core_RouterService.pushState('/explore?q=trail');
    await flushPromises();

    assert.equal(globalThis.__historyCalls.length, 1);
    assert.equal(globalThis.__historyCalls[0].url, '/explore?q=trail');
    assert.equal(window.location.search, '?q=trail');
    assert.equal(findChildTag(router, 'explore-page'), firstInstance);
    assert.equal(ensureCalls.length, 1);
    assert.equal(routeEvents.length, 1);
    assert.equal(routeEvents[0].detail.url, '/explore');
    assert.equal(routeEvents[0].detail.search, '?q=trail');
});

test('query-only change on same route emits once without remounting', async () => {
    class ExplorePage extends HTMLElement {}
    defineElement('explore-page-b', ExplorePage);

    const ensureCalls = [];
    registerMockComponents({
        ensure: async (tag) => ensureCalls.push(tag),
    });

    const routeEvents = [];
    document.addEventListener('routeChanged', (event) => routeEvents.push(event));

    const router = new Core_Router();
    registerTagRoutes(router, { explore: { tagName: 'explore-page-b', isDefault: true } });

    globalThis.location.href = 'http://localhost/explore?q=trail';
    await seedRouter(router);
    const instance = findChildTag(router, 'explore-page-b');
    assert.ok(instance);
    routeEvents.length = 0;

    const routerSvc = new Core_RouterService();
    routerSvc.router = router;
    Core_RouterService.pushState('/explore?q=sewing');
    await flushPromises();

    assert.equal(findChildTag(router, 'explore-page-b'), instance);
    assert.equal(ensureCalls.length, 1);
    assert.equal(routeEvents.length, 1);
    assert.equal(routeEvents[0].detail.search, '?q=sewing');
});

test('identical query-only URL does not emit routeChanged again', async () => {
    class ExplorePage extends HTMLElement {}
    defineElement('explore-page-c', ExplorePage);

    registerMockComponents({ ensure: async () => {} });

    const routeEvents = [];
    document.addEventListener('routeChanged', (event) => routeEvents.push(event));

    const router = new Core_Router();
    registerTagRoutes(router, { explore: { tagName: 'explore-page-c', isDefault: true } });

    globalThis.location.href = 'http://localhost/explore?q=trail';
    await seedRouter(router);
    assert.equal(routeEvents.length, 1);

    const routerSvc = new Core_RouterService();
    routerSvc.router = router;
    Core_RouterService.pushState('/explore?q=trail');
    await flushPromises();
    assert.equal(routeEvents.length, 1);
});

test('popstate query-only history emits routeChanged and preserves component', async () => {
    class ExplorePage extends HTMLElement {}
    defineElement('explore-page-d', ExplorePage);

    registerMockComponents({ ensure: async () => {} });

    const routeEvents = [];
    document.addEventListener('routeChanged', (event) => routeEvents.push(event));

    const router = new Core_Router();
    registerTagRoutes(router, { explore: { tagName: 'explore-page-d', isDefault: true } });

    globalThis.location.href = 'http://localhost/explore';
    await seedRouter(router);
    const instance = findChildTag(router, 'explore-page-d');
    routeEvents.length = 0;

    const routerSvc = new Core_RouterService();
    routerSvc.router = router;
    Core_RouterService.pushState('/explore?q=trail');
    await flushPromises();
    Core_RouterService.pushState('/explore?q=sewing');
    await flushPromises();
    assert.equal(routeEvents.length, 2);

    routeEvents.length = 0;
    globalThis.location.href = 'http://localhost/explore?q=trail';
    Core_RouterService.forceRoute();
    await flushPromises();
    assert.equal(routeEvents.length, 1);
    assert.equal(routeEvents[0].detail.search, '?q=trail');
    assert.equal(findChildTag(router, 'explore-page-d'), instance);

    routeEvents.length = 0;
    globalThis.location.href = 'http://localhost/explore';
    Core_RouterService.forceRoute();
    await flushPromises();
    assert.equal(routeEvents.length, 1);
    assert.equal(routeEvents[0].detail.search, '');

    routeEvents.length = 0;
    globalThis.location.href = 'http://localhost/explore?q=trail';
    Core_RouterService.forceRoute();
    await flushPromises();
    assert.equal(routeEvents.length, 1);
    assert.equal(routeEvents[0].detail.search, '?q=trail');
});

test('different pathname still replaces the route component', async () => {
    class ExplorePage extends HTMLElement {}
    class JourneysPage extends HTMLElement {}
    defineElement('explore-page-e', ExplorePage);
    defineElement('journeys-page-e', JourneysPage);

    registerMockComponents({ ensure: async () => {} });

    const router = new Core_Router();
    registerTagRoutes(router, {
        explore: { tagName: 'explore-page-e', isDefault: true },
        journeys: { tagName: 'journeys-page-e' },
    });

    globalThis.location.href = 'http://localhost/explore?q=trail';
    await seedRouter(router);
    assert.ok(findChildTag(router, 'explore-page-e'));

    const routerSvc = new Core_RouterService();
    routerSvc.router = router;
    Core_RouterService.pushState('/journeys');
    await flushPromises();

    assert.equal(findChildTag(router, 'explore-page-e'), null);
    assert.ok(findChildTag(router, 'journeys-page-e'));
});

test('subrouter explicit paramURL ignores window query for same-match short circuit', async () => {
    class ChildPage extends HTMLElement {}
    defineElement('child-page', ChildPage);

    registerMockComponents({ ensure: async () => {} });

    const routeEvents = [];
    document.addEventListener('routeChanged', (event) => routeEvents.push(event));

    const router = new Core_Router();
    router.addRoute({ routeName: 'child', route: '/child', tagName: 'child-page', isDefault: true });

    globalThis.location.href = 'http://localhost/explore?q=ignored';
    await seedRouter(router, { paramURL: '/child' });
    assert.equal(routeEvents.length, 1);

    routeEvents.length = 0;
    router.route('/child');
    await flushPromises();
    assert.equal(routeEvents.length, 0);
});

test('base path app resolves query-only navigation on stripped pathname', async () => {
    class ExplorePage extends HTMLElement {}
    defineElement('explore-page-f', ExplorePage);

    registerMockComponents({ ensure: async () => {} });

    configureRoutes({ explore: '/explore' }, { baseUrl: '/MyApp' });

    const routeEvents = [];
    document.addEventListener('routeChanged', (event) => routeEvents.push(event));

    const router = new Core_Router();
    registerTagRoutes(router, { explore: { tagName: 'explore-page-f', isDefault: true } });

    globalThis.location.href = 'http://localhost/MyApp/explore';
    await seedRouter(router);
    routeEvents.length = 0;

    const routerSvc = new Core_RouterService();
    routerSvc.router = router;
    Core_RouterService.pushState('/MyApp/explore?q=trail');
    await flushPromises();

    assert.equal($svc('config').getRelativePath(), '/explore');
    assert.equal(routeEvents.length, 1);
    assert.equal(routeEvents[0].detail.url, '/explore');
    assert.equal(routeEvents[0].detail.search, '?q=trail');
});

test('a slower lazy commit cannot overwrite a newer history entry', async () => {
    class ExplorePage extends HTMLElement {}
    class JourneyPage extends HTMLElement {}
    class ProfilePage extends HTMLElement {}
    defineElement('explore-page-stale', ExplorePage);
    defineElement('journey-page-stale', JourneyPage);
    defineElement('profile-page-stale', ProfilePage);

    /** @type {(() => void)|null} */
    let releaseJourney = null;
    const journeyGate = new Promise((resolve) => {
        releaseJourney = resolve;
    });
    registerMockComponents({
        ensure: async (tag) => {
            if (tag === 'journey-page-stale') {
                await journeyGate;
            }
        },
    });

    configureRoutes({
        explore: '/explore',
        journey: '/journey/([A-Z0-9]+)',
        profile: '/people/([A-Z0-9]+)',
    });

    const router = new Core_Router();
    registerTagRoutes(router, {
        explore: { tagName: 'explore-page-stale', isDefault: true },
        journey: { tagName: 'journey-page-stale' },
        profile: { tagName: 'profile-page-stale' },
    });

    globalThis.location.href = 'http://localhost/explore?q=aquarelle';
    await seedRouter(router);
    assert.ok(findChildTag(router, 'explore-page-stale'));

    const routerSvc = new Core_RouterService();
    routerSvc.router = router;

    Core_RouterService.pushState('/journey/JOURNEY1');
    Core_RouterService.pushState('/people/PERSON1');
    await flushPromises();

    assert.equal(window.location.pathname, '/people/PERSON1');
    assert.ok(findChildTag(router, 'profile-page-stale'));
    assert.equal(findChildTag(router, 'journey-page-stale'), null);

    releaseJourney();
    await flushPromises();
    await flushPromises();

    assert.equal(window.location.pathname, '/people/PERSON1');
    assert.ok(findChildTag(router, 'profile-page-stale'));
    assert.equal(findChildTag(router, 'journey-page-stale'), null);

    globalThis.location.href = 'http://localhost/journey/JOURNEY1';
    Core_RouterService.forceRoute();
    await journeyGate;
    await flushPromises();
    assert.equal(window.location.pathname, '/journey/JOURNEY1');
    assert.ok(findChildTag(router, 'journey-page-stale'));
    assert.equal(findChildTag(router, 'profile-page-stale'), null);

    globalThis.location.href = 'http://localhost/explore?q=aquarelle';
    Core_RouterService.forceRoute();
    await flushPromises();
    assert.equal(window.location.pathname, '/explore');
    assert.equal(window.location.search, '?q=aquarelle');
    assert.ok(findChildTag(router, 'explore-page-stale'));
    assert.equal(findChildTag(router, 'journey-page-stale'), null);
});
