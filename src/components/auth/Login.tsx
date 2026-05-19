import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { Button, toast, BrandBlock } from '../common/CommonUI';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { InstallButton } from '../common/InstallButton';

export function Login() {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(name, password, rememberMe);
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
        <div className="mb-6 flex justify-center">
          <InstallButton forceShow={true} />
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
          {/* Subtle line decoration */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-tertiary to-primary opacity-50" />
          
          <div className="flex flex-col items-center mb-12">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20" />
              <BrandBlock className="relative scale-125" light={true} />
            </div>
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-white/20 to-transparent mb-4" />
            <h2 className="text-white/60 text-[10px] font-black uppercase tracking-[0.4em]">Gestión de Indumentaria</h2>
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
                  placeholder="Usuario o Email"
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

            <div className="flex items-center px-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 border-2 border-white/10 rounded-lg bg-white/5 transition-all peer-checked:bg-primary peer-checked:border-primary group-hover:border-white/20" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">
                    <svg className="w-3.5 h-3.5 text-white fill-current" viewBox="0 0 20 20">
                      <path d="M0 11l2-2 5 5L18 3l2 2L7 18z" />
                    </svg>
                  </div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40 group-hover:text-white/60 transition-colors">Recordar sesión</span>
              </label>
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
        </div>

        <p className="mt-8 text-center text-white/20 text-[10px] font-medium tracking-widest uppercase">
          &copy; 2026 ARCADIA STUDIO • Todos los derechos reservados
        </p>
      </motion.div>
    </div>
  );
}
