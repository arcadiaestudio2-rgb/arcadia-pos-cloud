import { useContext } from 'react';
import { OperatorContext } from '../context/OperatorContext';

export function useOperator() {
  const context = useContext(OperatorContext);
  if (context === undefined) {
    throw new Error('useOperator must be used within an OperatorProvider');
  }
  return context;
}
