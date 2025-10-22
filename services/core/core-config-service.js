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
        // Call environment detection - can be overridden by child classes
        this.detectEnvironment();
    }

    /**
     * Get the base URL for the application
     * @returns {string} The base URL
     */
    getBaseUrl() {
        return this.#config.baseUrl;
    }

    /**
     * Set the base URL for the application
     * @param {string} baseUrl - The base URL to set
     */
    setBaseUrl(baseUrl) {
        this.#config.baseUrl = baseUrl;
    }

    /**
     * Extract relative path from full pathname
     * Removes the baseUrl from the pathname to get the relative path
     * @param {string} pathname - Full pathname (e.g., '/MyManager/team/search-test')
     * @returns {string} Relative path (e.g., '/team/search-test')
     */
    getRelativePath(pathname = null) {
        const fullPath = pathname || window.location.pathname;
        const baseUrl = this.#config.baseUrl;
        
        // If baseUrl is not yet initialized or is '/', return the path as is
        if (!baseUrl || baseUrl === '/') {
            return fullPath;
        }
        
        // Remove baseUrl from the beginning of the path
        if (fullPath.startsWith(baseUrl)) {
            return fullPath.substring(baseUrl.length) || '/';
        }
        
        // If baseUrl doesn't match, return the original path
        return fullPath;
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
        
        // If the route starts with the baseUrl, return the relative path
        const baseUrl = this.#config.baseUrl;
        if (baseUrl !== '/' && fullRoute.startsWith(baseUrl)) {
            return fullRoute.substring(baseUrl.length) || '/';
        }
        
        // Otherwise return the route as is
        return fullRoute;
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
}
