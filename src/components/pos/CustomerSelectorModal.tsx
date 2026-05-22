import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, User, Phone, CreditCard, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../services/api';
import { formatCurrency } from '../common/CommonUI';

interface CustomerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: any) => void;
  onCreateNew: () => void;
}

export const CustomerSelectorModal: React.FC<CustomerSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  onCreateNew
}) => {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadInitialCustomers();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleRefresh = () => {
      if (isOpen) loadInitialCustomers();
    };
    window.addEventListener('refresh-clients', handleRefresh);
    return () => window.removeEventListener('refresh-clients', handleRefresh);
  }, [isOpen]);

  const loadInitialCustomers = async () => {
    setLoading(true);
    try {
      const data = await api.getClients();
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (val: string) => {
    setSearch(val);
    if (val.length > 2) {
      setLoading(true);
      try {
        const data = await api.searchClients(val);
        setCustomers(data || []);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    } else if (val.length === 0) {
      loadInitialCustomers();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* HEADER */}
            <div className="p-8 pb-4 flex justify-between items-center border-b border-slate-50 bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black italic tracking-tighter text-on-surface">
                  SELECCIONAR <span className="text-primary">CLIENTE</span>
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Busca por nombre o DNI
                </p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white hover:text-error transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* SEARCH */}
            <div className="p-8 py-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                <input 
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Escribe para buscar..."
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-on-surface transition-all focus:outline-none placeholder:text-slate-300"
                />
              </div>
            </div>

            {/* LIST */}
            <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                  <div className="w-8 h-8 border-4 border-slate-100 border-t-primary rounded-full animate-spin mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Buscando...</p>
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-12 text-slate-300">
                  <User size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-bold">No se encontraron clientes</p>
                </div>
              ) : (
                customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-50 hover:border-primary/20 hover:bg-primary/5 hover:scale-[1.01] transition-all group text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-primary transition-all">
                        <User size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-on-surface uppercase tracking-tight group-hover:text-primary transition-colors">
                          {c.name}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400">
                          <span className="flex items-center gap-1">
                            <Phone size={10} /> {c.phone || 'S/N'}
                          </span>
                          <span className="flex items-center gap-1">
                            <CreditCard size={10} /> {c.dni_tax_id || 'S/D'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right flex items-center gap-4">
                      {c.debt_balance > 0 && (
                        <div>
                          <p className="text-[8px] font-black uppercase text-error tracking-widest">Deuda</p>
                          <p className="text-xs font-black text-error italic">{formatCurrency(c.debt_balance)}</p>
                        </div>
                      )}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-200 group-hover:text-primary group-hover:translate-x-1 transition-all">
                        <ChevronRight size={20} />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* FOOTER */}
            <div className="p-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <button 
                className="flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest hover:translate-x-1 transition-all"
                onClick={onCreateNew}
              >
                <UserPlus size={16} />
                Nuevo Cliente
              </button>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {customers.length} resultados
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
