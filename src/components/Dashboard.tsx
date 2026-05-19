import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  ShoppingCart, 
  Target, 
  Download, 
  MoreVertical, 
  CreditCard, 
  Wallet, 
  Banknote,
  Eye,
  EyeOff,
  AlertTriangle,
  Zap,
  Clock,
  User,
  MessageSquare,
  ArrowRight,
  Filter,
  BarChart3,
  Flame,
  Snowflake,
  ShieldAlert
} from 'lucide-react';
import { toast, StatCard } from './common/CommonUI';
import { api } from '../services/api';
import { InstallButton } from './common/InstallButton';

export function Dashboard() {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [timeFilter, setTimeFilter] = useState('Hoy');
  const [stats, setStats] = useState({ 
    revenue: 0, 
    cost: 0, 
    ar: 0, 
    topSeller: { name: '...', sales: 0, revenue: 0 },
    criticalStock: [] as any[],
    agingDebtors: [] as any[],
    deadStock: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.fetchStats();
        setStats(data);
      } catch (e) {
        toast.error('Error sincronizando con el servidor SQL');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [timeFilter]);

  const formatLastSale = (dateStr: string) => {
    if (!dateStr || dateStr === '2000-01-01') return 'Sin ventas';
    const date = new Date(dateStr);
    const diffTime = Math.abs(new Date().getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} días`;
    return `${Math.floor(diffDays / 30)} meses`;
  };

  const formatMoney = (val: number) => {
    if (privacyMode) return '****';
    return `$${val.toLocaleString('es-AR')}`;
  };

  const margin = stats.revenue > 0 ? ((stats.revenue - stats.cost) / stats.revenue * 100).toFixed(1) : '0';

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 max-w-[1600px] mx-auto min-h-screen bg-surface">
      
      {/* HEADER: EXECUTIVE COMMAND */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
             <div className="w-10 h-10 rounded-2xl bg-on-surface flex items-center justify-center text-white shadow-xl shadow-on-surface/20">
                <BarChart3 size={20} />
             </div>
             <div>
                <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface">Torre de Control</h2>
                <p className="text-secondary font-medium text-xs opacity-60 uppercase tracking-widest mt-1">ArcadiAPP Indumentaria — Central de Inteligencia</p>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
             {['Hoy', 'Ayer', 'Mes', 'Custom'].map(f => (
                <button 
                 key={f}
                 onClick={() => setTimeFilter(f)}
                 className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${
                   timeFilter === f ? 'bg-on-surface text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                 }`}
                >
                  {f}
                </button>
             ))}
          </div>
          <button 
           onClick={() => setPrivacyMode(!privacyMode)}
           className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-primary transition-all shadow-sm"
          >
             {privacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
          <InstallButton />
          
          <button 
            onClick={() => toast.success('Generando Reporte Ejecutivo PDF...')}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-[0.2em]"
          >
            <Download size={18} /> Ejecutivo PDF
          </button>
        </div>
      </header>

      {/* KPI LAYER: FINANCIAL VELOCITY */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
         <StatCard 
            label="Ingresos Netos" 
            value={formatMoney(stats.revenue)} 
            trend={12.5} 
            icon={TrendingUp} 
            hideValue={privacyMode}
         />
         <StatCard 
            label="Margen de Utilidad" 
            value={privacyMode ? '****' : `${margin}%`} 
            trend={2.4} 
            icon={Target} 
            color="tertiary"
         />
         <StatCard 
            label="Cuentas por Cobrar" 
            value={formatMoney(stats.ar)} 
            trend={-5.8} 
            icon={Wallet} 
            color="secondary"
            hideValue={privacyMode}
         />
         <div className="bg-on-surface p-8 rounded-[2.5rem] text-white flex flex-col justify-between relative overflow-hidden group shadow-2xl shadow-on-surface/20">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
               <User size={80} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Top Seller Hoy</p>
            <div>
               <h4 className="text-xl font-black font-headline tracking-tighter uppercase mb-1">{stats.topSeller.name}</h4>
               <p className="text-[10px] font-bold text-white/60 uppercase">{stats.topSeller.sales} Ventas • {formatMoney(stats.topSeller.revenue)}</p>
            </div>
            <div className="flex items-center gap-2 mt-4">
               <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} className="h-full bg-tertiary" />
               </div>
               <span className="text-[10px] font-black text-tertiary">85% Meta</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-10">
        
        {/* ANALYTICS: SALES FLOW & PAYMENT MIX */}
        <section className="col-span-12 lg:col-span-8 space-y-10">
           
           {/* Main Growth Chart */}
           <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <TrendingUp size={20} className="text-primary" />
                    <h3 className="text-xl font-black font-headline uppercase tracking-tighter">Tendencia de Ingresos vs. CMV</h3>
                 </div>
                 <div className="flex gap-6">
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-primary" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ventas Reales</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-slate-200" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Costo Mercadería</span>
                   </div>
                 </div>
              </div>

              <div className="h-80 flex items-end justify-between gap-6 px-4 relative">
                 <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                    {[1,2,3,4].map(i => <div key={i} className="w-full h-px bg-on-surface" />)}
                 </div>
                 {[40, 65, 45, 90, 75, 55, 60].map((h, i) => (
                    <div key={i} className="flex-1 group flex flex-col items-center gap-4 z-10">
                       <div className="w-full flex items-end gap-1.5 h-full">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            className="flex-1 bg-primary rounded-t-2xl group-hover:brightness-110 transition-all cursor-pointer relative shadow-lg shadow-primary/5"
                          >
                             <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-on-surface text-white text-[10px] font-black px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                {formatMoney(h * 1000)}
                             </div>
                          </motion.div>
                          <motion.div 
                             initial={{ height: 0 }}
                             animate={{ height: `${h * 0.4}%` }}
                             className="flex-1 bg-slate-100 rounded-t-2xl shadow-inner"
                          />
                       </div>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'][i]}
                       </span>
                    </div>
                 ))}
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Payment Mix Pie Mock */}
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
                 <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
                    <DollarSign size={16} /> Composición de Caja
                 </h3>
                 <div className="flex-1 flex flex-col items-center justify-center space-y-10">
                    <div className="relative w-56 h-56 rotate-[-90deg]">
                       <svg className="w-full h-full" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f8fafc" strokeWidth="15" />
                          <motion.circle 
                            cx="50" cy="50" r="40" fill="transparent" stroke="#0052CC" strokeWidth="15" 
                            strokeDasharray="251.2" strokeDashoffset="100.4" strokeLinecap="round" 
                          />
                          <motion.circle 
                            cx="50" cy="50" r="40" fill="transparent" stroke="#6ffbbe" strokeWidth="15" 
                            strokeDasharray="251.2" strokeDashoffset="188.4" strokeLinecap="round" 
                          />
                       </svg>
                       <div className="absolute inset-0 rotate-[90deg] flex flex-col items-center justify-center">
                          <span className="text-3xl font-black font-headline italic italic text-on-surface">62%</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Digital</span>
                       </div>
                    </div>
                    <div className="w-full grid grid-cols-2 gap-4">
                       <PaymentMixItem label="Efectivo" val="38%" color="bg-primary" />
                       <PaymentMixItem label="Tarjeta" val="45%" color="bg-tertiary" />
                       <PaymentMixItem label="Cuenta Cte" val="12%" color="bg-secondary" />
                       <PaymentMixItem label="Transf." val="5%" color="bg-slate-200" />
                    </div>
                 </div>
              </div>

              {/* Peak Hours Heatmap Mock */}
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
                 <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-2">
                    <Clock size={16} /> Horarios de Pico
                 </h3>
                 <div className="flex-1 grid grid-cols-4 grid-rows-6 gap-2">
                    {Array.from({ length: 24 }).map((_, i) => {
                       const intensity = [0,1,2,5,8,10,12,8,5,2,1,0][i % 12];
                       return (
                          <div 
                            key={i} 
                            className={`rounded-xl transition-all hover:scale-105 cursor-pointer flex items-center justify-center text-[8px] font-bold ${
                              intensity > 8 ? 'bg-primary text-white' : intensity > 4 ? 'bg-primary/30 text-primary' : 'bg-slate-50 text-slate-300'
                            }`}
                          >
                             {i}h
                          </div>
                       );
                    })}
                 </div>
                 <p className="text-[10px] font-bold text-slate-400 mt-6 uppercase text-center italic">Mejor horario para refuerzo de staff: 14:00 - 18:00 hs</p>
              </div>
           </div>
        </section>

        {/* PROACTIVE ALERTS & SMART WIDGETS */}
        <aside className="col-span-12 lg:col-span-4 space-y-10">
           
            <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2 text-error">
                    <ShieldAlert size={18} />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">Alerta Stock Crítico</h3>
                 </div>
                 <span className="text-[10px] font-black text-slate-300">ACTUAR AHORA</span>
              </div>
              <div className="space-y-4">
                 {stats.criticalStock.length > 0 ? stats.criticalStock.map(item => (
                    <div key={item.sku} className="p-5 rounded-2xl bg-error/5 border border-error/10 flex justify-between items-center">
                       <div>
                          <p className="text-[10px] font-mono font-bold text-error/40 mb-1">{item.sku}</p>
                          <p className="text-xs font-black text-on-surface uppercase">{item.name}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-lg font-black font-headline text-error italic">{item.stock} u.</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Mín: {item.min}</p>
                       </div>
                    </div>
                 )) : (
                    <div className="py-10 text-center text-slate-300">
                       <p className="text-[10px] font-black uppercase tracking-widest">Todo en orden</p>
                    </div>
                 )}
                 <button className="w-full py-4 bg-on-surface text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-2xl hover:brightness-110 shadow-xl shadow-on-surface/20">
                    Sugerir Pedido Automático
                 </button>
              </div>
            </section>

           <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2 text-secondary">
                    <User size={18} />
                    <h3 className="text-[10px] font-black uppercase tracking-widest">Morosidad Crítica (CC)</h3>
                 </div>
              </div>
              <div className="space-y-4">
                 {stats.agingDebtors.length > 0 ? stats.agingDebtors.map(debtor => (
                    <div key={debtor.name} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all group">
                       <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${debtor.days > 60 ? 'bg-error shadow-error/20' : 'bg-warning shadow-warning/20'}`}>
                          <Clock size={18} />
                       </div>
                       <div className="flex-1">
                          <p className="text-xs font-black text-on-surface uppercase">{debtor.name}</p>
                          <p className={`text-[10px] font-bold uppercase ${debtor.days > 60 ? 'text-error' : 'text-warning'}`}>
                             {debtor.days ? `${debtor.days} Días de Mora` : 'Sin ventas recientes'}
                          </p>
                       </div>
                       <div className="text-right flex items-center gap-3">
                          <span className="text-sm font-black font-headline italic">{formatMoney(debtor.debt)}</span>
                          <button className="p-2 bg-on-surface text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                             <MessageSquare size={14} />
                          </button>
                       </div>
                    </div>
                 )) : (
                    <div className="py-10 text-center text-slate-300">
                       <p className="text-[10px] font-black uppercase tracking-widest">Sin deudores morosos</p>
                    </div>
                 )}
              </div>
           </section>

           <section className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-2 text-slate-400">
                 <Snowflake size={18} />
                 <h3 className="text-[10px] font-black uppercase tracking-widest">Alerta Stock Hueso (Inactivo)</h3>
              </div>
              <div className="space-y-2">
                 {stats.deadStock.length > 0 ? stats.deadStock.map(item => (
                    <div key={item.uuid} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0 group">
                       <div>
                          <p className="text-xs font-bold text-on-surface uppercase group-hover:text-primary transition-colors">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-300 uppercase">Sin rotación: {formatLastSale(item.last_sale_date)}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black text-slate-400 uppercase">{item.stock} u.</p>
                          <p className="text-[9px] font-bold text-error uppercase">Ref. Perdido: -{formatMoney(item.loss)}</p>
                       </div>
                    </div>
                 )) : (
                    <div className="py-10 text-center text-slate-300">
                       <p className="text-[10px] font-black uppercase tracking-widest">Alta rotación detectada</p>
                    </div>
                 )}
                 <button className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-tertiary/10 text-tertiary text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-tertiary hover:text-white transition-all">
                    Liquidación Relámpago (SALE) <ArrowRight size={14} />
                 </button>
              </div>
           </section>

           {/* Efficiency Tools */}
           <div className="bg-tertiary p-8 rounded-[3rem] text-white space-y-4 shadow-xl shadow-tertiary/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Eficiencia Operativa</p>
              <div className="flex justify-between items-end">
                 <div>
                    <h5 className="text-4xl font-black font-headline italic tracking-tighter">$15.2k</h5>
                    <p className="text-[9px] font-bold text-white/60 uppercase">Ticket Promedio Bruto</p>
                 </div>
                 <div className="p-4 bg-white/10 rounded-2xl">
                    <Zap size={24} className="text-white" />
                 </div>
              </div>
              <div className="h-px bg-white/10 my-4" />
              <div className="flex justify-between items-center">
                 <span className="text-[10px] font-bold text-white/40 uppercase">Impacto Descuentos:</span>
                 <span className="text-xs font-black text-white italic">-12% Rev</span>
              </div>
           </div>
        </aside>

      </div>
    </div>
  );
}

function PaymentMixItem({ label, val, color }: any) {
  return (
    <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 border border-slate-100/50">
       <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${color}`} />
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
       </div>
       <span className="text-[10px] font-black text-on-surface italic">{val}</span>
    </div>
  );
}
