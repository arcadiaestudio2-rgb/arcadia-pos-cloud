import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { Button, toast, BrandBlock } from '../common/CommonUI';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';

export function Login() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(name, password);
      toast.success('¡Bienvenido de nuevo!');
    } catch (error: any) {
      toast.error(error.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-tertiary/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
          {/* Subtle line decoration */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-tertiary to-primary opacity-50" />
          
          <div className="flex flex-col items-center mb-10">
            <BrandBlock className="mb-2 invert brightness-0" />
            <h2 className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">Acceso Administrativo</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-4">Usuario</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Gabi Administrator"
                  className="w-full h-16 bg-white/[0.05] border border-white/10 rounded-2xl pl-14 pr-6 text-white text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary/30 outline-none transition-all placeholder:text-white/10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-4">Contraseña</label>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-16 bg-white/[0.05] border border-white/10 rounded-2xl pl-14 pr-6 text-white text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary/30 outline-none transition-all placeholder:text-white/10"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-16 mt-4 group" 
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  Entrar al Sistema <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          {/* Quick Access Info (Helpful for dev/demo) */}
          <div className="mt-10 pt-8 border-t border-white/5">
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] text-center mb-6">Credenciales de Acceso Rápido</p>
            <div className="flex justify-center gap-3">
              {[
                { label: 'Admin', name: 'Gabi Administrator', pass: 'admin123', color: 'from-primary/20 to-primary/5' },
                { label: 'Stock', name: 'Stock Manager', pass: 'stock123', color: 'from-tertiary/20 to-tertiary/5' },
                { label: 'Ventas', name: 'Vendedor', pass: 'vendedor123', color: 'from-slate-400/20 to-slate-400/5' }
              ].map(role => (
                <button 
                  key={role.label}
                  type="button"
                  onClick={() => {
                    setName(role.name);
                    setPassword(role.pass);
                    // Auto-submit after a tiny delay to show the change
                    setTimeout(() => {
                      const form = document.querySelector('form');
                      if (form) form.requestSubmit();
                    }, 100);
                  }}
                  className={`flex-1 group/btn relative py-3 rounded-2xl bg-gradient-to-br ${role.color} border border-white/5 transition-all hover:scale-105 hover:border-white/10 active:scale-95 overflow-hidden`}
                >
                  <div className="relative z-10 flex flex-col items-center">
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest group-hover/btn:text-white transition-colors">{role.label}</span>
                  </div>
                  <div className="absolute inset-0 bg-white/0 group-hover/btn:bg-white/5 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-white/20 text-[10px] font-medium tracking-widest uppercase">
          &copy; 2026 ARCADIA STUDIO • Todos los derechos reservados
        </p>
      </motion.div>
    </div>
  );
}
