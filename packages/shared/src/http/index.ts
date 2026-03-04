/**
 * HTTP Client Module
 *
 * @example
 * import { HttpClient, getHttpClient } from '@bitcoinbaby/shared/http';
 *
 * const client = getHttpClient({
 *   baseUrl: 'https://api.example.com',
 *   timeout: 5000,
 *   maxRetries: 3,
 * });
 *
 * const response = await client.get('/users');
 */

export {
  HttpClient,
  getHttpClient,
  clearHttpClients,
  type HttpClientConfig,
  type RequestOptions,
  type HttpResponse,
} from "./client";
