import React, { useState } from 'react';
import { UserPlus, ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { useOperator } from '../../context/OperatorContext';

export const InitialOperatorSetup = () => {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setOperators, setSelectedOperator } = useOperator();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const newOp = await api.createOperator({
        name: name.trim(),
        role: 'admin'
      });
      
      // Actualizar el contexto inmediatamente
      setOperators([newOp]);
      setSelectedOperator(newOp);
      
      // Guardar en localStorage para que persista la selección
      localStorage.setItem('arcadia_operator_v2', JSON.stringify(newOp));
      
    } catch (error) {
      console.error('Error creating initial operator:', error);
      alert('Error al crear el administrador. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-8 border border-slate-100">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
            <UserPlus className="text-primary" size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase">
            ¡Bienvenido a ArcadiAPP!
          </h1>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Para comenzar, necesitamos crear tu perfil de administrador principal de indumentaria.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
              Tu nombre completo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Gabriel Admin"
              className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-300"
            />
          </div>

          <div className="bg-indigo-50 rounded-2xl p-4 flex gap-4 border border-indigo-100/50">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck className="text-indigo-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-tight text-indigo-700 mb-0.5">
                Perfil Maestro
              </p>
              <p className="text-[10px] text-indigo-500/80 font-bold leading-tight">
                Este operador tendrá acceso total a inventario, ventas y reportes.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'CREANDO...' : 'COMENZAR AHORA'}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <p className="mt-8 text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">
          ARCADIAPP INDUMENTARIA • PREMIUM POS v3
        </p>
      </div>
    </div>
  );
};
