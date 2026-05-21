import {
    createElement,
    hasBoolAttr,
    mirrorAttributes,
    mountHtml,
    parseJsonAttr,
    registerCustomElement
} from '../../lib/utils/dom.js';

/**
 * DOM utilities exposed as a Core service ($svc('dom')).
 */
export class Core_DomService {

    createElement(tag, options) {
        return createElement(tag, options);
    }

    mountHtml(parent, html) {
        mountHtml(parent, html);
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
