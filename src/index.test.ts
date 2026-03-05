import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { aura, Aura } from "./index.js";

describe("Aura HTTP client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("performs a GET request and parses JSON", async () => {
    const responseBody = { message: "ok" };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

    const res = await aura.get<{ message: string }>(
      "https://example.com/test"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/test",
      expect.objectContaining({
        method: "GET"
      })
    );
    expect(res.status).toBe(200);
    expect(res.data.message).toBe("ok");
  });

  it("performs a POST request with JSON body", async () => {
    const payload = { name: "Aura" };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_input, init) => {
        const body = init?.body as string;
        expect(JSON.parse(body)).toEqual(payload);

        const headers = new Headers(init?.headers);
        expect(headers.get("content-type")).toBe("application/json");

        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { "Content-Type": "application/json" }
        });
      });

    const res = await aura.post<{ ok: boolean }>(
      "https://example.com/users",
      payload
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(res.data.ok).toBe(true);
  });

  it("supports request and response interceptors", async () => {
    const client = new Aura();

    client.interceptors.request.use(config => {
      return {
        ...config,
        headers: {
          ...(config.headers ?? {}),
          "X-Requested-With": "Aura"
        }
      };
    });

    client.interceptors.response.use(response => {
      return {
        ...response,
        data: {
          ...(response.data as object),
          intercepted: true
        }
      };
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ value: 42 }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

    const res = await client.get<{ value: number; intercepted: boolean }>(
      "https://example.com/intercept"
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("X-Requested-With")).toBe("Aura");

    expect(res.data.value).toBe(42);
    expect(res.data.intercepted).toBe(true);
  });

  it("resolves relative URL with client baseURL", async () => {
    const client = new Aura({ baseURL: "https://api.example.com" });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

    const res = await client.get<{ ok: boolean }>("/users");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/users",
      expect.objectContaining({ method: "GET" })
    );
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
  });

  it("per-request baseURL overrides client baseURL", async () => {
    const client = new Aura({ baseURL: "https://api.example.com" });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

    const res = await client.get<{ ok: boolean }>("/x", {
      baseURL: "https://alt.example.com"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://alt.example.com/x",
      expect.any(Object)
    );
    expect(res.status).toBe(200);
    expect(res.data.ok).toBe(true);
  });

  it("absolute URL ignores baseURL", async () => {
    const client = new Aura({ baseURL: "https://api.example.com" });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      );

    await client.get("https://other.com/path");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://other.com/path",
      expect.any(Object)
    );
  });

  it("invokes error interceptors on non-OK responses", async () => {
    const client = new Aura();
    let called = false;
    client.interceptors.error.use(undefined, err => {
      called = true;
      throw err;
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(client.get("/secure")).rejects.toBeTruthy();
    expect(called).toBe(true);
  });

  it("honors timeout via AbortSignal.timeout", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }) as any
      );

    const promise = aura.get("https://example.com/timeout", { timeout: 10 });

    await expect(promise).rejects.toHaveProperty("isAuraError", true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
