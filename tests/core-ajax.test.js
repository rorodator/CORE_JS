import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { firstValueFrom } from 'rxjs';
import { Core_AjaxService } from '../services/api/core-ajax-service.js';
import {
    getLastAjaxConfig,
    resetAjaxMock,
    setAjaxBehavior,
} from './support/ajax-mock.mjs';
import { bootCore } from './support/platform-harness.mjs';

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

beforeEach(() => {
    resetAjaxMock();
    bootCore();
});

test('HTTP verbs are configured with JSON defaults', async () => {
    const ajax = new Core_AjaxService();

    setAjaxBehavior(() => ({ status: 200, statusText: 'OK', response: { ok: true } }));

    await firstValueFrom(ajax.get('/api/items'));
    assert.equal(getLastAjaxConfig().method, 'GET');
    assert.equal(getLastAjaxConfig().url, '/api/items');
    assert.equal(getLastAjaxConfig().body, undefined);

    await firstValueFrom(ajax.put('/api/items/1', { name: 'a' }));
    assert.equal(getLastAjaxConfig().method, 'PUT');
    assert.equal(getLastAjaxConfig().body, JSON.stringify({ name: 'a' }));

    await firstValueFrom(ajax.patch('/api/items/1', { name: 'b' }));
    assert.equal(getLastAjaxConfig().method, 'PATCH');

    await firstValueFrom(ajax.delete('/api/items/1'));
    assert.equal(getLastAjaxConfig().method, 'DELETE');
});

test('getJSON() sends POST with a JSON body (legacy naming)', async () => {
    const ajax = new Core_AjaxService();

    setAjaxBehavior(() => ({ status: 200, statusText: 'OK', response: { items: [] } }));

    const body = await firstValueFrom(ajax.getJSON('/api/search', { q: 'hello' }));

    assert.deepEqual(body, { items: [] });
    assert.equal(getLastAjaxConfig().method, 'POST');
    assert.equal(getLastAjaxConfig().url, '/api/search');
    assert.equal(getLastAjaxConfig().body, JSON.stringify({ q: 'hello' }));
});

test('2xx responses emit parsed body', async () => {
    const ajax = new Core_AjaxService();

    setAjaxBehavior(() => ({
        status: 201,
        statusText: 'Created',
        response: { id: 42 },
    }));

    const body = await firstValueFrom(ajax.getJSON('/api', {}));
    assert.deepEqual(body, { id: 42 });
});

test('non-2xx HTTP responses normalize to kind=transport', async () => {
    const ajax = new Core_AjaxService();

    setAjaxBehavior(() => ({
        status: 404,
        statusText: 'Not Found',
        response: { error: 'missing' },
    }));

    await assert.rejects(
        () => firstValueFrom(ajax.get('/api/missing')),
        (error) => {
            assert.equal(error.kind, 'transport');
            assert.equal(error.status, 404);
            assert.equal(error.statusText, 'Not Found');
            assert.match(error.message, /Not Found/);
            assert.deepEqual(error.response, { error: 'missing' });
            return true;
        }
    );
});

test('XHR transport errors normalize to kind=transport', async () => {
    const ajax = new Core_AjaxService();

    setAjaxBehavior(() => ({
        xhr: {
            status: 403,
            statusText: 'Forbidden',
            response: '{"denied":true}',
        },
    }));

    await assert.rejects(
        () => firstValueFrom(ajax.get('/api/forbidden')),
        (error) => {
            assert.equal(error.kind, 'transport');
            assert.equal(error.status, 403);
            assert.equal(error.response.denied, true);
            return true;
        }
    );
});

test('network errors use status 0', async () => {
    const ajax = new Core_AjaxService();

    setAjaxBehavior(() => ({ message: 'Failed to fetch' }));

    await assert.rejects(
        () => firstValueFrom(ajax.get('/api/offline')),
        (error) => {
            assert.equal(error.kind, 'transport');
            assert.equal(error.status, 0);
            assert.match(error.message, /Failed to fetch|Network connection failed/);
            return true;
        }
    );
});

test('getDefaultHeaders() provides platform defaults', () => {
    const ajax = new Core_AjaxService();
    assert.deepEqual(ajax.getDefaultHeaders('GET'), {
        'X-Requested-With': 'XMLHttpRequest',
    });
});

test('extra headers override defaults', async () => {
    const ajax = new Core_AjaxService();

    setAjaxBehavior(() => ({ status: 200, statusText: 'OK', response: null }));

    await firstValueFrom(ajax.get('/api', {
        'X-Requested-With': 'Override',
        'X-Custom': '1',
    }));

    assert.equal(getLastAjaxConfig().headers['X-Requested-With'], 'Override');
    assert.equal(getLastAjaxConfig().headers['X-Custom'], '1');
    assert.equal(getLastAjaxConfig().headers['Content-Type'], 'application/json');
});

test('mapURL() transforms request URLs', async () => {
    class PrefixedAjax extends Core_AjaxService {
        mapURL(url) {
            return `/app${url}`;
        }
    }

    const ajax = new PrefixedAjax();
    setAjaxBehavior(() => ({ status: 200, statusText: 'OK', response: null }));

    await firstValueFrom(ajax.get('/api/ping'));
    assert.equal(getLastAjaxConfig().url, '/app/api/ping');
});

test('transport errors dispatch core-ajax-transport-error', async () => {
    const ajax = new Core_AjaxService();
    /** @type {Array<*>} */
    const seen = [];

    document.addEventListener(Core_AjaxService.TRANSPORT_ERROR_EVENT, (event) => {
        seen.push(event.detail);
    });

    setAjaxBehavior(() => ({ status: 500, statusText: 'Internal Server Error', response: null }));

    await assert.rejects(() => firstValueFrom(ajax.get('/api/boom')));
    assert.equal(seen.length, 1);
    assert.equal(seen[0].kind, 'transport');
    assert.equal(seen[0].status, 500);
});

test('transport errors log a structured payload without response body', async () => {
    const logCalls = [];
    const core = globalThis.$core;
    const SENSITIVE = 'SECRET_TOKEN_DO_NOT_LOG';

    registerMockService(core, 'log', { error: (payload) => logCalls.push(payload) });

    const ajax = new Core_AjaxService();

    setAjaxBehavior(() => ({
        status: 404,
        statusText: 'Not Found',
        response: { error: 'missing', token: SENSITIVE },
    }));

    await assert.rejects(() => firstValueFrom(ajax.get('/api/missing')));

    assert.equal(logCalls.length, 1);
    assert.deepEqual(logCalls[0], {
        event: Core_AjaxService.TRANSPORT_ERROR_EVENT,
        message: 'Ajax transport error',
        kind: 'transport',
        status: 404,
        statusText: 'Not Found',
        errorMessage: 'Not Found: The requested resource was not found',
    });
    assert.equal(logCalls[0].response, undefined);
    assert.doesNotMatch(JSON.stringify(logCalls[0]), new RegExp(SENSITIVE));
});

test('onTransportError() hook receives normalized errors', async () => {
    class HookedAjax extends Core_AjaxService {
        /** @type {Array<*>} */
        transportErrors = [];

        onTransportError(error) {
            this.transportErrors.push(error);
        }
    }

    const ajax = new HookedAjax();
    setAjaxBehavior(() => ({ message: 'offline' }));

    await assert.rejects(() => firstValueFrom(ajax.get('/api/offline')));
    assert.equal(ajax.transportErrors.length, 1);
    assert.equal(ajax.transportErrors[0].kind, 'transport');
    assert.equal(ajax.transportErrors[0].status, 0);
});
