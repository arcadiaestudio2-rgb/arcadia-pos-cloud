import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Receipt, RefreshCcw, DollarSign, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Venta {
  id: string;
  total: number;
  metodo_pago: any;
  vendedor: string;
  fecha: string;
}

export const SalesHistory: React.FC = () => {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVentas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transacciones_ventas')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;
      setVentas(data || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVentas();

    // REACTIVIDAD: Escuchar el evento de refresco de ventas
    const handleRefresh = () => {
      console.log('[SalesHistory] Refrescando historial de ventas...');
      fetchVentas();
    };

    window.addEventListener('refresh-sales', handleRefresh);
    return () => window.removeEventListener('refresh-sales', handleRefresh);
  }, [fetchVentas]);

  const formatMetodoPago = (metodo: any) => {
    if (!metodo) return 'N/A';
    const active = Object.entries(metodo)
      .filter(([_, value]) => Number(value) > 0)
      .map(([key, _]) => key === 'cash' ? 'Efectivo' : key === 'credit' ? 'Tarjeta' : 'Crédito');
    return active.join(' + ') || 'Efectivo';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            Histórico de Ventas
          </h3>
          <p className="text-sm text-slate-500">Registro financiero de transacciones POS</p>
        </div>
        <button 
          onClick={fetchVentas}
          disabled={loading}
          className="p-2 hover:bg-white rounded-lg border border-slate-200 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCcw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ID Venta</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vendedor</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Método</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            <AnimatePresence mode='popLayout'>
              {ventas.map((venta) => (
                <motion.tr 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={venta.id} 
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4 opacity-40" />
                      {format(new Date(venta.fecha), "d 'de' MMMM, HH:mm", { locale: es })}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-400">
                    #{venta.id.substring(0, 8).toUpperCase()}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">
                    {venta.vendedor}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium">
                      {formatMetodoPago(venta.metodo_pago)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-bold text-slate-900 flex items-center justify-end gap-1">
                      <DollarSign className="w-3 h-3 text-green-600" />
                      {new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(venta.total)}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {ventas.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                  No se registran ventas financieras en este periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
