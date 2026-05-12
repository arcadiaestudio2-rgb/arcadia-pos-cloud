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
  login: (name: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (tab: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// All users are admins — no role restrictions

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage for persistence in dev
  useEffect(() => {
    const savedUser = localStorage.getItem('arcadia_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      if (!email || !password) {
        throw new Error("Por favor, introduce tus credenciales.");
      }

      const userData = await api.login(email.trim(), password);
      setUser(userData);
      localStorage.setItem('arcadia_user', JSON.stringify(userData));
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
    setUser(null);
    localStorage.clear();
    window.location.href = '/'; // Reinicia la app en la raíz
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
