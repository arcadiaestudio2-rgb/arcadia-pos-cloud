import React, { useState } from 'react';
import { 
  Settings, 
  TrendingUp, 
  CreditCard, 
  ShieldCheck, 
  Smartphone, 
  Database, 
  Plus, 
  Trash2, 
  RefreshCw, 
  DollarSign, 
  Percent, 
  Hash, 
  Monitor, 
  Lock, 
  Key, 
  AlertTriangle,
  Palette,
  CheckCircle2,
  Mail,
  Zap,
  Save,
  Globe,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from '../common/CommonUI';
import { api } from '../../services/api';

const TABS = [
  { id: 'finance', label: 'Estrategia & Inflación', icon: TrendingUp },
  { id: 'payments', label: 'Matriz de Cobro', icon: CreditCard },
  { id: 'inventory', label: 'Diccionario & Stock', icon: Database },
  { id: 'security', label: 'Terminales & Seguridad', icon: ShieldCheck },
  { id: 'automation', label: 'WhatsApp & Backups', icon: Smartphone },
];

export function POSSettings() {
  const [activeTab, setActiveTab] = useState('finance');

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* HEADER: MISSION CONTROL */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-10 py-8 flex justify-between items-end shadow-sm">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                 <Settings size={16} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Business Intelligence Engine</p>
           </div>
           <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface uppercase">Configuración Global</h2>
        </div>
        <button 
          onClick={() => toast.success('Lógica Maestra Actualizada Correctamente')}
          className="flex items-center gap-3 px-8 py-3 bg-on-surface text-white font-black rounded-2xl shadow-xl shadow-on-surface/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-[0.2em]"
        >
           <Save size={18} /> Aplicar Lógica Maestra
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* TAB RAIL */}
        <aside className="w-80 border-r border-slate-100 bg-white p-8 space-y-2 overflow-y-auto">
           {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all border ${
                    isActive 
                      ? 'bg-on-surface text-white border-on-surface shadow-xl' 
                      : 'bg-white border-transparent text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
           })}
        </aside>

        {/* WORKSPACE */}
        <main className="flex-1 overflow-y-auto p-12 bg-slate-50/30">
           <AnimatePresence mode="wait">
              {activeTab === 'finance' && <TabFinance key="finance" />}
              {activeTab === 'payments' && <TabPayments key="payments" />}
              {activeTab === 'inventory' && <TabInventory key="inventory" />}
              {activeTab === 'security' && <TabSecurity key="security" />}
              {activeTab === 'automation' && <TabAutomation key="automation" />}
           </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS: FINANCE ---
function TabFinance() {
  const [adjustment, setAdjustment] = useState(15);
  const [scope, setScope] = useState('all');
  const [loading, setLoading] = useState(false);

  const handleAdjust = async () => {
    setLoading(true);
    try {
      await api.massPriceAdjust(adjustment);
      toast.success(`Ajuste del ${adjustment}% aplicado a ${scope === 'all' ? 'todos los productos' : scope}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12 max-w-4xl">
       {/* INFLATION BUTTON: MASS ADJUSTER */}
       <section className="bg-on-surface p-12 rounded-[3.5rem] text-white space-y-8 shadow-2xl shadow-on-surface/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-5">
             <TrendingUp size={160} />
          </div>
          <div className="relative z-10 space-y-6">
             <div className="flex items-center gap-3">
                <Zap size={24} className="text-tertiary" />
                <h3 className="text-xl font-black font-headline uppercase tracking-tight italic">Estrategia Anti-InflACIÓN</h3>
             </div>
             <p className="text-sm text-white/60 font-medium max-w-xl">
                Ajuste masivo de precios. Esta acción afectará a todos los productos seleccionados y se reflejará instantáneamente en el POS de todas las sucursales.
             </p>
             <div className="grid grid-cols-2 gap-8 items-end">
                <div className="space-y-4">
                   <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Monto del Ajuste (%)</label>
                   <div className="relative">
                      <input 
                        type="number" 
                        className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-3xl font-black font-headline italic outline-none focus:ring-4 focus:ring-tertiary/20" 
                        value={adjustment}
                        onChange={(e) => setAdjustment(Number(e.target.value))}
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-tertiary font-black">%</span>
                   </div>
                </div>
                <div className="space-y-4">
                   <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Alcance de Acción</label>
                   <select 
                    className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest outline-none"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                   >
                      <option value="all">Todos los Productos</option>
                      <option value="Vestimenta">Por Categoría (Vestimenta)</option>
                      <option value="Alpine">Por Proveedor (Alpine)</option>
                   </select>
                </div>
             </div>
             <button 
               disabled={loading}
               onClick={handleAdjust}
               className="w-full py-5 bg-white text-on-surface font-black rounded-2xl text-[10px] uppercase tracking-[0.4em] shadow-xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
             >
                {loading && <RefreshCw size={16} className="animate-spin" />}
                Ejecutar Actualización Maestra
             </button>
          </div>
       </section>

       {/* CURRENCY & TAXES */}
       <div className="grid grid-cols-2 gap-10">
          <WhiteCard icon={Globe} label="Localización & Moneda" desc="Parámetros de divisa regional.">
             <div className="space-y-6 mt-6">
                <InputGroup label="Símbolo Moneda" value="$" />
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                   <span className="text-[10px] font-black uppercase text-slate-400">Redondeo Automático (Efectivo)</span>
                   <Toggle />
                </div>
             </div>
          </WhiteCard>

          <WhiteCard icon={Percent} label="Motor Impositivo" desc="Gestión de IVA / Percepciones.">
             <div className="space-y-6 mt-6">
                <InputGroup label="IVA por Defecto (%)" value="21" />
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                   <span className="text-[10px] font-black uppercase text-slate-400">Mostrar Impuestos en Ticket</span>
                   <Toggle defaultChecked />
                </div>
             </div>
          </WhiteCard>
       </div>
    </motion.div>
  );
}

// --- SUB-COMPONENTS: PAYMENTS ---
function TabPayments() {
  const [methods] = useState([
    { id: 1, name: 'Efectivo', adjust: -10, icon: DollarSign },
    { id: 2, name: 'Tarjeta Crédito', adjust: 15, icon: CreditCard },
    { id: 3, name: 'Transferencia', adjust: 0, icon: RefreshCw },
    { id: 4, name: 'Cuenta Corriente', adjust: 5, icon: Clock },
  ]);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
       <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
             <CreditCard size={20} className="text-primary" />
             <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Matriz de Cobro & Recargos</h3>
          </div>
          <button className="flex items-center gap-2 px-6 py-2 bg-on-surface text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg">
             <Plus size={16} /> Nuevo Método
          </button>
       </div>

       <div className="grid grid-cols-2 gap-6">
          {methods.map(m => (
            <div key={m.id} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all group">
               <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-on-surface group-hover:bg-primary group-hover:text-white transition-all">
                     <m.icon size={24} />
                  </div>
                  <div className="flex gap-2">
                     <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-300 hover:text-primary transition-all"><Settings size={18} /></button>
                     <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-300 hover:text-error transition-all"><Trash2 size={18} /></button>
                  </div>
               </div>
               <h4 className="text-xl font-black font-headline tracking-tight uppercase text-on-surface">{m.name}</h4>
               <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ajuste Automático</p>
                  <span className={`text-sm font-black font-headline italic ${m.adjust > 0 ? 'text-error' : m.adjust < 0 ? 'text-tertiary' : 'text-slate-300'}`}>
                     {m.adjust > 0 ? '+' : ''}{m.adjust}%
                  </span>
               </div>
            </div>
          ))}
       </div>
    </motion.div>
  );
}

// --- SUB-COMPONENTS: INVENTORY ---
function TabInventory() {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
       <div className="grid grid-cols-2 gap-10">
          <WhiteCard icon={Database} label="Diccionario de Atributos" desc="Listas maestras para evitar duplicidad de datos.">
             <div className="space-y-10 mt-8">
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Curva de Talles (General)</label>
                      <button className="p-1 bg-slate-50 rounded-lg text-primary hover:bg-primary hover:text-white transition-all"><Plus size={14} /></button>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', '35', '36', '37', '38', '39', '40'].map(t => (
                        <span key={t} className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase">{t}</span>
                      ))}
                   </div>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paleta de Colores</label>
                      <button className="p-1 bg-slate-50 rounded-lg text-primary hover:bg-primary hover:text-white transition-all"><Plus size={14} /></button>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {['Negro', 'Blanco', 'Azul Marino', 'Rojo Alpine', 'Gris Melange'].map(c => (
                        <div key={c} className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
                           <div className="w-2 h-2 rounded-full bg-on-surface" />
                           <span className="text-[10px] font-black text-slate-500 uppercase">{c}</span>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </WhiteCard>

          <div className="space-y-8">
             <WhiteCard icon={AlertTriangle} label="Umbrales de Control" desc="Parámetros globales de stock crítico.">
                <div className="space-y-8 mt-6">
                   <InputGroup label="Alerta de Stock Bajo (u.)" value="5" />
                   <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed font-medium">Toda variante que baje de este número disparará la alerta en el Dashboard.</p>
                </div>
             </WhiteCard>

             <div className="p-10 bg-tertiary/10 rounded-[2.5rem] border border-tertiary/20 flex gap-6">
                <Zap size={32} className="text-tertiary shrink-0" />
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-tertiary mb-1">Optimizador Selectivo</p>
                   <p className="text-xs font-medium text-tertiary/70 leading-relaxed uppercase">El diccionario sincroniza automáticamente los dropdowns de creación de producto para mantener la base de datos limpia.</p>
                </div>
             </div>
          </div>
       </div>
    </motion.div>
  );
}

// --- SUB-COMPONENTS: SECURITY ---
function TabSecurity() {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
       <div className="grid grid-cols-2 gap-10">
          <div className="space-y-8">
             <div className="flex items-center gap-3">
                <Monitor size={20} className="text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Terminales Registradas</h3>
             </div>
             <div className="space-y-4">
                {['Caja Central', 'Deposito Logística', 'Tablet Móvil Ventas'].map(terminal => (
                   <div key={terminal} className="p-5 flex justify-between items-center bg-white border border-slate-100 rounded-2xl group hover:border-primary transition-all">
                      <div className="flex items-center gap-4">
                         <Monitor size={16} className="text-slate-300" />
                         <span className="text-xs font-black uppercase text-on-surface">{terminal}</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Activa Ahora</span>
                   </div>
                ))}
                <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-primary hover:text-primary transition-all">
                   Registrar Nueva Estación
                </button>
             </div>
          </div>

          <div className="space-y-8">
             <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-error" />
                <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Validación de Autoridad (PIN)</h3>
             </div>
             <div className="space-y-4">
                <ToggleRow label="Autorización para Anulaciones" desc="Se requiere PIN Admin para borrar tickets." defaultChecked />
                <ToggleRow label="Exceso de Crédito Manual" desc="El sistema frena ventas sobre el límite sin PIN." defaultChecked />
                <ToggleRow label="Descuento Manual > 10%" desc="Limitar la autonomía de rebajas para vendedores." defaultChecked />
             </div>
             
             <div className="p-8 bg-on-surface rounded-[2.5rem] space-y-4">
                <div className="flex items-center gap-2 text-white/40">
                   <Lock size={14} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Inactivity Timeout</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-xs font-bold text-white uppercase">Cierre de Sesión Auto:</span>
                   <select className="bg-white/10 text-white rounded-lg px-3 py-1 text-xs outline-none">
                      <option>15 Minutos</option>
                      <option>30 Minutos</option>
                      <option>Nunca</option>
                   </select>
                </div>
             </div>
          </div>
       </div>
    </motion.div>
  );
}

// --- SUB-COMPONENTS: AUTOMATION ---
function TabAutomation() {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-12">
       <div className="grid grid-cols-2 gap-10">
          <div className="space-y-8">
             <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-tertiary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Pasarela WhatsApp API</h3>
             </div>
             <div className="space-y-6 bg-white p-10 rounded-[3rem] border border-slate-100">
                <InputGroup label="WhatsApp Business Phone ID" value="128503849102" />
                <InputGroup label="API Token (Permanente)" value="••••••••••••••••••••••••••••••••••••" type="password" />
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                   <div className="w-3 h-3 rounded-full bg-tertiary animate-pulse" />
                   <span className="text-[10px] font-black uppercase text-slate-400">Estado: Conexión Activa</span>
                   <button className="ml-auto text-[10px] font-black text-primary uppercase">Verificar Payload</button>
                </div>
             </div>
          </div>

          <div className="space-y-8">
             <div className="flex items-center gap-3">
                <Database size={20} className="text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">Continuidad & Backups</h3>
             </div>
             <div className="space-y-6">
                <div className="p-8 bg-slate-50 border border-slate-100 rounded-3xl space-y-6">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400">Frecuencia de Respaldo</span>
                      <select className="bg-white border-none rounded-xl px-4 py-2 text-xs font-black outline-none shadow-sm">
                         <option>Diario (00:00 hs)</option>
                         <option>Semanal (Domingos)</option>
                      </select>
                   </div>
                   <div className="flex items-center gap-2 text-slate-400">
                      <Mail size={16} />
                      <span className="text-[9px] font-bold uppercase">Enviar copia al Propietario (CSV)</span>
                   </div>
                </div>

                <div className="p-10 bg-on-surface rounded-[3rem] text-white relative overflow-hidden flex flex-col justify-center">
                   <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Database size={80} />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Acción Destructiva / Crítica</p>
                   <h5 className="text-lg font-black font-headline tracking-tight uppercase leading-none">Limpiar Datos de Prueba</h5>
                   <p className="text-[10px] font-medium text-white/50 uppercase mt-2 mb-6 leading-tight">Borra permanentemente todas las ventas e inventario actual.</p>
                   <button className="py-4 bg-error text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-error/20">
                      Formatear Base de Datos
                   </button>
                </div>
             </div>
          </div>
       </div>
    </motion.div>
  );
}

// --- SHARED UTILS ---

function WhiteCard({ icon: Icon, label, desc, children }: any) {
  return (
    <div className="p-10 bg-white border border-slate-100 rounded-[3rem] shadow-sm flex flex-col">
       <div className="flex items-center gap-3 mb-2">
          <Icon size={18} className="text-slate-400" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</h3>
       </div>
       <p className="text-xs font-black uppercase tracking-tighter text-on-surface">{desc}</p>
       {children}
    </div>
  );
}

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

function Toggle({ defaultChecked }: any) {
  const [checked, setChecked] = useState(defaultChecked || false);
  return (
    <button 
       onClick={() => setChecked(!checked)}
       className={`w-12 h-6 rounded-full p-1 transition-all flex items-center ${checked ? 'bg-primary justify-end' : 'bg-slate-200 justify-start'}`}
    >
       <div className="w-4 h-4 bg-white rounded-full shadow-md" />
    </button>
  );
}

function ToggleRow({ label, desc, defaultChecked }: any) {
  const [checked, setChecked] = useState(defaultChecked || false);
  return (
    <div className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl group hover:border-primary transition-all">
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
