const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  details?: FieldError[];

  constructor(status: number, message: string, details?: FieldError[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the API. Is the server running?');
  }

  if (
    res.status === 401 &&
    path !== '/auth/me' &&
    path !== '/auth/login' &&
    path !== '/auth/demo' &&
    path !== '/auth/register'
  ) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (isJson && (payload as any)?.error?.message) || 'Something went wrong.';
    throw new ApiError(res.status, message, (payload as any)?.error?.details);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  baseUrl: BASE,
};
