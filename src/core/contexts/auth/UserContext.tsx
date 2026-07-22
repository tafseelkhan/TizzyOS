import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../../../api/connections/token/tokenSlice';
import { decode as atob } from 'base-64';

interface User {
  _id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
}

// JWT token payload type
interface JwtPayload {
  userId: string;
  name: string;
  email: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserFromToken();
  }, []);

  const loadUserFromToken = async () => {
    try {
      const token = await getToken();
      if (token) {
        try {
          const decoded = decodeJWT(token);
          if (decoded) {
            setUser({
              _id: decoded.userId,
              name: decoded.name,
              email: decoded.email,
            });
          } else {
            setUser(null);
          }
        } catch (err) {
          setUser(null);
        }
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to decode JWT without external library
  const decodeJWT = (token: string): JwtPayload | null => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(
            (char: string) =>
              '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2),
          )
          .join(''),
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Primary hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Alias for backward compatibility
export const useUser = useAuth;
