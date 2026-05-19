import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthApiError } from '@supabase/supabase-js';
import { api } from '../services/api';

export type Role = 'admin' | 'stock-manager' | 'seller';

interface User {
  id: string;
  name: string;
  email?: string;
  role: Role;
  store_id?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (name: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  hasPermission: (tab: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// All users are admins — no role restrictions

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from storage for persistence
  useEffect(() => {
    const savedUser = localStorage.getItem('arcadia_user') || sessionStorage.getItem('arcadia_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser) as User);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      if (!email || !password) {
        throw new Error("Por favor, introduce tus credenciales.");
      }

      const userData = await api.login(email.trim(), password) as User;
      setUser(userData);
      
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('arcadia_user', JSON.stringify(userData));
      
      // Clear the other storage to avoid conflicts
      if (rememberMe) {
        sessionStorage.removeItem('arcadia_user');
      } else {
        localStorage.removeItem('arcadia_user');
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      
      if (error instanceof AuthApiError) {
        switch (error.status) {
          case 400:
            throw new Error("Credenciales inválidas o formato de email incorrecto.");
          case 422:
            throw new Error("Formato de datos incorrecto.");
          default:
            throw new Error(error.message);
        }
      }
      
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.supabase.auth.signOut();
    } catch (e) {
      console.warn("Error during Supabase signout:", e);
    }
    
    // Clear all persistent data
    setUser(null);
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear all cookies
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
    
    console.log("Session cleared. Redirecting to login...");
    window.location.href = '/'; // Force a full reload to clear memory state
  };

  // All authenticated users have full access
  const hasPermission = (_tab: string) => !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
