import React, { useState } from 'react';
import { 
  User, 
  Shield, 
  Building2, 
  Smartphone, 
  Settings2, 
  Database, 
  Camera, 
  Lock, 
  LogOut, 
  Save, 
  Plus, 
  Globe, 
  Moon, 
  Sun, 
  Bell, 
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, toast } from '../common/CommonUI';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { id: 'identity', label: 'Mi Perfil', icon: User },
  { id: 'branding', label: 'Marca & WhatsApp', icon: Building2 },
  { id: 'security', label: 'Roles & Permisos', icon: Shield },
  { id: 'logic', label: 'Cerebro de Negocio', icon: Settings2 },
  { id: 'system', label: 'Preferencia & Backup', icon: Database },
];

export function ProfileSettings() {
  const [activeTab, setActiveTab] = useState('identity');
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <div className="p-10 max-w-[1400px] mx-auto space-y-10 pb-20">
      {/* Header Context */}
      <header className="flex justify-between items-end">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-on-surface/5 flex items-center justify-center text-on-surface/40">
                 <Shield size={16} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Command Center</p>
           </div>
           <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface uppercase">Gestión de Cuenta</h2>
        </div>
        <Button onClick={() => toast.success('Configuración Global Guardada')} className="shadow-2xl">
           <Save size={18} /> Aplicar Cambios Globales
        </Button>
      </header>

      <div className="grid grid-cols-12 gap-10">
        {/* Navigation Rail */}
        <aside className="col-span-12 lg:col-span-3 space-y-2">
           {TABS.map(tab => {
             const Icon = tab.icon;
             const isActive = activeTab === tab.id;
             return (
               <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isActive 
                    ? 'bg-on-surface text-white shadow-xl shadow-on-surface/20' 
                    : 'bg-white border border-slate-100 text-slate-400 hover:bg-slate-50'
                }`}
               >
                 <Icon size={18} />
                 {tab.label}
               </button>
             );
           })}
        </aside>

        {/* Content Area */}
        <main className="col-span-12 lg:col-span-9 bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm min-h-[600px]">
           <AnimatePresence mode="wait">
              {activeTab === 'identity' && <TabIdentity key="identity" />}
              {activeTab === 'branding' && <TabBranding key="branding" />}
              {activeTab === 'security' && <TabSecurity key="security" />}
              {activeTab === 'logic' && <TabLogic key="logic" />}
              {activeTab === 'system' && <TabSystem key="system" isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />}
           </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// --- TAB COMPONENTS ---

function TabIdentity() {
  const { user, logout } = useAuth();

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-10">
            <div className="relative group">
               <div className="w-32 h-32 rounded-[2.5rem] bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
                  <img 
                    src={`https://ui-avatars.com/api/?name=${user?.name || 'U'}&background=4F46E5&color=fff&size=200`} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
               </div>
               <button className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-all">
                  <Camera size={18} />
               </button>
            </div>
            <div>
               <h3 className="text-2xl font-black font-headline tracking-tight uppercase text-on-surface">
                 {user?.name || 'Gabi Administrator'}
               </h3>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                 ID: #{user?.id || 'ADMIN-01'}
               </p>
            </div>
         </div>
         <button 
           onClick={logout}
           className="flex items-center gap-2 px-6 py-3 bg-error/10 text-error text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-error hover:text-white transition-all shadow-lg shadow-error/10"
         >
           <LogOut size={16} /> Cerrar Sesión
         </button>
       </div>

       <div className="grid grid-cols-2 gap-8">
          <InputGroup label="Nombre" value={(user?.name || '').split(' ')[0] || ''} />
          <InputGroup label="Apellido" value={(user?.name || '').split(' ')[1] || ''} />
          <div className="col-span-2">
             <InputGroup label="Correo Electrónico" value={user?.email || ''} disabled />
          </div>
       </div>

       <div className="pt-10 border-t border-slate-50 space-y-6">
          <div className="flex items-center gap-3 text-secondary">
             <Lock size={18} />
             <h4 className="text-[10px] font-black uppercase tracking-widest">Seguridad de Acceso</h4>
          </div>
          <div className="grid grid-cols-2 gap-8">
             <InputGroup label="Contraseña Actual" type="password" placeholder="••••••••" />
             <InputGroup label="Nueva Contraseña" type="password" placeholder="••••••••" />
          </div>
       </div>
    </motion.div>
  );
}


function TabBranding() {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
       <div className="grid grid-cols-2 gap-10">
          <div className="space-y-8">
             <div className="flex items-center gap-3">
                <Building2 size={20} className="text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Datos de la Empresa</h3>
             </div>
             <div className="space-y-6">
                <InputGroup label="Razón Social / Nombre Fantasía" value="Arcadia Retail Boutique" />
                <InputGroup label="ID Fiscal (CUIT/NIT)" value="20-38456789-9" />
                <InputGroup label="Dirección Comercial" value="Av. San Martín 450, Piso 2" />
                <InputGroup label="Teléfono de Contacto" value="+54 11 5678-9023" />
             </div>
          </div>

          <div className="space-y-8">
             <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-tertiary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Configuración WhatsApp</h3>
             </div>
             <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-4">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Firma del Ticket Digital</p>
                   <textarea 
                     className="w-full h-40 bg-white border border-slate-200 rounded-2xl p-4 text-xs font-medium focus:ring-4 focus:ring-primary/5 outline-none resize-none"
                     defaultValue="Política de Cambios: 30 días con este recibo.&#10;Seguinos en IG: @arcadia_app&#10;Gracias por elegirnos."
                   />
                </div>
                <div className="flex items-center gap-4 p-4 rounded-3xl bg-tertiary/5 text-tertiary">
                   <CheckCircle2 size={24} />
                   <p className="text-[10px] font-bold uppercase leading-tight">La firma se adjuntará automáticamente al finalizar cada venta en el POS.</p>
                </div>
             </div>
          </div>
       </div>
    </motion.div>
  );
}

function TabSecurity() {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-center justify-center py-20 space-y-6">
       <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary">
          <Shield size={40} />
       </div>
       <div className="text-center">
          <h3 className="text-xl font-black font-headline uppercase tracking-tight text-on-surface">Gestión Unificada de Staff</h3>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 max-w-sm">
            Ahora puedes gestionar todos tus operadores, permisos y accesos desde la pestaña dedicada de "Operadores".
          </p>
       </div>
       <Button 
         onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'operators' }))}
         className="shadow-xl"
       >
          Ir a Operadores
       </Button>
    </motion.div>
  );
}

function TabLogic() {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
       <div className="grid grid-cols-2 gap-12">
          <div className="space-y-10">
             <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Límite Global de Deuda Cuenta Cte</label>
                <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">$</span>
                   <input className="w-full h-16 bg-slate-50 border-none rounded-2xl pl-12 pr-6 text-xl font-headline italic font-black" defaultValue="25000" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Monto máximo para nuevos clientes.</p>
             </div>

             <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Objetivo de Venta Mensual</label>
                <div className="relative">
                   <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">$</span>
                   <input className="w-full h-16 bg-slate-50 border-none rounded-2xl pl-12 pr-6 text-xl font-headline italic font-black" defaultValue="1500000" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Aparece en el KPI general del Dashboard.</p>
             </div>
          </div>

          <div className="space-y-8">
             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Overrides & Seguridad</h4>
             <div className="space-y-4">
                <ToggleRow label="Requerir Clave para Anulaciones" desc="El vendedor debe solicitar permiso admin." defaultChecked />
                <ToggleRow label="Autorización Manual de Exceso" desc="Permite vender sobre el límite con clave." defaultChecked />
                <ToggleRow label="Alertas de Stock en POS" desc="Avisar cuando se vende el último item." />
             </div>
          </div>
       </div>
    </motion.div>
  );
}

function TabSystem({ isDarkMode, setIsDarkMode }: any) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
       <div className="grid grid-cols-2 gap-12">
          <div className="space-y-10">
             <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Personalización de Interfaz</h4>
                <div className="flex gap-4">
                   <button 
                    onClick={() => setIsDarkMode(false)}
                    className={`flex-1 p-6 rounded-3xl border transition-all flex flex-col items-center gap-3 ${!isDarkMode ? 'bg-primary/5 border-primary text-primary shadow-lg shadow-primary/5' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                   >
                      <Sun size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Light Mode</span>
                   </button>
                   <button 
                    onClick={() => setIsDarkMode(true)}
                    className={`flex-1 p-6 rounded-3xl border transition-all flex flex-col items-center gap-3 ${isDarkMode ? 'bg-on-surface border-on-surface text-white shadow-xl shadow-on-surface/20' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                   >
                      <Moon size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Dark Mode</span>
                   </button>
                </div>
             </div>
             
             <div className="space-y-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Idioma del Sistema</h4>
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <Globe size={18} className="text-slate-300" />
                   <select className="flex-1 bg-transparent border-none text-xs font-black uppercase tracking-widest outline-none">
                      <option>Español (Argentina)</option>
                      <option>English (US)</option>
                   </select>
                </div>
             </div>
          </div>

          <div className="space-y-10">
             <div className="p-10 bg-on-surface rounded-[2.5rem] text-white relative overflow-hidden group shadow-2xl shadow-on-surface/20">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                   <Database size={100} />
                </div>
                <div className="relative z-10 space-y-6">
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Continuidad del Negocio</p>
                   <h5 className="text-xl font-headline font-black italic tracking-tight uppercase">Base de Datos Maestra</h5>
                   <p className="text-xs text-white/60 leading-relaxed font-medium">Exporte toda la información (Clientes, Inventario, Ventas) en formato CSV para backups externos o auditoría contable.</p>
                   <button className="flex items-center gap-2 px-6 py-3 bg-tertiary text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-tertiary/20 hover:brightness-110 transition-all">
                      <Download size={16} /> Descargar Master DB
                   </button>
                </div>
             </div>
          </div>
       </div>
    </motion.div>
  );
}

// --- UTILS ---

function InputGroup({ label, value, type = "text", placeholder, disabled }: any) {
  return (
    <div className="space-y-3">
       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
       <input 
          type={type}
          disabled={disabled}
          placeholder={placeholder}
          defaultValue={value}
          className="w-full h-14 bg-slate-50 border-none rounded-2xl px-6 text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none transition-all disabled:opacity-40"
       />
    </div>
  );
}

function ToggleRow({ label, desc, defaultChecked }: any) {
  const [checked, setChecked] = useState(defaultChecked || false);
  return (
    <div className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl">
       <div>
          <p className="text-[10px] font-black text-on-surface uppercase tracking-tight">{label}</p>
          <p className="text-[9px] font-medium text-slate-400 uppercase mt-0.5">{desc}</p>
       </div>
       <button 
          onClick={() => setChecked(!checked)}
          className={`w-12 h-6 rounded-full p-1 transition-all flex items-center ${checked ? 'bg-primary justify-end' : 'bg-slate-200 justify-start'}`}
       >
          <div className="w-4 h-4 bg-white rounded-full shadow-md" />
       </button>
    </div>
  );
}
