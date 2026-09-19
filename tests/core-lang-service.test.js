import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { filter, firstValueFrom } from 'rxjs';
import { Core_LangService } from '../services/utils/core-lang-service.js';
import {
    resetAjaxMock,
    setAjaxBehavior,
} from './support/ajax-mock.mjs';
import { bootCore } from './support/platform-harness.mjs';

/** @type {Record<string, Record<string, string>>} */
const TEST_LABELS = {
    global: {
        hostLabel: 'Host label',
        nestedLabel: 'Nested label',
        attrValue: 'Placeholder text',
        richHtml: '<strong>Bold</strong>',
    },
    auth: {
        logout: 'Logout',
        account: 'Account',
    },
};

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
 * Loads language data through the normal ajax path so process() can run.
 *
 * @returns {Promise<Core_LangService>}
 */
async function initLang() {
    resetAjaxMock();
    bootCore();
    registerMockService(globalThis.$core, 'resource', {
        lock: () => true,
        unlock: () => {},
    });
    setAjaxBehavior(() => ({
        status: 200,
        statusText: 'OK',
        response: {
            status: 'SUCCESS',
            data: { labels: TEST_LABELS },
        },
    }));

    const lang = /** @type {Core_LangService} */ (globalThis.$svc('lang'));
    await firstValueFrom(lang.getData().pipe(filter((data) => data !== null)));
    return lang;
}

beforeEach(() => {
    document.body.replaceChildren();
});

test('process(root) applies data-core-lang on the root element itself', async () => {
    const lang = await initLang();
    const root = document.createElement('span');
    root.setAttribute(
        'data-core-lang',
        JSON.stringify({ container: 'global', name: 'hostLabel' })
    );
    document.body.append(root);

    lang.process(root);

    assert.equal(root.textContent, 'Host label');
});

test('process(root) applies data-core-lang on descendants', async () => {
    const lang = await initLang();
    const wrapper = document.createElement('div');
    const nested = document.createElement('span');
    nested.setAttribute(
        'data-core-lang',
        JSON.stringify({ container: 'global', name: 'nestedLabel' })
    );
    wrapper.append(nested);
    document.body.append(wrapper);

    lang.process(wrapper);

    assert.equal(nested.textContent, 'Nested label');
});

test('process(root) updates both root and descendant hooks', async () => {
    const lang = await initLang();
    const host = document.createElement('core-menu-item');
    host.setAttribute(
        'data-core-lang',
        JSON.stringify({ container: 'auth', name: 'account', child: '.label' })
    );
    const label = document.createElement('span');
    label.className = 'label';
    host.append(label);

    const sibling = document.createElement('span');
    sibling.setAttribute(
        'data-core-lang',
        JSON.stringify({ container: 'auth', name: 'logout' })
    );
    host.append(sibling);

    document.body.append(host);

    lang.process(host);

    assert.equal(label.textContent, 'Account');
    assert.equal(sibling.textContent, 'Logout');
});

test('process(root) honors child selector when data-core-lang is on the root', async () => {
    const lang = await initLang();
    const host = document.createElement('core-menu-item');
    host.setAttribute(
        'data-core-lang',
        JSON.stringify({ container: 'auth', name: 'logout', child: '.label' })
    );
    const label = document.createElement('span');
    label.className = 'label';
    host.append(label);
    document.body.append(host);

    lang.process(host);

    assert.equal(label.textContent, 'Logout');
    assert.equal(host.textContent, 'Logout');
});

test('process(root) keeps attribute and plain text semantics', async () => {
    const lang = await initLang();
    const input = document.createElement('input');
    input.setAttribute(
        'data-core-lang',
        JSON.stringify({
            container: 'global',
            name: 'attrValue',
            attribute: 'placeholder',
        })
    );
    const text = document.createElement('span');
    text.setAttribute(
        'data-core-lang',
        JSON.stringify({ container: 'global', name: 'nestedLabel' })
    );
    document.body.append(input, text);

    lang.process(document.body);

    assert.equal(input.getAttribute('placeholder'), 'Placeholder text');
    assert.equal(text.textContent, 'Nested label');
});

test('process(root) does not recurse when attribute translation matches observed host attribute', async () => {
    const lang = await initLang();
    const tag = 'test-lang-attr-host-f967';
    let attributeChangedCount = 0;
    if (!customElements.get(tag)) {
        customElements.define(tag, class extends HTMLElement {
            static get observedAttributes() {
                return ['label'];
            }

            attributeChangedCallback() {
                attributeChangedCount += 1;
                this.render();
            }

            connectedCallback() {
                this.render();
            }

            render() {
                globalThis.$svc('lang').process(this);
            }
        });
    }

    const host = document.createElement(tag);
    host.setAttribute(
        'data-core-lang',
        JSON.stringify({
            container: 'global',
            name: 'hostLabel',
            attribute: 'label',
        })
    );
    document.body.append(host);

    assert.doesNotThrow(() => {
        lang.process(host);
        lang.process(host);
    });
    assert.equal(host.getAttribute('label'), 'Host label');
    assert.equal(attributeChangedCount, 1);
});

test('process(root) keeps rich translation semantics', async () => {
    const lang = await initLang();
    const rich = document.createElement('div');
    rich.setAttribute(
        'data-core-lang',
        JSON.stringify({ container: 'global', name: 'richHtml', rich: true })
    );
    document.body.append(rich);

    lang.process(rich);

    assert.equal(rich.innerHTML, '<strong>Bold</strong>');
});
