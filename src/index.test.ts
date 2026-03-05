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

