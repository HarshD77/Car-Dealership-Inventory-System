export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, options: { token?: string; method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: options.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = data.details?.map((issue: { field: string; message: string }) =>
      `${issue.field ? `${issue.field}: ` : ''}${issue.message}`).join('. ');
    throw new ApiError(response.status, details || data.error || 'The request could not be completed.');
  }
  return data as T;
}
