import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Core } from '../services/core/core.js';
import { bootCore } from './support/platform-harness.mjs';

test('Core registry contract', async (t) => {
    const core = bootCore();

    await t.test('registerService() stores a service entry', () => {
        class ProbeService {
            static created = false;

            constructor() {
                ProbeService.created = true;
            }
        }

        core.registerService('probe', ProbeService);
        assert.equal(ProbeService.created, false, 'service must not instantiate on register');
    });

    await t.test('getService() lazy-instantiates on first access', () => {
        let constructed = false;

        class LazyService {
            constructor() {
                constructed = true;
            }
        }

        core.registerService('lazyProbe', LazyService);
        assert.equal(constructed, false);
        core.getService('lazyProbe');
        assert.equal(constructed, true);
    });

    await t.test('getService() returns a single instance per service', () => {
        const first = core.getService('config');
        const second = core.getService('config');
        assert.equal(first, second);
    });

    await t.test('registerService() override before first getService() wins', () => {
        class ServiceA {
            id = 'A';
        }

        class ServiceB {
            id = 'B';
        }

        core.registerService('overrideProbe', ServiceA);
        core.registerService('overrideProbe', ServiceB);
        assert.equal(core.getService('overrideProbe').id, 'B');
    });

    await t.test('unknown service throws Error', () => {
        assert.throws(
            () => core.getService('missing-service-xyz'),
            (error) => error instanceof Error && /Core service not found : \[missing-service-xyz\]/.test(error.message)
        );
    });

    await t.test('$svc() delegates to $core.getService()', () => {
        const viaCore = core.getService('log');
        const viaGlobal = globalThis.$svc('log');
        assert.equal(viaGlobal, viaCore);
    });

    await t.test('Core constructor is a singleton', () => {
        const again = new Core();
        assert.equal(again, core);
    });
});
