import {
    createElement,
    hasBoolAttr,
    mirrorAttributes,
    mountTrustedHtml,
    parseJsonAttr,
    registerCustomElement
} from '../../lib/utils/dom.js';

/**
 * DOM utilities exposed as a Core service ($svc('dom')).
 * See lib/utils/dom.js for trusted-HTML vs plain-text conventions.
 */
export class Core_DomService {

    createElement(tag, options) {
        return createElement(tag, options);
    }

    mountTrustedHtml(parent, trustedHtml) {
        mountTrustedHtml(parent, trustedHtml);
    }

    hasBoolAttr(el, name) {
        return hasBoolAttr(el, name);
    }

    parseJsonAttr(el, name, fallback) {
        return parseJsonAttr(el, name, fallback);
    }

    mirrorAttributes(host, target, names) {
        mirrorAttributes(host, target, names);
    }

    registerCustomElement(tagName, Class) {
        registerCustomElement(tagName, Class);
    }
}
