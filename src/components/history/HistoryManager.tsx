import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Search, 
  Download, 
  TrendingUp, 
  CreditCard, 
  ArrowRight,
  Clock,
  Printer, 
  FileText,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { TransactionDetailDrawer } from './TransactionDetailDrawer';
import { ShiftSummary } from './ShiftSummary';
import { formatDate, formatCurrency, getLocalISODate } from '../../utils/format';
import { api } from '../../services/api';
import { subscribeChannel, removeChannel } from '../../realtime/realtimeBootstrap';

// ─── Date Range Helpers ────────────────────────────────────────────────
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
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────
function mapSale(s: any) {
  return {
    id: s.id,
    created_at: s.created_at,
    total: s.total,
    discount: s.discount || 0,
    client_id: s.client_id || null,
    customer: s.clients?.name || 'Consumidor Final',
    dni: s.clients?.dni_tax_id || '-',
    paymentMethod: s.payment_method,
    payment_details: s.payment_details || {},
    seller: s.user_id?.name || 'Sistema',
    type: 'sale', // Simplified since items_count is missing
    status: s.status || 'completed'
  };
}

// ─── Component ────────────────────────────────────────────────────────
export function HistoryManager() {
  const [sales, setSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('Hoy');
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showShiftSummary, setShowShiftSummary] = useState(false);

  const loadSales = useCallback(async () => {
    try {
      setIsLoading(true);
      const { from, to } = getDateRange(dateFilter);
      const data = await api.getSalesForPeriod(from, to);
      setSales(data.map(mapSale));
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter]);


  const isSubscribed = useRef(false);

  useEffect(() => {
    loadSales();
    
    // 1. Local events
    const handleRefresh = () => loadSales();
    window.addEventListener('refresh-sales', handleRefresh);
    
    // 2. Cloud Realtime
    if (!isSubscribed.current) {
      const channelName = "sales-history-realtime";
      const options = {
        event: "*",
        schema: "public",
        table: "sales"
      };

      const onEvent = async (payload: any) => {
        console.log("📦 [REALTIME_EVENT]", payload);
        await loadSales();
      };

      subscribeChannel(channelName, options, onEvent);
      isSubscribed.current = true;

      return () => {
        window.removeEventListener('refresh-sales', handleRefresh);
        removeChannel(channelName, options, onEvent);
        isSubscribed.current = false;
      };
    }
  }, [loadSales]);

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const matchesSearch =
        sale.id.toString().includes(searchQuery) ||
        sale.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sale.dni.includes(searchQuery);
      const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
      const matchesPayment = paymentFilter === 'all' || sale.paymentMethod === paymentFilter;
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [sales, searchQuery, statusFilter, paymentFilter]);

  const kpis = useMemo(() => {
    const activeTxs = sales.filter(s => s.status !== 'voided');
    return {
      netSales: activeTxs.reduce((sum, s) => sum + s.total, 0),
      creditPayments: activeTxs
        .filter(s => s.type === 'credit_payment')
        .reduce((sum, s) => sum + s.total, 0),
      voidedTotal: sales
        .filter(s => s.status === 'voided')
        .reduce((sum, s) => sum + s.total, 0)
    };
  }, [sales]);

  const handleExportCSV = () => {
    if (filteredSales.length === 0) return;
    const headers = ['ID', 'Fecha', 'Cliente', 'DNI', 'Método Pago', 'Total', 'Estado', 'Vendedor'];
    const rows = filteredSales.map(s => [
      s.id, formatDate(s.created_at), s.customer, s.dni,
      s.paymentMethod, s.total, s.status, s.seller
    ]);
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_${dateFilter.replace(/\s/g, '_')}_${getLocalISODate()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const DATE_FILTERS: DateFilter[] = ['Hoy', 'Ayer', '7 Días', '30 Días'];

  return (
    <div className="flex flex-col h-full bg-surface relative overflow-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-10 py-8 flex justify-between items-end shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Clock size={16} />
            </div>
            <p className="text-[10px] font-black text-primary">Libro Diario de Control</p>
          </div>
          <h2 className="text-4xl font-black font-headline tracking-tighter text-on-surface">Histórico Maestro</h2>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={loadSales}
            disabled={isLoading}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-40"
            title="Recargar"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowShiftSummary(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-on-surface text-white text-[10px] font-black rounded-xl tracking-widest hover:brightness-110 transition-all shadow-lg shadow-on-surface/20"
          >
            <Printer size={16} /> Arqueo de Caja (X)
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event('open-shift-opening-modal'))}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-primary/20"
          >
            <Clock size={16} /> Apertura de Turno
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-400 text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </header>

      <main className="flex-1 p-10 overflow-y-auto space-y-10">
        <div className="max-w-[1500px] mx-auto space-y-10">

          {/* KPI CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-start group">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Ventas Netas — {dateFilter}
                </p>
                <h4 className="text-3xl font-black font-headline italic tracking-tighter text-on-surface">
                  {formatCurrency(kpis.netSales)}
                </h4>
                <p className="text-[10px] font-bold text-slate-300 mt-1">
                  {sales.length} operaciones
                </p>
              </div>
              <div className="p-3 bg-tertiary/5 text-tertiary rounded-2xl group-hover:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
            </section>

            <section className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-start group">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cobros Cuenta Cte</p>
                <h4 className="text-3xl font-black font-headline italic tracking-tighter text-primary">
                  {formatCurrency(kpis.creditPayments)}
                </h4>
              </div>
              <div className="p-3 bg-primary/5 text-primary rounded-2xl group-hover:scale-110 transition-transform">
                <CreditCard size={24} />
              </div>
            </section>
          </div>

          {/* FILTERS & SEARCH */}
          <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
            <div className="flex-1 relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input
                className="w-full h-14 bg-slate-50 border-none rounded-2xl pl-16 pr-6 text-sm font-bold focus:ring-4 focus:ring-primary/5 outline-none"
                placeholder="Ticket ID, Cliente, DNI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* DATE FILTER — functional */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
              {DATE_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    dateFilter === f
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest outline-none focus:ring-4 focus:ring-primary/5 transition-all appearance-none cursor-pointer"
              >
                <option value="all">Método: Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta/Transf.</option>
                <option value="mixto">Mixto</option>
                <option value="cuenta_corriente">Cuenta Cte.</option>
              </select>
            </div>
          </section>

          {/* TRANSACTIONS TABLE */}
          <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="py-6 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Identificador</th>
                  <th className="py-6 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tipo de Op.</th>
                  <th className="py-6 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Titular / Cliente</th>
                  <th className="py-6 px-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Monto Final</th>
                  <th className="py-6 px-10 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <Loader2 className="animate-spin mx-auto text-primary mb-4" size={32} />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Sincronizando...</p>
                    </td>
                  </tr>
                ) : filteredSales.map(sale => (
                  <tr
                    key={sale.id}
                    onClick={() => setSelectedTransaction(sale)}
                    className="group hover:bg-slate-50/50 cursor-pointer transition-all"
                  >
                    <td className="py-6 px-10">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          sale.type === 'credit_payment'
                            ? 'bg-primary'
                            : 'bg-tertiary'
                        }`} />
                        <div>
                          <p className="text-xs font-black text-on-surface">{sale.id}</p>
                          <p className="text-[10px] font-bold text-slate-300 uppercase mt-0.5">{formatDate(sale.created_at)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-10">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                        sale.type === 'credit_payment'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-tertiary/10 text-tertiary'
                      }`}>
                        {sale.type === 'credit_payment'
                          ? 'PAGO CUENTA CTE'
                          : 'VENTA COMPLETADA'}
                      </span>
                    </td>
                    <td className="py-6 px-10">
                      <p className="text-xs font-bold text-on-surface uppercase">{sale.customer}</p>
                      <p className="text-[10px] font-bold text-slate-300 uppercase">DNI: {sale.dni}</p>
                    </td>
                    <td className="py-6 px-10 text-right">
                      <p className="text-base font-black font-headline italic tracking-tighter text-on-surface">
                        {formatCurrency(sale.total)}
                      </p>
                      <p className="text-[9px] font-bold text-slate-300 uppercase mt-0.5">
                        {sale.paymentMethod === 'mixto' ? 'Mixto' : sale.paymentMethod}
                      </p>
                    </td>
                    <td className="py-6 px-10 text-right">
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-primary group-hover:text-white transition-all">
                        <ArrowRight size={18} />
                      </div>
                    </td>
                  </tr>
                ))}

                {!isLoading && filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-40 text-center opacity-20">
                      <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                        Sin registros para el criterio seleccionado
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>

      {/* DRAWER LAYER */}
      <AnimatePresence>
        {selectedTransaction && (
          <TransactionDetailDrawer
            transaction={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
          />
        )}
        {showShiftSummary && (
          <ShiftSummary
            dateFilter={dateFilter}
            onClose={() => setShowShiftSummary(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
