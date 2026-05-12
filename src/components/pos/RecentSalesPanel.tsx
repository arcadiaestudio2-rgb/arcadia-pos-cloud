import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ShoppingBag, Clock, User, CreditCard, ChevronRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

interface RecentSalesPanelProps {
  refreshTrigger?: number;
}

export const RecentSalesPanel: React.FC<RecentSalesPanelProps> = ({ refreshTrigger = 0 }) => {
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRecentSales = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSales(10);
      setSales(data);
    } catch (error) {
      console.error('Error fetching recent sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentSales();
  }, [refreshTrigger]);

  const getPaymentIcon = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'TARJETA': return <CreditCard size={12} className="text-blue-500" />;
      case 'EFECTIVO': return <ShoppingBag size={12} className="text-green-500" />;
      case 'MIXTO': return <RefreshCw size={12} className="text-purple-500" />;
      default: return <ShoppingBag size={12} className="text-slate-400" />;
    }
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Clock size={16} />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">Ventas Recientes</h3>
        </div>
        <button 
          onClick={fetchRecentSales}
          className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-primary"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50">
              <th className="px-6 py-4">Hora</th>
              <th className="px-6 py-4">Cliente / Vendedor</th>
              <th className="px-6 py-4">Pago</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            <AnimatePresence mode="popLayout">
              {sales.map((sale, idx) => (
                <motion.tr 
                  key={sale.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group hover:bg-slate-50/80 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-600">
                      {format(new Date(sale.timestamp), 'HH:mm', { locale: es })}
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium">
                      {format(new Date(sale.timestamp), 'dd MMM', { locale: es })}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                        {sale.clients?.name || 'Cliente Final'}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <User size={10} className="text-slate-300" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                          {sale.users?.name || 'Sistema'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-100/50 w-fit">
                      {getPaymentIcon(sale.payment_method)}
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                        {sale.payment_method || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-black text-primary">
                      ${sale.total?.toLocaleString('es-AR')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 opacity-0 group-hover:opacity-100 transition-all hover:bg-white rounded-lg text-slate-400 hover:text-primary shadow-sm border border-transparent hover:border-slate-100">
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            
            {!isLoading && sales.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <ShoppingBag size={32} strokeWidth={1} />
                    <p className="text-xs font-bold uppercase tracking-widest">No hay ventas registradas hoy</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
