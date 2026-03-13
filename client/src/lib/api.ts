const BASE = '';

async function request(url: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: (url: string) => request(url),
  post: (url: string, body?: any) =>
    request(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (url: string, body?: any) =>
    request(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (url: string) => request(url, { method: 'DELETE' }),

  // For file uploads (don't set Content-Type, let browser set multipart boundary)
  upload: async (url: string, formData: FormData) => {
    const res = await fetch(`${BASE}${url}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
};
