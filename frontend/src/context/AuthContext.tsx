import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { login as loginService, logout as logoutService, getToken } from "../services/auth";

interface AuthContextType {
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getToken());

  async function login(username: string, password: string) {
    const newToken = await loginService(username, password);
    setToken(newToken);
  }

  function logout() {
    logoutService();
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}