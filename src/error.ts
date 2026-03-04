import type { AuraErrorDetails } from "./types.js";

export class AuraError<T = unknown> extends Error {
  readonly isAuraError = true;
  readonly config?: AuraErrorDetails<T>["config"];
  readonly request?: AuraErrorDetails<T>["request"];
  readonly response?: AuraErrorDetails<T>["response"];
  readonly cause?: unknown;

  constructor(details: AuraErrorDetails<T>) {
    super(details.message);
    this.name = "AuraError";
    this.config = details.config;
    this.request = details.request;
    this.response = details.response;
    this.cause = details.cause;

    if (details.cause instanceof Error && details.cause.stack) {
      this.stack = details.cause.stack;
    }
  }
}

