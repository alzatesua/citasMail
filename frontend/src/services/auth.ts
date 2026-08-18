const API_URL = "http://127.0.0.1:8000/api";

interface LoginResponse {
  token: string;
}

export async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    // ajusta esto según lo que devuelva tu API en error (400/401)
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Usuario o contraseña incorrectos");
  }

  const data: LoginResponse = await res.json();
  localStorage.setItem("token", data.token);
  return data.token;
}

export function logout() {
  localStorage.removeItem("token");
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}