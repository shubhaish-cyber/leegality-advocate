import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string;
  profilePicUrl?: string;
  tokenExpiry?: string;
  workEmail?: string;
}

interface AuthState {
  user: User | null;
  userType: 'marketing' | 'rep' | null;
  loading: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  userType: null,
  loading: true,
  logout: async () => {},
  refetch: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'marketing' | 'rep' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const data = await api.get('/api/auth/me');
      setUser(data.user);
      setUserType(data.userType || null);
    } catch {
      setUser(null);
      setUserType(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const logout = async () => {
    await api.post('/api/auth/logout');
    setUser(null);
    setUserType(null);
  };

  return (
    <AuthContext.Provider value={{ user, userType, loading, logout, refetch: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
