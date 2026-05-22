import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Settings, 
  Printer, 
  Zap,
  DollarSign,
  CreditCard,
  TrendingUp,
  Clock,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { api } from '../../services/api';

interface Props {
  dateFilter?: string;
  onClose: () => void;
}

type DateFilter = 'Hoy' | 'Ayer' | '7 Días' | '30 Días';

function getDateRange(filter: DateFilter): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toISO = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (filter) {
    case 'Hoy': {
      const today = toISO(now);
      return { from: `${today}T00:00:00`, to: `${today}T23:59:59` };
    }
    case 'Ayer': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yd = toISO(y);
      return { from: `${yd}T00:00:00`, to: `${yd}T23:59:59` };
    }
    case '7 Días': {
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 6);
      return { from: `${toISO(d7)}T00:00:00`, to: `${toISO(now)}T23:59:59` };
    }
    case '30 Días': {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 29);
      return { from: `${toISO(d30)}T00:00:00`, to: `${toISO(now)}T23:59:59` };
    }
    default: {
      const today = toISO(now);
      return { from: `${today}T00:00:00`, to: `${today}T23:59:59` };
    }
  }
}

export function ShiftSummary({ dateFilter = 'Hoy', onClose }: Props) {
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get the starting balance from localStorage
  const storedBalance = localStorage.getItem('arcadia_cash_starting_balance');
  const startingBalance = storedBalance ? parseFloat(storedBalance) : 0;

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setIsLoading(true);
        const { from, to } = getDateRange(dateFilter as DateFilter);
        const data = await api.getSalesForPeriod(from, to);
        setSales(data || []);
      } catch (error) {
        console.error('Error fetching sales for ShiftSummary:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSales();
  }, [dateFilter]);

  // Aggregate stats
  let cashTotal = 0;
  let cardTotal = 0;
  let storeCreditTotal = 0;
  let totalSales = 0;
  let operationsCount = 0;

  sales.forEach((sale: any) => {
    if (sale.status && sale.status === 'voided') return;
    operationsCount++;
    totalSales += sale.total;

    const method = (sale.payment_method || '').toLowerCase().trim();

    if (method === 'efectivo' || method === 'cash') {
      cashTotal += sale.total;
    } else if (method === 'tarjeta' || method === 'debit' || method === 'credit' || method === 'qr' || method === 'credito') {
      cardTotal += sale.total;
    } else if (method === 'cuenta_corriente' || method === 'store_credit' || method === 'storecredit') {
      storeCreditTotal += sale.total;
    } else if (method === 'mixto' || method === 'mixed') {
      const cashPart = sale.payment_details?.cash || 0;
      const debitPart = (sale.payment_details?.debit || 0) + (sale.payment_details?.credit || 0);
      cashTotal += cashPart;
      cardTotal += debitPart;
    }
  });

  const totalCashInBox = startingBalance + cashTotal;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-8">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-on-surface/60 backdrop-blur-md" 
      />

      {/* Modal Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-[800px] rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <header className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/20">
           <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-on-surface rounded-2xl flex items-center justify-center text-white shadow-xl">
                 <Settings size={24} />
              </div>
              <div>
                 <h3 className="text-xl font-black font-headline tracking-tight uppercase">Arqueo de Caja (X)</h3>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock size={12} className="text-primary" /> Período: {dateFilter}
                 </p>
              </div>
           </div>
           <button 
             onClick={onClose}
             className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:text-error transition-all"
           >
              <X size={20} />
           </button>
        </header>

        <div className="p-8 overflow-y-auto space-y-8 flex-1">
          {isLoading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-primary mb-4" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Calculando Arqueo de Caja...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-8">
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50 pb-2">Resumen por Medio de Pago</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <DollarSign size={16} className="text-slate-400" />
                        <span className="text-xs font-black uppercase text-on-surface">Efectivo (Ventas)</span>
                      </div>
                      <span className="text-sm font-black font-headline italic tracking-tighter">{formatCurrency(cashTotal)}</span>
                    </div>
                    {startingBalance > 0 && (
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                        <div className="flex items-center gap-3">
                          <DollarSign size={16} className="text-primary/60" />
                          <span className="text-xs font-black uppercase text-on-surface">Saldo Inicial Caja</span>
                        </div>
                        <span className="text-sm font-black font-headline italic tracking-tighter text-primary">{formatCurrency(startingBalance)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center p-4 bg-primary/[0.03] rounded-2xl border border-primary/10">
                      <div className="flex items-center gap-3">
                        <DollarSign size={16} className="text-primary" />
                        <span className="text-xs font-black uppercase text-on-surface">Total Efectivo en Caja</span>
                      </div>
                      <span className="text-base font-black font-headline italic tracking-tighter text-primary">{formatCurrency(totalCashInBox)}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <CreditCard size={16} className="text-slate-400" />
                        <span className="text-xs font-black uppercase text-on-surface">Tarjeta/Transf.</span>
                      </div>
                      <span className="text-sm font-black font-headline italic tracking-tighter">{formatCurrency(cardTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <TrendingUp size={16} className="text-slate-400" />
                        <span className="text-xs font-black uppercase text-on-surface">Cuenta Corriente</span>
                      </div>
                      <span className="text-sm font-black font-headline italic tracking-tighter">{formatCurrency(storeCreditTotal)}</span>
                    </div>
                  </div>
                </section>

                <section className="space-y-8">
                  <div className="bg-primary p-6 rounded-[2rem] text-white space-y-4 shadow-xl shadow-primary/20 relative overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Total Recaudado en Ventas</p>
                    <h5 className="text-4xl font-black font-headline italic tracking-tighter">{formatCurrency(totalSales)}</h5>
                    <div className="flex items-center gap-2 pt-2">
                      <Zap size={14} className="text-white/60" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{operationsCount} Operaciones registradas</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contexto de Cierre</span>
                    </div>
                    <div className="p-5 rounded-3xl border border-slate-100 space-y-3 bg-slate-50/30">
                      <div className="flex justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Período de consulta:</span>
                        <span className="text-[10px] font-black text-on-surface uppercase">{dateFilter}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Saldo inicial de hoy:</span>
                        <span className="text-[10px] font-black text-on-surface">{formatCurrency(startingBalance)}</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="p-6 bg-error/5 border border-error/10 rounded-3xl flex gap-5">
                <AlertCircle size={24} className="text-error shrink-0" />
                <div>
                  <p className="text-[10px] font-black text-error uppercase tracking-widest leading-none mb-1">Aviso Técnico de Auditoría</p>
                  <p className="text-xs font-medium text-error/60 uppercase leading-tight">Este reporte X no cierra el turno fiscal. Se recomienda contrastar con el arqueo manual de billetes.</p>
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="p-8 border-t border-slate-50 flex items-center justify-between gap-6 bg-slate-50/30">
           <button 
             onClick={onClose}
             className="flex-1 flex items-center justify-center gap-3 py-4 bg-white border border-slate-200 text-on-surface font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
           >
              Cerrar
           </button>
           <button 
             onClick={() => window.print()}
             className="flex-[1.5] flex items-center justify-center gap-4 py-4 bg-on-surface text-white font-black rounded-2xl text-[10px] uppercase tracking-[0.3em] hover:brightness-110 transition-all shadow-2xl shadow-on-surface/20"
           >
              <Printer size={20} /> Imprimir Comprobante de Arqueo
           </button>
        </footer>
      </motion.div>
    </div>
  );
}

function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
