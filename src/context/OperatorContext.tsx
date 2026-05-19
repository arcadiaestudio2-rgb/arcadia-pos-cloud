import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '../components/common/CommonUI';
import { api } from '../services/api';

export interface Operator {
  id: string;
  name: string;
  role: string;
  email?: string;
  store_id?: string;
}

interface OperatorContextType {
  selectedOperator: Operator | null;
  operatorName: string | null;
  setSelectedOperator: (op: Operator | null) => void;
  operators: Operator[];
  addOperator: (name: string, role: string) => Promise<void>;
  removeOperator: (id: string) => Promise<void>;
  setOperators: (ops: Operator[]) => void;
  isOperatorSelected: boolean;
  isLoading: boolean;
  supabase: any;
}

const OperatorContext = createContext<OperatorContextType | undefined>(undefined);

export const OperatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedOperator, setSelectedOperatorState] = useState<Operator | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const users = await api.getUsers();
      if (users) {
        setOperators(users);
      }
      
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

  useEffect(() => {
    fetchUsers();
    
    const handleRefresh = () => fetchUsers();
    window.addEventListener('refresh-operators', handleRefresh);
    return () => window.removeEventListener('refresh-operators', handleRefresh);
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

  const addOperator = async (name: string, role: string) => {
    try {
      const newOp = await api.createOperator({ name, role });
      setOperators(prev => [...prev, newOp]);
      toast.success(`Operador ${name} creado con éxito`);
    } catch (error: any) {
      toast.error(`Error al crear operador: ${error.message}`);
      throw error;
    }
  };

  const removeOperator = async (id: string) => {
    try {
      await api.deleteOperator(id);
      setOperators(prev => prev.filter(op => op.id !== id));
      if (selectedOperator?.id === id) {
        setSelectedOperator(null);
      }
      toast.success('Operador eliminado');
    } catch (error: any) {
      toast.error(`Error al eliminar: ${error.message}`);
      throw error;
    }
  };

  return (
    <OperatorContext.Provider 
      value={{ 
        selectedOperator, 
        operatorName: selectedOperator?.name || null,
        setSelectedOperator, 
        operators,
        addOperator,
        removeOperator,
        setOperators,
        isOperatorSelected: !!selectedOperator,
        isLoading,
        supabase: api.supabase
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
