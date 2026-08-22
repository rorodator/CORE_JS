import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { Core_RouterService } from '../services/core/core-router-service.js';
import { createAnchorClick } from './support/dom-events.mjs';
import { bootCore } from './support/platform-harness.mjs';

/** @returns {{ routeCalls: number }} */
function createMockRouter() {
    return {
        routeCalls: 0,
        route() {
            this.routeCalls += 1;
        },
    };
}

beforeEach(() => {
    globalThis.__historyCalls.length = 0;
    Core_RouterService.router = null;
    bootCore();
});

test('manageLink intercepts internal links when a router is registered', () => {
    const routerSvc = new Core_RouterService();
    const mockRouter = createMockRouter();
    routerSvc.router = mockRouter;

    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/journeys');
    document.body.appendChild(anchor);

    const event = createAnchorClick(anchor);
    Core_RouterService.manageLink(event);

    assert.equal(event.defaultPrevented, true);
    assert.equal(globalThis.__historyCalls.length, 1);
    assert.equal(globalThis.__historyCalls[0].url, '/journeys');
    assert.equal(mockRouter.routeCalls, 1);
});

test('manageLink bypasses modifier clicks', () => {
    const mockRouter = createMockRouter();
    Core_RouterService.router = mockRouter;

    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/journeys');
    document.body.appendChild(anchor);

    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }]) {
        globalThis.__historyCalls.length = 0;
        mockRouter.routeCalls = 0;
        const event = createAnchorClick(anchor, init);
        Core_RouterService.manageLink(event);
        assert.equal(event.defaultPrevented, false);
        assert.equal(globalThis.__historyCalls.length, 0);
        assert.equal(mockRouter.routeCalls, 0);
    }
});

test('manageLink bypasses non-primary buttons', () => {
    const mockRouter = createMockRouter();
    Core_RouterService.router = mockRouter;

    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/journeys');
    document.body.appendChild(anchor);

    const event = createAnchorClick(anchor, { button: 1 });
    Core_RouterService.manageLink(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(globalThis.__historyCalls.length, 0);
});

test('manageLink bypasses target=_blank and target=_new', () => {
    const mockRouter = createMockRouter();
    Core_RouterService.router = mockRouter;

    for (const target of ['_blank', '_new']) {
        globalThis.__historyCalls.length = 0;
        const anchor = document.createElement('a');
        anchor.setAttribute('href', '/journeys');
        anchor.setAttribute('target', target);
        document.body.appendChild(anchor);

        const event = createAnchorClick(anchor);
        Core_RouterService.manageLink(event);
        assert.equal(event.defaultPrevented, false);
        assert.equal(globalThis.__historyCalls.length, 0);
        anchor.remove();
    }
});

test('manageLink bypasses download links', () => {
    const mockRouter = createMockRouter();
    Core_RouterService.router = mockRouter;

    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/files/report.pdf');
    anchor.setAttribute('download', '');
    document.body.appendChild(anchor);

    const event = createAnchorClick(anchor);
    Core_RouterService.manageLink(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(globalThis.__historyCalls.length, 0);
});

test('manageLink bypasses special protocols and external URLs', () => {
    const mockRouter = createMockRouter();
    Core_RouterService.router = mockRouter;

    const hrefs = [
        '#section',
        'mailto:test@example.com',
        'tel:+33123456789',
        'javascript:void(0)',
        'https://example.com/page',
        'http://example.com/page',
        '//cdn.example.com/asset.js',
    ];

    for (const href of hrefs) {
        globalThis.__historyCalls.length = 0;
        const anchor = document.createElement('a');
        anchor.setAttribute('href', href);
        document.body.appendChild(anchor);

        const event = createAnchorClick(anchor);
        Core_RouterService.manageLink(event);
        assert.equal(event.defaultPrevented, false, `expected bypass for ${href}`);
        assert.equal(globalThis.__historyCalls.length, 0, `expected no pushState for ${href}`);
        anchor.remove();
    }
});

test('manageLink bypasses data-core-ignore-router', () => {
    const mockRouter = createMockRouter();
    Core_RouterService.router = mockRouter;

    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/journeys');
    anchor.setAttribute('data-core-ignore-router', '');
    document.body.appendChild(anchor);

    const event = createAnchorClick(anchor);
    Core_RouterService.manageLink(event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(globalThis.__historyCalls.length, 0);
});

test('pushState() updates history and routes when router is registered', () => {
    const mockRouter = createMockRouter();
    Core_RouterService.router = mockRouter;

    Core_RouterService.pushState('settings');

    assert.equal(globalThis.__historyCalls.length, 1);
    assert.equal(globalThis.__historyCalls[0].url, '/settings');
    assert.equal(mockRouter.routeCalls, 1);
});

test('pushState() maps empty url to default emptyURL', () => {
    const mockRouter = createMockRouter();
    Core_RouterService.router = mockRouter;

    Core_RouterService.pushState('');

    assert.equal(globalThis.__historyCalls[0].url, '/home');
});

test('goTo() uses pushState when router is registered', () => {
    const mockRouter = createMockRouter();
    Core_RouterService.router = mockRouter;
    const routerSvc = new Core_RouterService();

    routerSvc.goTo('profile');

    assert.equal(globalThis.__historyCalls.length, 1);
    assert.equal(globalThis.__historyCalls[0].url, '/profile');
    assert.equal(mockRouter.routeCalls, 1);
});

test('goTo() falls back to window.location without router', () => {
    const routerSvc = new Core_RouterService();

    routerSvc.goTo('/external');

    assert.equal(globalThis.location.href, '/external');
});

test('unregistering router removes listeners', () => {
    const routerSvc = new Core_RouterService();
    const mockRouter = createMockRouter();

    routerSvc.router = mockRouter;

    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/journeys');
    document.body.appendChild(anchor);

    anchor.dispatchEvent(createAnchorClick(anchor));
    assert.equal(mockRouter.routeCalls, 1);

    globalThis.__historyCalls.length = 0;
    mockRouter.routeCalls = 0;
    routerSvc.router = null;

    anchor.dispatchEvent(createAnchorClick(anchor));
    assert.equal(mockRouter.routeCalls, 0);
    assert.equal(globalThis.__historyCalls.length, 0);
});
