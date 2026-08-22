import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Core_ComponentLoaderService } from '../services/utils/component-loader-service.js';

test('ensure() resolves when the element is already defined', async () => {
    class ExistingElement extends HTMLElement {}
    customElements.define('existing-element', ExistingElement);

    const loader = new Core_ComponentLoaderService();
    await loader.ensure('existing-element');
});

test('ensure() loads via a function loader and defines the element', async () => {
    const loader = new Core_ComponentLoaderService();
    let loaded = false;

    loader.register('lazy-element', async () => {
        loaded = true;
        customElements.define('lazy-element', class extends HTMLElement {});
    });

    assert.equal(customElements.get('lazy-element'), undefined);
    await loader.ensure('lazy-element');
    assert.equal(loaded, true);
    assert.notEqual(customElements.get('lazy-element'), undefined);
});

test('ensure() throws when no mapping exists', async () => {
    const loader = new Core_ComponentLoaderService();

    await assert.rejects(
        () => loader.ensure('missing-element'),
        (error) => error instanceof Error && /No import mapping for <missing-element>/.test(error.message)
    );
});

test('registerMany() registers multiple tags', async () => {
    const loader = new Core_ComponentLoaderService();

    loader.registerMany({
        'batch-a': async () => {
            customElements.define('batch-a', class extends HTMLElement {});
        },
        'batch-b': async () => {
            customElements.define('batch-b', class extends HTMLElement {});
        },
    });

    await loader.ensure('batch-a');
    await loader.ensure('batch-b');
    assert.notEqual(customElements.get('batch-a'), undefined);
    assert.notEqual(customElements.get('batch-b'), undefined);
});
