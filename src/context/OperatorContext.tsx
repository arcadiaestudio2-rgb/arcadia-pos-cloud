import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '../components/common/CommonUI';
import { api } from '../services/api';

export interface Operator {
  id: number | string;
  name: string;
  role: string;
  email?: string;
}

interface OperatorContextType {
  selectedOperator: Operator | null;
  operatorName: string | null;
  setSelectedOperator: (op: Operator | null) => void;
  operators: Operator[];
  isOperatorSelected: boolean;
  isLoading: boolean;
  supabase: any; // Add supabase to context
}

const OperatorContext = createContext<OperatorContextType | undefined>(undefined);

export const OperatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedOperator, setSelectedOperatorState] = useState<Operator | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      // Solo intentamos cargar si estamos en local (servidor local) o si hay una sesión activa en Supabase
      const { data: { session } } = await api.supabase.auth.getSession();
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (!session && !isLocal) {
        setIsLoading(false);
        return;
      }

      try {
        const users = await api.getUsers();
        setOperators(users);
        
        const saved = localStorage.getItem('arcadia_operator_v2');
        if (saved) {
          try {
            const savedOp = JSON.parse(saved);
            const exists = users.find((u: any) => 
              u.id === savedOp.id || 
              (u.email && savedOp.email && u.email === savedOp.email)
            );
            if (exists) {
              setSelectedOperatorState(exists);
            }
          } catch (e) {
            localStorage.removeItem('arcadia_operator_v2');
          }
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const setSelectedOperator = (op: Operator | null) => {
    setSelectedOperatorState(op);
    if (op) {
      localStorage.setItem('arcadia_operator_v2', JSON.stringify(op));
      toast.success(`Sesión activa: ${op.name}`);
    } else {
      localStorage.removeItem('arcadia_operator_v2');
    }
  };

  return (
    <OperatorContext.Provider 
      value={{ 
        selectedOperator, 
        operatorName: selectedOperator?.name || null,
        setSelectedOperator, 
        operators,
        isOperatorSelected: !!selectedOperator,
        isLoading,
        supabase: api.supabase // Pass supabase through context
      }}
    >
      {children}
    </OperatorContext.Provider>
  );
};

export const useOperator = () => {
  const context = useContext(OperatorContext);
  if (context === undefined) {
    throw new Error('useOperator must be used within an OperatorProvider');
  }
  return context;
};
