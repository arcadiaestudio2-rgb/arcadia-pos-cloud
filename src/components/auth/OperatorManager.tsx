import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, UserPlus, Trash2, Check, Shield, Search, Loader2 } from 'lucide-react';
import { useOperator, Operator } from '../../context/OperatorContext';
import { Button } from '../common/CommonUI';

export function OperatorManager() {
  const { operators, selectedOperator, setSelectedOperator, addOperator, removeOperator } = useOperator();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOperators = operators.filter(op => 
    op.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    setIsLoading(true);
    try {
      await addOperator(newName.trim(), newRole);
      setNewName('');
      setIsAdding(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que seleccione el operador al intentar borrarlo
    if (confirm('¿Estás seguro de que deseas eliminar este operador?')) {
      await removeOperator(id);
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-10 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface">Gestión de Operadores</h2>
          <p className="text-secondary font-medium text-xs opacity-60 uppercase tracking-widest mt-1">Control de acceso y perfiles de staff</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Buscar operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-12 pr-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary/30 outline-none transition-all shadow-sm"
            />
          </div>
          
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-[0.2em]"
          >
            <UserPlus size={18} /> Nuevo Operador
          </button>
        </div>
      </header>

      {/* Operator Grid / "Tabs" */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredOperators.map((op) => (
            <motion.div
              layout
              key={op.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => setSelectedOperator(op)}
              className={`relative group cursor-pointer p-6 rounded-[2.5rem] border-2 transition-all duration-300 flex flex-col items-center gap-4 overflow-hidden ${
                selectedOperator?.id === op.id 
                  ? 'bg-primary border-primary shadow-2xl shadow-primary/30 text-white' 
                  : 'bg-white border-slate-100 hover:border-primary/30 hover:shadow-xl hover:shadow-slate-200/50 text-on-surface'
              }`}
            >
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-300 ${
                selectedOperator?.id === op.id ? 'bg-white/20' : 'bg-slate-50 text-primary group-hover:scale-110'
              }`}>
                <User size={40} strokeWidth={1.5} />
              </div>
              
              <div className="text-center">
                <h3 className="font-black uppercase tracking-tighter text-lg leading-tight">{op.name}</h3>
                <p className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${
                  selectedOperator?.id === op.id ? 'text-white' : 'text-slate-400'
                }`}>
                  {op.role === 'admin' ? 'Administrador' : 'Operador'}
                </p>
              </div>

              {/* Status Indicators */}
              <div className="absolute top-4 right-4 flex gap-2">
                {selectedOperator?.id === op.id ? (
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Check size={16} />
                  </div>
                ) : (
                  <button 
                    onClick={(e) => handleDelete(op.id, e)}
                    className="w-8 h-8 rounded-xl bg-slate-100 text-slate-400 hover:bg-error/10 hover:text-error transition-all flex items-center justify-center shadow-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Decorative background circle */}
              <div className={`absolute -bottom-10 -left-10 w-32 h-32 rounded-full transition-all duration-500 opacity-10 ${
                selectedOperator?.id === op.id ? 'bg-white scale-150' : 'bg-primary group-hover:scale-125'
              }`} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Operator Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-md" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl relative z-10 overflow-hidden"
            >
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-tertiary" />
               
               <div className="flex flex-col items-center mb-8">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4">
                     <UserPlus size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-on-surface tracking-tighter">Nuevo Operador</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Configura el acceso al staff</p>
               </div>

               <form onSubmit={handleAdd} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Nombre Completo</label>
                    <input 
                      autoFocus
                      type="text" 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ej: Laura Vendedora"
                      className="w-full h-16 bg-slate-50 border-none rounded-2xl px-6 text-on-surface text-sm font-bold focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-300"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Rol del Usuario</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'admin', label: 'Administrador', icon: Shield },
                        { id: 'seller', label: 'Vendedor', icon: User }
                      ].map(role => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => setNewRole(role.id)}
                          className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                            newRole === role.id 
                              ? 'bg-primary/5 border-primary text-primary shadow-lg shadow-primary/5' 
                              : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                          }`}
                        >
                          <role.icon size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">{role.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="flex-1 h-16" 
                      onClick={() => setIsAdding(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 h-16" 
                      disabled={isLoading || !newName.trim()}
                    >
                      {isLoading ? <Loader2 className="animate-spin" /> : 'Crear Perfil'}
                    </Button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
