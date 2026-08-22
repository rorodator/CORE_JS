import { ajax } from 'rxjs/ajax';
import { map, catchError, throwError } from 'rxjs';

/**
 * Platform AJAX wrapper around RxJS ajax.
 *
 * Convention:
 * - Successful HTTP (2xx): observable emits the parsed response body (including functional statuses).
 * - Transport / HTTP failures: observable errors with a normalized {@link Core_AjaxTransportError}.
 *   Apps handle UX via {@link onTransportError}, `core-ajax-transport-error`, or subscriber `error`.
 */
export class Core_AjaxService {

   static TRANSPORT_ERROR_EVENT = 'core-ajax-transport-error';

   constructor() {
   }

   /**
    * Default request headers. Override in the app Ajax service (CSRF token, client version, request id, …).
    * @param {string} method HTTP method.
    * @returns {Record<string, string>}
    */
   getDefaultHeaders(method) {
      return {
         'X-Requested-With': 'XMLHttpRequest',
      };
   }

   /**
    * Sends a PUT request with a JSON body.
    * @param {string} url The endpoint URL.
    * @param {*} body The request payload.
    * @param {Record<string, string>} [headers={}] Optional extra headers.
    */
   put(url, body, headers = {}) {
      return this.#jsonRequest('PUT', url, body, headers);
   }

   /**
    * Sends a POST request with a JSON body and returns the parsed response.
    * @param {string} url The endpoint URL.
    * @param {*} body The request payload.
    * @param {Record<string, string>} [headers={}] Optional extra headers.
    */
   getJSON(url, body, headers = {}) {
      return this.#jsonRequest('POST', url, body, headers);
   }

   /**
    * Sends a GET request.
    * @param {string} url The endpoint URL.
    * @param {Object} [headers={}] Optional headers.
    */
   get(url, headers = {}) {
      return this.#jsonRequest('GET', url, undefined, headers);
   }

   /**
    * Sends a DELETE request.
    * @param {string} url The endpoint URL.
    * @param {Object} [headers={}] Optional headers.
    */
   delete(url, headers = {}) {
      return this.#jsonRequest('DELETE', url, undefined, headers);
   }

   /**
    * Sends a PATCH request with a JSON body.
    * @param {string} url The endpoint URL.
    * @param {*} body The request payload.
    * @param {Object} [headers={}] Optional headers.
    */
   patch(url, body, headers = {}) {
      return this.#jsonRequest('PATCH', url, body, headers);
   }

   /**
    * Hook for app-level UX (toast, modal, redirect). Default: log + DOM event only.
    * @param {Core_AjaxTransportError} error Normalized transport error.
    */
   onTransportError(error) {
   }

   /**
    * Normalizes and propagates transport errors as RxJS errors.
    * @param {*} error Raw error from RxJS ajax or {@link #mapSuccessfulResponse}.
    * @returns {import('rxjs').Observable<never>}
    */
   handleError(error) {
      const normalized = error?.kind === 'transport'
         ? error
         : this.#normalizeTransportError(error);

      this.#emitTransportError(normalized);
      return throwError(() => normalized);
   }

   /**
    * Maps or transforms the URL before making the request.
    * Override this method if needed.
    * @param {string} url The original URL.
    * @returns {string} The mapped URL.
    */
   mapURL(url) {
      return url;
   }

   /**
    * @param {string} method
    * @param {string} url
    * @param {*} [body]
    * @param {Record<string, string>} [extraHeaders]
    */
   #jsonRequest(method, url, body, extraHeaders = {}) {
      const config = {
         url: this.mapURL(url),
         method,
         headers: {
            ...this.getDefaultHeaders(method),
            'Content-Type': 'application/json',
            ...extraHeaders,
         },
      };

      if (body !== undefined) {
         config.body = JSON.stringify(body);
      }

      return ajax(config).pipe(
         map((response) => this.#mapSuccessfulResponse(response)),
         catchError((error) => this.handleError(error))
      );
   }

   /**
    * @param {import('rxjs/ajax').AjaxResponse} response
    * @returns {*}
    */
   #mapSuccessfulResponse(response) {
      if (response.status >= 200 && response.status < 300) {
         return response.response;
      }

      throw {
         kind: 'transport',
         status: response.status,
         statusText: response.statusText,
         message: this.#httpStatusMessage(response.status, response.statusText),
         response: response.response,
      };
   }

   /**
    * @param {*} error
    * @returns {Core_AjaxTransportError}
    */
   #normalizeTransportError(error) {
      if (error?.xhr) {
         const status = error.xhr.status;
         const statusText = error.xhr.statusText;

         return {
            kind: 'transport',
            status,
            statusText,
            message: this.#httpStatusMessage(status, statusText),
            response: this.#parseXhrResponse(error.xhr),
         };
      }

      return {
         kind: 'transport',
         status: 0,
         statusText: '',
         message: error?.message || 'Network connection failed',
         response: null,
      };
   }

   /**
    * @param {number} status
    * @param {string} statusText
    * @returns {string}
    */
   #httpStatusMessage(status, statusText) {
      switch (status) {
         case 400:
            return 'Bad Request: Invalid data sent to server';
         case 401:
            return 'Unauthorized: Please log in again';
         case 403:
            return 'Forbidden: You do not have permission to perform this action';
         case 404:
            return 'Not Found: The requested resource was not found';
         case 500:
            return 'Internal Server Error: Please try again later';
         case 503:
            return 'Service Unavailable: Server is temporarily unavailable';
         default:
            return status ? `HTTP ${status}: ${statusText}` : 'Network connection failed';
      }
   }

   /**
    * @param {XMLHttpRequest} xhr
    * @returns {*}
    */
   #parseXhrResponse(xhr) {
      const raw = xhr.response;
      if (raw == null || raw === '') {
         return null;
      }
      if (typeof raw === 'object') {
         return raw;
      }
      try {
         return JSON.parse(raw);
      } catch (_) {
         return raw;
      }
   }

   /**
    * @param {Core_AjaxTransportError} error
    */
   #emitTransportError(error) {
      try {
         $svc('log').error({
            event: Core_AjaxService.TRANSPORT_ERROR_EVENT,
            message: 'Ajax transport error',
            kind: error.kind,
            status: error.status,
            statusText: error.statusText,
            errorMessage: error.message,
         });
      } catch (_) {}

      try {
         document.dispatchEvent(new CustomEvent(
            Core_AjaxService.TRANSPORT_ERROR_EVENT,
            { detail: error }
         ));
      } catch (_) {}

      this.onTransportError(error);
   }
}

/**
 * @typedef {Object} Core_AjaxTransportError
 * @property {'transport'} kind
 * @property {number} status HTTP status (0 when unavailable).
 * @property {string} statusText
 * @property {string} message English transport message for logging/fallback UI.
 * @property {*} response Parsed response body when available.
 */
