import { ajax } from 'rxjs/ajax';
import { map, catchError, of } from 'rxjs';

export class Core_AjaxService {

   constructor() {
   }

   /**
    * Sends a PUT request with a JSON body.
    * @param {string} url The endpoint URL.
    * @param {*} body The request payload.
    */
   put(url, body) {
      return ajax({
         url: this.mapURL(url),
         method: 'PUT',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify(body)
      }).pipe(
         map(response => response.response),
         catchError(error => this.handleError(error))
      );
   }

   /**
    * Sends a POST request with a JSON body and returns the parsed response.
    * @param {string} url The endpoint URL.
    * @param {*} body The request payload.
    */
   getJSON(url, body) {
      return ajax({
         url: this.mapURL(url),
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         body: JSON.stringify(body)
      }).pipe(
         map(response => response.response),
         catchError(error => this.handleError(error))
      );
   }

   /**
    * Sends a GET request.
    * @param {string} url The endpoint URL.
    * @param {Object} [headers={}] Optional headers.
    */
   get(url, headers = {}) {
      return ajax({
         url: this.mapURL(url),
         method: 'GET',
         headers: {
            'Content-Type': 'application/json',
            ...headers
         }
      }).pipe(
         map(response => response.response),
         catchError(error => this.handleError(error))
      );
   }

   /**
    * Sends a DELETE request.
    * @param {string} url The endpoint URL.
    * @param {Object} [headers={}] Optional headers.
    */
   delete(url, headers = {}) {
      return ajax({
         url: this.mapURL(url),
         method: 'DELETE',
         headers: {
            'Content-Type': 'application/json',
            ...headers
         }
      }).pipe(
         map(response => response.response),
         catchError(error => this.handleError(error))
      );
   }

   /**
    * Sends a PATCH request with a JSON body.
    * @param {string} url The endpoint URL.
    * @param {*} body The request payload.
    * @param {Object} [headers={}] Optional headers.
    */
   patch(url, body, headers = {}) {
      return ajax({
         url: this.mapURL(url),
         method: 'PATCH',
         headers: {
            'Content-Type': 'application/json',
            ...headers
         },
         body: JSON.stringify(body)
      }).pipe(
         map(response => response.response),
         catchError(error => this.handleError(error))
      );
   }

   /**
    * Handles errors for all AJAX requests.
    * Override this method to customize error handling.
    * @param {*} error The error object.
    * @returns {Observable} An observable with the error.
    */
   handleError(error) {
      console.log(error);
      return of(error);
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
}