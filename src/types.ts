export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface AuraRequestContext {
  url: string;
  init: RequestInit;
}

export interface AuraRequestConfig<TResponse = unknown> {
  url: string;
  baseURL?: string;
  method?: HttpMethod;
  headers?: HeadersInit;
  /**
   * Data to send in the request body. Objects will be JSON-stringified
   * when the content type is JSON or not specified.
   */
  data?: unknown;
  /**
   * Optional signal to cancel the request.
   */
  signal?: AbortSignal;
  /**
   * Timeout in milliseconds. Uses AbortSignal.timeout under the hood.
   */
  timeout?: number;
  /**
   * Validate and transform the parsed response data.
   * Ideal for Zod/Valibot schema parsing.
   */
  validate?: (data: unknown) => TResponse;
}

export interface AuraResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Headers;
  /**
   * The parsed response payload. Unknown by default, but can be typed
   * using generics or narrowed via the validate hook.
   */
  data: T;
  /**
   * The underlying Fetch Response object for advanced use cases.
   */
  raw: Response;
  /**
   * Original request configuration.
   */
  config: AuraRequestConfig<T>;
}

export interface AuraErrorDetails<T = unknown> {
  message: string;
  cause?: unknown;
  config?: AuraRequestConfig<T>;
  request?: AuraRequestContext;
  response?: AuraResponse<T>;
}

export type RequestInterceptor<T = unknown> = (
  config: AuraRequestConfig<T>,
) => Promise<AuraRequestConfig<T>> | AuraRequestConfig<T>;

export type ResponseInterceptor<T = unknown> = (
  response: AuraResponse<T>,
) => Promise<AuraResponse<T>> | AuraResponse<T>;

export type ErrorInterceptor = (error: unknown) => Promise<never> | never;

export interface InterceptorPair<T = unknown> {
  onFulfilled?: (value: T) => T | Promise<T>;
  onRejected?: (error: unknown) => unknown | Promise<unknown>;
}

export interface AuraOptions {
  baseURL?: string;
  headers?: HeadersInit;
}

export class InterceptorManager<T> {
  private handlers: InterceptorPair<T>[] = [];

  use(
    onFulfilled?: (value: T) => T | Promise<T>,
    onRejected?: (error: unknown) => unknown | Promise<unknown>,
  ): number {
    this.handlers.push({ onFulfilled, onRejected });
    return this.handlers.length - 1;
  }

  eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = { onFulfilled: undefined, onRejected: undefined };
    }
  }

  forEach(
    fn: (handler: Required<InterceptorPair<T>> | InterceptorPair<T>) => void,
  ): void {
    for (const h of this.handlers) {
      if (h.onFulfilled || h.onRejected) {
        fn(h);
      }
    }
  }
}
