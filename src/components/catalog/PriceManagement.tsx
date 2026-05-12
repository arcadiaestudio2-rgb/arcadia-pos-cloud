import React, { useState } from 'react';
import { 
  Percent, 
  Search, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  TrendingUp,
  Save
} from 'lucide-react';
import { 
  calculatePVP, 
  calculateMargin, 
  calculateCost, 
  IVA_DEFAULT 
} from '../../utils/pricing';
import { formatCurrency } from '../common/CommonUI';

export function PriceManagement() {
  const [adjustmentValue, setAdjustmentValue] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState<'cost' | 'margin' | 'pvp'>('cost');
  const [selectedBrand, setSelectedBrand] = useState('Todas las Marcas');

  // Standardized Pricing Logic for Bulk Update
  const getAdjustmentLabel = () => {
    switch(adjustmentType) {
      case 'cost': return 'Indexación de Costo (Insumos/Inflación)';
      case 'margin': return 'Ajuste de Rentabilidad (Margen)';
      case 'pvp': return 'Ajuste Directo a Precio de Venta';
      default: return '';
    }
  };

  return (
    <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 max-w-7xl mx-auto min-h-screen bg-surface">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <h2 className="text-3xl lg:text-4xl font-black font-headline tracking-tighter text-on-surface uppercase">Gestión de Precios</h2>
          <p className="text-secondary font-medium mt-1 text-sm">Ajustes masivos de rentabilidad e indexación.</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 lg:gap-10">
        {/* Bulk Action Card */}
        <div className="col-span-12 lg:col-span-4 space-y-6 lg:space-y-10">
          <section className="bg-white p-6 lg:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8 relative overflow-hidden">
            <div className="flex items-center gap-2 p-1.5 bg-primary/5 rounded-xl w-fit relative z-10">
              <Zap size={14} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Actualización Masiva</span>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtrar por Marca / Entidad</label>
                <select 
                  className="w-full h-14 bg-slate-50 border-none rounded-2xl px-5 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                >
                  <option>Todas las Marcas</option>
                  <option>Alpine Pro</option>
                  <option>Luxe Core</option>
                  <option>Zen Tech</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo de Ajuste</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cost', 'margin', 'pvp'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setAdjustmentType(type)}
                      className={`py-3 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                        adjustmentType === type 
                          ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                          : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'
                      }`}
                    >
                      {type === 'cost' ? 'Costo' : type === 'margin' ? 'Margen' : 'PVP'}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] font-bold text-slate-400 italic mt-1 px-1">
                  {getAdjustmentLabel()}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {adjustmentType === 'margin' ? 'Puntos de Margen (+/-)' : 'Porcentaje de Ajuste (%)'}
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">
                      {adjustmentValue >= 0 ? '+' : ''}
                    </span>
                    <input 
                      type="number"
                      className="w-full h-14 bg-slate-50 border-none rounded-2xl pl-10 pr-4 text-sm font-black focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      placeholder="0.00"
                      value={adjustmentValue}
                      onChange={(e) => setAdjustmentValue(Number(e.target.value))}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      {adjustmentType === 'margin' ? 'pts' : '%'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 lg:p-6 rounded-3xl bg-orange-50 border border-orange-100 flex gap-3 items-start">
                <AlertCircle className="text-orange-500 shrink-0" size={18} />
                <p className="text-[10px] font-bold text-orange-700 leading-relaxed uppercase">
                  Atención: Esta acción modificará permanentemente el PVP de todos los SKUs filtrados.
                </p>
              </div>

              <button className="w-full py-5 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                <TrendingUp size={18} />
                Aplicar Indexación
              </button>
            </div>
            
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-primary/5 rounded-full blur-3xl opacity-50" />
          </section>

          <section className="bg-white p-6 lg:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6">
             <div className="flex justify-between items-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Último Ajuste</p>
                <span className="text-[9px] font-bold text-slate-300">12/04/2026</span>
             </div>
             <div className="flex items-end justify-between">
                <div>
                   <h4 className="text-3xl font-black text-tertiary font-headline tracking-tighter italic">+12.4%</h4>
                   <p className="text-[10px] font-bold text-slate-400 uppercase">Ajuste Alpine Pro</p>
                </div>
                <CheckCircle2 size={32} className="text-tertiary" />
             </div>
          </section>
        </div>

        {/* Preview List Card */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
           <div className="p-6 lg:p-10 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xl font-black font-headline tracking-tight uppercase">Previsualización</h3>
              <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                 <button className="px-6 py-2 text-[10px] font-black uppercase tracking-widest bg-white text-primary shadow-sm rounded-xl">Afectados</button>
                 <button className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Todo el Catálogo</button>
              </div>
           </div>
           
           <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                  <tr>
                    <th className="py-5 px-8 text-[9px] font-black uppercase tracking-widest text-slate-400">SKU / Producto</th>
                    <th className="py-5 px-8 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">PVP Actual</th>
                    <th className="py-5 px-8 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Nuevo PVP</th>
                    <th className="py-5 px-8 text-[9px] font-black uppercase tracking-widest text-slate-400"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { sku: 'CHQ-NOR-AZ-M', name: 'Chaqueta Alpine', cost: 65000, margin: 45 },
                    { sku: 'REM-AIR-GR-S', name: 'Remera Luxe', cost: 8500, margin: 40 },
                    { sku: 'BOT-TRE-NG-42', name: 'Botas Zen', cost: 48000, margin: 47 },
                  ].map((p) => {
                    const oldPvp = calculatePVP(p.cost, p.margin, IVA_DEFAULT);
                    let newPvp = oldPvp;
                    let newCost = p.cost;
                    let newMargin = p.margin;

                    // Bidirectional calculation based on adjustment type
                    if (adjustmentType === 'cost') {
                      newCost = p.cost * (1 + adjustmentValue / 100);
                      newPvp = calculatePVP(newCost, p.margin, IVA_DEFAULT);
                    } else if (adjustmentType === 'margin') {
                      newMargin = p.margin + adjustmentValue;
                      newPvp = calculatePVP(p.cost, newMargin, IVA_DEFAULT);
                    } else if (adjustmentType === 'pvp') {
                      newPvp = oldPvp * (1 + adjustmentValue / 100);
                      newMargin = calculateMargin(p.cost, newPvp, IVA_DEFAULT);
                    }

                    return (
                      <tr key={p.sku} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-6 px-8">
                           <p className="text-[10px] font-mono font-bold text-slate-300 mb-0.5">{p.sku}</p>
                           <p className="text-xs font-black text-on-surface uppercase tracking-tight">{p.name}</p>
                        </td>
                        <td className="py-6 px-8 text-right font-bold text-slate-400 text-sm italic">
                          <div className="flex flex-col">
                            <span>{formatCurrency(oldPvp)}</span>
                            <span className="text-[9px] opacity-60">Cost: {formatCurrency(p.cost)}</span>
                          </div>
                        </td>
                        <td className="py-6 px-8 text-right font-black text-primary text-sm italic">
                          <div className="flex flex-col">
                            <span>{formatCurrency(newPvp)}</span>
                            <span className={`text-[9px] ${adjustmentType === 'margin' ? 'text-tertiary' : 'opacity-60'}`}>
                              {adjustmentType === 'margin' ? `Margen: ${newMargin.toFixed(1)}%` : `Cost: ${formatCurrency(newCost)}`}
                            </span>
                          </div>
                        </td>
                         <td className="py-6 px-8 text-right">
                           <button className="w-10 h-10 flex items-center justify-center bg-white border border-slate-100 rounded-xl text-slate-300 hover:text-primary transition-all shadow-sm">
                             <Save size={16} />
                           </button>
                         </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
           </div>
        </div>
      </div>
    </div>
  );
}
