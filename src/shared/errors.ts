export type IpcErrorCode = "NOT_IMPLEMENTED" | "BAD_REQUEST" | "INTERNAL";

export interface IpcError {
  code: IpcErrorCode;
  message: string;
  feature?: string;
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: IpcError };

export class NotImplementedError extends Error {
  readonly code = "NOT_IMPLEMENTED" as const;
  readonly feature: string;

  constructor(feature: string, detail?: string) {
    super(detail ?? `Not implemented: ${feature}`);
    this.name = "NotImplementedError";
    this.feature = feature;
  }
}

export function toIpcError(error: unknown): IpcError {
  if (error instanceof NotImplementedError) {
    return { code: "NOT_IMPLEMENTED", message: error.message, feature: error.feature };
  }
  if (error instanceof Error) {
    return { code: "INTERNAL", message: error.message };
  }
  return { code: "INTERNAL", message: String(error) };
}

export function fromIpcError(error: IpcError): Error {
  if (error.code === "NOT_IMPLEMENTED") {
    return new NotImplementedError(error.feature ?? "unknown", error.message);
  }
  return new Error(error.message);
}
