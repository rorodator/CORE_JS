/**
 * Core Configuration Service
 * Provides basic configuration functionality for routing and other core features
 */
export class Core_ConfigService {

    /**
     * Configuration object
     * @private
     */
    #config = {
        baseUrl: '/',
        routes: {},
        environment: 'development'
    };

    constructor() {
        this.detectEnvironment();
    }

    /**
     * Normalizes an application base path for routing and API URL building.
     * Root deployments → '/'. Subpaths → '/Segment' with no trailing slash.
     *
     * @param {string|null|undefined} raw
     * @returns {string}
     */
    static normalizeBaseUrl(raw) {
        if (raw == null) {
            return '/';
        }

        let value = String(raw).trim();
        if (value === '' || value === '/') {
            return '/';
        }

        value = value.replace(/\/+$/, '');
        if (!value.startsWith('/')) {
            value = '/' + value;
        }

        return value;
    }

    /**
     * @returns {string} Normalized base path ('/' at document root, else '/AppName').
     */
    getBaseUrl() {
        return this.#config.baseUrl;
    }

    /**
     * @param {string|null|undefined} baseUrl
     */
    setBaseUrl(baseUrl) {
        this.#config.baseUrl = Core_ConfigService.normalizeBaseUrl(baseUrl);
    }

    /**
     * Extract relative path from full pathname
     * @param {string} [pathname]
     * @returns {string}
     */
    getRelativePath(pathname = null) {
        const fullPath = pathname || window.location.pathname;
        return Core_ConfigService.#stripBasePrefix(fullPath, this.#config.baseUrl);
    }

    /**
     * Get all routes
     * @returns {Object} The routes configuration
     */
    getRoutes() {
        return this.#config.routes;
    }

    /**
     * Set routes configuration
     * @param {Object} routes - The routes to set
     */
    setRoutes(routes) {
        this.#config.routes = routes;
    }

    /**
     * Get a specific route (relative path)
     * @param {string} routeName - The route name
     * @returns {string} The relative route URL
     */
    getRoute(routeName) {
        const fullRoute = this.#config.routes[routeName];
        if (!fullRoute) {
            return '';
        }

        return Core_ConfigService.#stripBasePrefix(fullRoute, this.#config.baseUrl);
    }

    /**
     * Get a specific route (full path with baseUrl)
     * @param {string} routeName - The route name
     * @returns {string} The full route URL
     */
    getFullRoute(routeName) {
        return this.#config.routes[routeName] || '';
    }

    /**
     * Set a specific route
     * @param {string} routeName - The route name
     * @param {string} routeUrl - The route URL
     */
    setRoute(routeName, routeUrl) {
        this.#config.routes[routeName] = routeUrl;
    }

    /**
     * Get the current environment
     * @returns {string} The environment (development/production)
     */
    getEnvironment() {
        return this.#config.environment;
    }

    /**
     * Set the current environment
     * @param {string} environment - The environment to set
     */
    setEnvironment(environment) {
        this.#config.environment = environment;
    }

    /**
     * Check if running in development mode
     * @returns {boolean} True if development
     */
    isDevelopment() {
        return this.#config.environment === 'development';
    }

    /**
     * Check if running in production mode
     * @returns {boolean} True if production
     */
    isProduction() {
        return this.#config.environment === 'production';
    }

    /**
     * Detect environment and configure accordingly
     * This method is called automatically in the constructor
     * Child classes should override this method to implement their own environment detection
     */
    detectEnvironment() {
        // Default implementation - does nothing
        // Child classes can override this method to detect their specific environment
    }

    /**
     * Removes a normalized base prefix from a path (exact segment match only).
     * @param {string} fullPath
     * @param {string} baseUrl
     * @returns {string}
     */
    static #stripBasePrefix(fullPath, baseUrl) {
        if (!fullPath) {
            return '/';
        }

        if (!baseUrl || baseUrl === '/') {
            return fullPath;
        }

        if (fullPath === baseUrl) {
            return '/';
        }

        if (fullPath.startsWith(baseUrl + '/')) {
            return fullPath.slice(baseUrl.length) || '/';
        }

        return fullPath;
    }
}
