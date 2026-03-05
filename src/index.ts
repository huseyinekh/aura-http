import {
  AuraRequestConfig,
  AuraResponse,
  HttpMethod,
  InterceptorManager,
  AuraOptions
} from "./types.js";
import { AuraError } from "./error.js";

function isJsonLike(contentType: string | null): boolean {
  if (!contentType) return false;
  const lowered = contentType.toLowerCase();
  return lowered.includes("application/json") || lowered.includes("+json");
}

function normalizeMethod(method?: HttpMethod): HttpMethod {
  return (method ?? "GET").toUpperCase() as HttpMethod;
}

function mergeHeaders(base?: HeadersInit, override?: HeadersInit): Headers {
  const result = new Headers(base);
  if (override) {
    const overrideHeaders = new Headers(override);
    overrideHeaders.forEach((value, key) => {
      result.set(key, value);
    });
  }
  return result;
}

function isAbsoluteUrl(u: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(u);
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

async function buildRequestInit<T>(
  config: AuraRequestConfig<T>,
  baseHeaders?: HeadersInit
): Promise<{ url: string; init: RequestInit }> {
  const method = normalizeMethod(config.method);
  const headers = mergeHeaders(baseHeaders, config.headers);

  const init: RequestInit = {
    method,
    headers
  };

  const hasBody =
    config.data !== undefined &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS";

  if (hasBody) {
    const existingContentType = headers.get("content-type");
    const shouldJsonEncode =
      !existingContentType ||
      existingContentType.toLowerCase().includes("application/json");

    if (shouldJsonEncode && typeof config.data === "object") {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(config.data);
    } else if (typeof config.data === "string" || config.data instanceof Blob) {
      init.body = config.data as BodyInit;
    } else {
      // Fallback: JSON stringify other primitive/unknown values
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(config.data);
    }
  }

  init.headers = headers;

  if (config.timeout != null) {
    const timeoutSignal = AbortSignal.timeout(config.timeout);

    if (config.signal) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      config.signal.addEventListener("abort", abort);
      timeoutSignal.addEventListener("abort", abort);
      init.signal = controller.signal;
    } else {
      init.signal = timeoutSignal;
    }
  } else if (config.signal) {
    init.signal = config.signal;
  }

  return { url: config.url, init };
}

async function parseResponseBody<T>(
  response: Response,
  config: AuraRequestConfig<T>
): Promise<T> {
  const contentType = response.headers.get("content-type");

  let parsed: unknown;

  if (isJsonLike(contentType)) {
    parsed = await response.json();
  } else {
    parsed = await response.text();
  }

  if (config.validate) {
    // Delegate to user-provided validator (e.g. Zod/Valibot schema)
    return config.validate(parsed);
  }

  return parsed as T;
}

export class Aura {
  private readonly options: AuraOptions;
  readonly interceptors = {
    request: new InterceptorManager<AuraRequestConfig<any>>(),
    response: new InterceptorManager<AuraResponse<any>>(),
    error: new InterceptorManager<unknown>()
  };

  constructor(options: AuraOptions = {}) {
    this.options = options;
  }

  async request<T = unknown>(
    config: AuraRequestConfig<T>
  ): Promise<AuraResponse<T>> {
    let chain: Promise<AuraRequestConfig<T>> = Promise.resolve(config);

    // Apply request interceptors
    this.interceptors.request.forEach(({ onFulfilled, onRejected }) => {
      if (onFulfilled || onRejected) {
        chain = chain.then(
          cfg =>
            (onFulfilled
              ? onFulfilled(cfg as AuraRequestConfig<T>)
              : cfg) as Promise<AuraRequestConfig<T>> | AuraRequestConfig<T>,
          error => (onRejected ? onRejected(error) : Promise.reject(error))
        ) as Promise<AuraRequestConfig<T>>;
      }
    });

    const responsePromise = chain.then(async cfg => {
      const base = cfg.baseURL ?? this.options.baseURL;
      const resolvedUrl = isAbsoluteUrl(cfg.url)
        ? cfg.url
        : base
        ? joinUrl(base, cfg.url)
        : cfg.url;
      const cfgWithUrl = { ...cfg, url: resolvedUrl };
      const { url, init } = await buildRequestInit(cfgWithUrl, this.options.headers);
      let raw: Response;

      try {
        raw = await fetch(url, init);
      } catch (cause) {
        throw new AuraError<T>({
          message: "Network error",
          cause,
          config: cfg,
          request: { url, init }
        });
      }

      let data: T;
      try {
        data = await parseResponseBody<T>(raw, cfg);
      } catch (cause) {
        throw new AuraError<T>({
          message: "Failed to parse response body",
          cause,
          config: cfg,
          request: { url, init },
          response: {
            status: raw.status,
            statusText: raw.statusText,
            headers: raw.headers,
            data: undefined as unknown as T,
            raw,
            config: cfg
          }
        });
      }

      const auraResponse: AuraResponse<T> = {
        status: raw.status,
        statusText: raw.statusText,
        headers: raw.headers,
        data,
        raw,
        config: cfg
      };

      if (!raw.ok) {
        throw new AuraError<T>({
          message: `Request failed with status code ${raw.status}`,
          config: cfg,
          request: { url, init },
          response: auraResponse
        });
      }

      return auraResponse;
    });

    // Apply response interceptors
    let finalChain: Promise<AuraResponse<T>> = responsePromise;
    this.interceptors.response.forEach(({ onFulfilled, onRejected }) => {
      if (onFulfilled || onRejected) {
        finalChain = finalChain.then(
          res =>
            (onFulfilled
              ? onFulfilled(res as AuraResponse<T>)
              : res) as Promise<AuraResponse<T>> | AuraResponse<T>,
          error => (onRejected ? onRejected(error) : Promise.reject(error))
        ) as Promise<AuraResponse<T>>;
      }
    });

    finalChain = finalChain.catch(error => {
      let errChain: Promise<unknown> = Promise.reject(error);
      this.interceptors.error.forEach(({ onRejected }) => {
        if (onRejected) {
          errChain = errChain.catch(onRejected);
        }
      });
      return errChain.then(() => Promise.reject(error));
    });

    return finalChain;
  }

  get<T = unknown>(
    url: string,
    config: Omit<AuraRequestConfig<T>, "url" | "method"> = {}
  ): Promise<AuraResponse<T>> {
    return this.request<T>({ ...config, url, method: "GET" });
  }

  delete<T = unknown>(
    url: string,
    config: Omit<AuraRequestConfig<T>, "url" | "method"> = {}
  ): Promise<AuraResponse<T>> {
    return this.request<T>({ ...config, url, method: "DELETE" });
  }

  head<T = unknown>(
    url: string,
    config: Omit<AuraRequestConfig<T>, "url" | "method" | "data"> = {}
  ): Promise<AuraResponse<T>> {
    return this.request<T>({ ...config, url, method: "HEAD" });
  }

  post<T = unknown>(
    url: string,
    data?: unknown,
    config: Omit<AuraRequestConfig<T>, "url" | "method" | "data"> = {}
  ): Promise<AuraResponse<T>> {
    return this.request<T>({ ...config, url, method: "POST", data });
  }

  put<T = unknown>(
    url: string,
    data?: unknown,
    config: Omit<AuraRequestConfig<T>, "url" | "method" | "data"> = {}
  ): Promise<AuraResponse<T>> {
    return this.request<T>({ ...config, url, method: "PUT", data });
  }

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config: Omit<AuraRequestConfig<T>, "url" | "method" | "data"> = {}
  ): Promise<AuraResponse<T>> {
    return this.request<T>({ ...config, url, method: "PATCH", data });
  }
}

export const aura = new Aura();

export * from "./types.js";
export * from "./error.js";

export default aura;

