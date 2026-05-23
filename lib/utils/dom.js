/**
 * DOM helpers for Core_HTMLElement / custom element rendering.
 * Import directly or use via $svc('dom') when AppCore is bootstrapped.
 *
 * SECURITY: use `trustedHtml` / `mountTrustedHtml` only for author-controlled markup
 * (compiled templates, static UI fragments). Never pass user input or API data — use `text`.
 */

/**
 * Creates a DOM element with optional class, text, attributes and children.
 *
 * @param {string} tag
 * @param {{ className?: string, text?: string, trustedHtml?: string, attrs?: Record<string, string|boolean>, children?: Node[] }} [options]
 * @param {string} [options.text] Plain text — safe for user or API content.
 * @param {string} [options.trustedHtml] Author-controlled HTML only — never user input.
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.className) {
        el.className = options.className;
    }
    if (options.text != null && options.text !== '') {
        el.textContent = options.text;
    }
    if (options.trustedHtml) {
        el.innerHTML = options.trustedHtml;
    }
    if (options.attrs) {
        Object.entries(options.attrs).forEach(([name, value]) => {
            if (value === false || value == null) {
                return;
            }
            if (value === true) {
                el.setAttribute(name, '');
            } else {
                el.setAttribute(name, String(value));
            }
        });
    }
    (options.children || []).forEach((child) => {
        if (child) {
            el.appendChild(child);
        }
    });
    return el;
}

/**
 * Appends parsed HTML fragment nodes into a parent element.
 * The HTML string must be author-controlled — never user or API content.
 *
 * @param {HTMLElement} parent
 * @param {string} trustedHtml Author-controlled HTML only.
 */
export function mountTrustedHtml(parent, trustedHtml) {
    if (!trustedHtml) {
        return;
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = trustedHtml;
    while (wrap.firstChild) {
        parent.appendChild(wrap.firstChild);
    }
}

/**
 * Reads a boolean host attribute (present and not "false").
 *
 * @param {HTMLElement} el
 * @param {string} name
 * @returns {boolean}
 */
export function hasBoolAttr(el, name) {
    if (!el.hasAttribute(name)) {
        return false;
    }
    const value = el.getAttribute(name);
    return value === '' || value === 'true';
}

/**
 * Parses a JSON attribute safely.
 *
 * @param {HTMLElement} el
 * @param {string} name
 * @param {*} fallback
 * @returns {*}
 */
export function parseJsonAttr(el, name, fallback = []) {
    const raw = el.getAttribute(name);
    if (!raw) {
        return fallback;
    }
    try {
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
}

/**
 * Mirrors listed attributes from host to a child element.
 *
 * @param {HTMLElement} host
 * @param {HTMLElement} target
 * @param {string[]} names
 */
export function mirrorAttributes(host, target, names) {
    names.forEach((name) => {
        if (host.hasAttribute(name)) {
            target.setAttribute(name, host.getAttribute(name) || '');
        } else {
            target.removeAttribute(name);
        }
    });
}

/**
 * Registers a custom element only if the tag is not already defined.
 *
 * @param {string} tagName
 * @param {typeof HTMLElement} Class
 */
export function registerCustomElement(tagName, Class) {
    if (!customElements.get(tagName)) {
        customElements.define(tagName, Class);
    }
}
