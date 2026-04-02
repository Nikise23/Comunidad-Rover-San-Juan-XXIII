import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, getStoredToken, setStoredToken, type AuthUser } from '../api/client';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setSession: (token: string, user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { data } = await authApi.me();
      setUser(data);
    } catch {
      setStoredToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  useEffect(() => {
    const onExpired = () => {
      logout();
    };
    window.addEventListener('rover-auth-expired', onExpired);
    return () => window.removeEventListener('rover-auth-expired', onExpired);
  }, [logout]);

  const login = useCallback(async (username: string, password: string) => {
    const { data } = await authApi.login(username, password);
    setStoredToken(data.access_token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (username: string, password: string, displayName?: string) => {
    const { data } = await authApi.register(username, password, displayName);
    setStoredToken(data.access_token);
    setUser(data.user);
  }, []);

  const setSession = useCallback((token: string, u: AuthUser) => {
    setStoredToken(token);
    setUser(u);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      setSession,
    }),
    [user, loading, login, register, logout, refreshUser, setSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
