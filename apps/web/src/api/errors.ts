export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong. Try again.';
}
