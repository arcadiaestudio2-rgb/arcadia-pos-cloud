import React, { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';

interface QuickAddAttributeProps {
  label: string;
  options: string[];
  onAdd: (newValue: string) => void;
  onSelect: (value: string) => void;
  value: string;
}

export function QuickAddAttribute({ label, options, onAdd, onSelect, value }: QuickAddAttributeProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleConfirm = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim());
      setInputValue('');
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-2 flex-1">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</label>
      </div>
      
      <div className="flex gap-2">
        {!isAdding ? (
          <>
            <select 
              value={value}
              onChange={(e) => onSelect(e.target.value)}
              className="flex-1 h-11 bg-white border border-slate-200 rounded-xl text-xs font-bold px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
            >
              <option value="">Seleccionar...</option>
              {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <button 
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-11 h-11 flex items-center justify-center bg-blue-50 text-primary rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
            >
              <Plus size={18} />
            </button>
          </>
        ) : (
          <div className="flex-1 flex gap-2">
            <input 
              autoFocus
              className="flex-1 h-11 bg-surface-container-low border border-primary/30 rounded-xl text-xs font-bold px-4 outline-none focus:ring-2 focus:ring-primary/20"
              placeholder={`Nueva ${label}...`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if(e.key === 'Enter') handleConfirm();
                if(e.key === 'Escape') setIsAdding(false);
              }}
            />
            <button 
              onClick={handleConfirm}
              className="w-11 h-11 flex items-center justify-center bg-tertiary text-white rounded-xl hover:brightness-105"
            >
              <Check size={18} />
            </button>
            <button 
              onClick={() => setIsAdding(false)}
              className="w-11 h-11 flex items-center justify-center bg-slate-100 text-slate-400 rounded-xl hover:bg-error/10 hover:text-error"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
