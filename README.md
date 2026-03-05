# Aura HTTP

A modern, fetch-based HTTP client with async interceptors, native timeouts, and schema validation. **Aura** is lightweight, zero-dependency, and designed for TypeScript-first codebases.

## Features

- **Fetch-native core**: Built directly on top of the Fetch API.
- **Async interceptors**: Request and response interceptors that support async transforms.
- **Native timeouts**: Uses `AbortSignal.timeout` for precise cancellation.
- **Schema validation**: Plug in Zod, Valibot, or any validator via a simple `validate` hook.
- **Zero runtime dependencies**: Small, tree-shakeable, and production-ready.
- **Typed by default**: Strict TypeScript support with full `.d.ts` declarations.

## Installation

```bash
npm install aura-http
# or
yarn add aura-http
# or
pnpm add aura-http
```

Aura targets Node.js `>=18.17` (for native `fetch`, `AbortSignal.timeout`, and `Response`) and modern browsers.

## Why Aura?

- **Native primitives, not shims**  
  Aura is built directly on top of the Fetch API and modern platform features. No custom adapters, no polyfills by default.

- **Async interceptors**  
  Many interceptor systems are synchronous by design; async work often requires awkward patterns. Aura’s interceptors are naturally async, letting you await tokens, feature flags, or remote config effortlessly.

- **First-class AbortSignal.timeout**  
  Instead of re-implementing timeout logic, Aura uses `AbortSignal.timeout(ms)` and integrates cleanly with any existing `AbortSignal` you pass in.

- **Schema-aware responses**  
  Aura exposes a `validate` hook that plays perfectly with Zod, Valibot, or any runtime validator. Parse, validate, and narrow your types at the boundary — no extra wrappers needed.

- **Zero dependencies, minimal surface area**  
  Aura intentionally focuses on the 80% case: JSON APIs over HTTP. No bloated feature set, just a sharp, modern toolkit.

## Quick Start

### Basic GET

```ts
import aura from "aura-http";

type User = {
  id: string;
  name: string;
};

async function fetchUser(id: string) {
  const res = await aura.get<User>(`https://api.example.com/users/${id}`);

  console.log(res.status); // 200
  console.log(res.data.name); // typed as string
}
```

### POST with JSON body

```ts
import aura from "aura-http";

async function createUser() {
  const res = await aura.post<{ id: string }>(
    "https://api.example.com/users",
    { name: "Aura" }
  );

  console.log(res.data.id);
}
```

Aura automatically:

- Detects JSON content based on `Content-Type` headers
- Stringifies request bodies for JSON content types
- Parses JSON responses into JavaScript objects

For non-JSON responses, Aura falls back to `response.text()` by default.

### Timeouts with AbortSignal.timeout

```ts
import aura from "aura-http";

async function fetchWithTimeout() {
  const res = await aura.get("https://api.example.com/slow", {
    timeout: 5_000 // 5 seconds
  });

  return res.data;
}
```

Under the hood, Aura uses:

```ts
AbortSignal.timeout(timeoutMs);
```

and composes it with any `signal` you provide in the request config.

### Zod / Valibot Validation

Aura doesn’t depend on any validation library, but it integrates nicely with all of them via the `validate` hook.

#### Zod example

```ts
import aura from "aura-http";
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string()
});

type User = z.infer<typeof UserSchema>;

async function fetchUser(id: string) {
  const res = await aura.get<User>(`https://api.example.com/users/${id}`, {
    validate: data => UserSchema.parse(data)
  });

  // res.data is guaranteed to be a valid User here
  return res.data;
}
```

#### Valibot example

```ts
import aura from "aura-http";
import { object, string, parse } from "valibot";

const UserSchema = object({
  id: string(),
  name: string()
});

type User = {
  id: string;
  name: string;
};

async function fetchUser(id: string) {
  const res = await aura.get<User>(`https://api.example.com/users/${id}`, {
    validate: data => parse(UserSchema, data)
  });

  return res.data;
}
```

## Interceptors

Aura exposes an interceptor manager for both requests and responses, familiar to interceptor-based HTTP clients but fully async.

```ts
import aura from "aura-http";

// Request interceptor
aura.interceptors.request.use(async config => {
  const token = await getAuthTokenSomehow();

  return {
    ...config,
    headers: {
      ...(config.headers ?? {}),
      Authorization: `Bearer ${token}`
    }
  };
});

// Response interceptor
aura.interceptors.response.use(async response => {
  if (response.status === 401) {
    // Optionally trigger a global sign-out, refresh, etc.
  }

  // You can transform the response or just pass it through
  return response;
});
```

- **Multiple handlers**: You can register many interceptors; they run in registration order.
- **Async support**: `use` handlers can return a promise; Aura will await them in sequence.
- **Ejecting handlers**: `use` returns an ID you can pass to `eject(id)` on the corresponding manager.

## Error Handling

Aura throws an `AuraError` when:

- The network request fails (e.g., DNS issues, aborted requests),
- The response body cannot be parsed, or
- The response status is not OK (non-2xx).

```ts
import aura, { AuraError } from "aura-http";

async function safeRequest() {
  try {
    const res = await aura.get("https://api.example.com/data");
    return res.data;
  } catch (err) {
    if (err instanceof AuraError) {
      console.error("AuraError:", {
        message: err.message,
        status: err.response?.status,
        url: err.request?.url
      });
    } else {
      console.error("Unknown error:", err);
    }
    throw err;
  }
}
```

`AuraError` includes:

- `config`: The original request configuration.
- `request`: URL and `RequestInit` used for `fetch`.
- `response`: The parsed `AuraResponse`, when available.
- `cause`: The underlying error (e.g. `AbortError`).

## API Reference

### `aura.request<T>(config)`

Low-level request function.

```ts
const res = await aura.request<MyType>({
  url: "https://api.example.com/data",
  method: "GET",
  headers: {
    "X-Feature-Flag": "on"
  },
  timeout: 3_000,
  validate: data => MySchema.parse(data)
});
```

### Shorthand methods

All shorthand methods return `Promise<AuraResponse<T>>`:

- `aura.get<T>(url, config?)`
- `aura.delete<T>(url, config?)`
- `aura.head<T>(url, config?)`
- `aura.post<T>(url, data?, config?)`
- `aura.put<T>(url, data?, config?)`
- `aura.patch<T>(url, data?, config?)`

### Types

Key exported types:

- `AuraRequestConfig<T = unknown>`
- `AuraResponse<T = unknown>`
- `AuraError`
- `HttpMethod`

All types are exported from the package root, e.g.:

```ts
import type { AuraResponse, AuraRequestConfig } from "aura-http";
```

## Build & Contributing

### Scripts

```bash
npm run build  # Build with tsup (ESM + CJS, d.ts, minified)
npm run test   # Run unit tests with Vitest
npm run lint   # Type-check the project with tsc
```

### Development

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Run tests:

   ```bash
   npm test
   ```

4. Build:

   ```bash
   npm run build
   ```

## License

MIT © 2026 Huseyn Ekh

