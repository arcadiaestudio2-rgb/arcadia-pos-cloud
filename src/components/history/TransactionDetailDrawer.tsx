import { useState, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Clock, 
  User, 
  MapPin, 
  Loader2,
  Receipt,
  CreditCard,
  Banknote,
  ShieldCheck,
  TrendingUp,
  Tag,
  Hash,
  Share2,
  Ban
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatDate, formatCurrency } from '../../utils/format';
import { api } from '../../services/api';
import { SaleTicket } from './SaleTicket';

interface TransactionDetailDrawerProps {
  transaction: any;
  onClose: () => void;
}

export function TransactionDetailDrawer({ transaction, onClose }: TransactionDetailDrawerProps) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setIsLoading(true);
        const data = await api.getSaleItems(transaction.id);
        setItems(data);
      } catch (error) {
        console.error('Error fetching sale items:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [transaction.id]);



  const handleWhatsApp = async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      const saleId = transaction.id;
      let ticketUrl = transaction.ticket_url;

      if (!ticketUrl) {
        ticketUrl = await api.generateTicketPdf(saleId, {
          items: items.map(i => ({
            name: i.variants?.product?.name || 'Producto',
            price_at_sale: i.price_at_sale,
            quantity: i.quantity,
            size: i.variants?.size || '',
            color: i.variants?.color || '',
          })),
          sale: transaction
        });
      }

      const fullUrl = ticketUrl.startsWith('http') ? ticketUrl : `${window.location.origin}${ticketUrl}`;

      // Download PDF
      const pdfBlob = await fetch(fullUrl).then(r => r.blob());
      const fileName = `ticket-${saleId.slice(0,8)}.pdf`;
      const blobUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);

      // Open WhatsApp Web
      const message = `Hola! Aquí tienes el comprobante de tu compra en ARCADIA`;
      const phone = transaction.client_phone || '';
      const url = `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    } catch (err) {
      console.error('[WhatsApp Error]:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleVoid = async () => {
    const reason = prompt('Motivo de la anulación:');
    if (reason === null) return;
    if (!confirm('¿Estás seguro de anular esta venta? El stock se revertirá automáticamente.')) return;
    try {
      await api.voidSale(transaction.id, reason || 'Anulación manual', transaction.user_id || '');
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      onClose();
    } catch (err) {
      console.error('[Void Error]:', err);
      alert('Error al anular la venta');
    }
  };

  const financialSummary = items.reduce((acc, item) => {
    const cost = item.variants?.cost || 0;
    const price = item.price_at_sale;
    const qty = item.quantity;
    
    acc.totalCost += cost * qty;
    acc.totalPrice += price * qty;
    acc.totalItems += qty;
    return acc;
  }, { totalCost: 0, totalPrice: 0, totalItems: 0 });

  const totalDiscount = transaction.discount || 0;
  const netTotal = transaction.total;
  const profit = netTotal - financialSummary.totalCost;
  const margin = financialSummary.totalPrice > 0 ? (profit / financialSummary.totalPrice) * 100 : 0;

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[999]"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-screen w-full max-w-2xl bg-surface shadow-2xl z-[1000] flex flex-col overflow-hidden"
      >
        {/* BLOCK 1: HEADER */}
        <header className="px-8 py-5 border-b border-slate-100 bg-white flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Receipt size={24} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-0.5">
                <h3 className="text-xl font-black font-headline tracking-tight text-on-surface uppercase truncate">Ticket #{transaction.id}</h3>
                {totalDiscount > 0 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-error/10 text-error text-[10px] font-black uppercase tracking-wider">
                    -{formatCurrency(totalDiscount)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={12} className="text-slate-300" /> {formatDate(transaction.created_at)}
                </p>
                {totalDiscount > 0 && (
                  <p className="text-[10px] font-bold text-error/70 uppercase tracking-widest">
                    Descuento en efectivo
                  </p>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* BLOCK 2: CUSTOMER DATA */}
          <section className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <User size={80} className="text-on-surface" />
            </div>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
              <User size={12} /> Datos del Titular
            </p>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Nombre y Apellido</p>
                <p className="text-sm font-black text-on-surface uppercase">{transaction.customer || 'Consumidor Final'}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Identificación Fiscal</p>
                <p className="text-sm font-bold text-on-surface">{transaction.dni || '-'}</p>
              </div>
            </div>
          </section>

          {/* BLOCK 3: TRANSACTION ITEMS */}
          <section className="space-y-3">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
              <Tag size={12} /> Desglose de Artículos ({items.length})
            </p>
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-5 text-[9px] font-black uppercase text-slate-400">Producto</th>
                    <th className="py-3 px-5 text-[9px] font-black uppercase text-slate-400 text-center">Cant.</th>
                    <th className="py-3 px-5 text-[9px] font-black uppercase text-slate-400 text-right">Precio</th>
                    <th className="py-3 px-5 text-[9px] font-black uppercase text-slate-400 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center">
                        <Loader2 className="animate-spin mx-auto text-primary mb-2" size={24} />
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Cargando...</p>
                      </td>
                    </tr>
                  ) : items.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/30 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-primary transition-colors shrink-0">
                            <Hash size={12} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-on-surface uppercase truncate">{item.variants?.product?.name || 'Producto Desconocido'}</p>
                            <p className="text-[9px] font-bold text-slate-300 uppercase truncate">{item.variants?.sku} · {item.variants?.size} / {item.variants?.color}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-center">
                        <span className="text-xs font-black text-on-surface bg-slate-50 px-2 py-1 rounded-lg">x{item.quantity}</span>
                      </td>
                      <td className="py-3 px-5 text-right font-bold text-xs">
                        {formatCurrency(item.price_at_sale)}
                      </td>
                      <td className="py-3 px-5 text-right font-black text-xs text-on-surface">
                        {formatCurrency(item.price_at_sale * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* BLOCK 4: FINANCIAL SUMMARY & MARGIN */}
          <div className="grid grid-cols-2 gap-4">
            <section className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <ShieldCheck size={12} /> Resumen de Totales
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase">Cantidad de Artículos</span>
                  <span className="font-bold text-on-surface">{financialSummary.totalItems} u.</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase">Bruto</span>
                  <span className="font-bold text-on-surface">{formatCurrency(financialSummary.totalPrice)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-error">
                  <span className="font-bold uppercase italic">Bonificaciones</span>
                  <span className="font-bold">-{formatCurrency(totalDiscount)}</span>
                </div>
                <div className="pt-2 border-t border-dashed border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-on-surface">Total Cobrado</span>
                  <span className="text-xl font-black font-headline italic tracking-tighter text-on-surface">
                    {formatCurrency(netTotal)}
                  </span>
                </div>
              </div>
            </section>

            <section className="bg-primary/[0.03] p-5 rounded-[2rem] border border-primary/10 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                 <TrendingUp size={60} className="text-primary" />
               </div>
               <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <TrendingUp size={12} /> Análisis de Utilidad
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase">Costo de Mercadería</span>
                  <span className="font-bold text-on-surface">{formatCurrency(financialSummary.totalCost)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase">Rendimiento (Ganancia)</span>
                  <span className={`font-black ${profit >= 0 ? 'text-tertiary' : 'text-error'}`}>
                    {formatCurrency(profit)}
                  </span>
                </div>
                <div className="pt-2 border-t border-dashed border-primary/10 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-primary">Margen Neto</span>
                  <span className="text-xl font-black font-headline italic tracking-tighter text-primary">
                    {margin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* BLOCK 6: FORENSIC REGISTER */}
          <section className="bg-slate-900 p-6 rounded-[2rem] text-white/90 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <ShieldCheck size={100} />
            </div>
            <div className="flex items-center gap-3 mb-4">
               <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
               <p className="text-[10px] font-black uppercase tracking-[0.3em]">Registro de Auditoría Forense</p>
            </div>
            <div className="grid grid-cols-2 gap-8">
               <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 shrink-0">
                    <User size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-white/40 uppercase mb-1">Operador Responsable</p>
                    <p className="text-sm font-black uppercase tracking-tight truncate">{transaction.seller}</p>
                    <p className="text-[9px] font-medium text-white/30 uppercase mt-0.5 truncate">ID: {transaction.user_id}</p>
                  </div>
               </div>
               <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 shrink-0">
                    <Clock size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-white/40 uppercase mb-1">Estampa de Tiempo</p>
                    <p className="text-sm font-black uppercase tracking-tight truncate">{formatDate(transaction.created_at)}</p>
                    <p className="text-[9px] font-medium text-white/30 uppercase mt-0.5">Control OK</p>
                  </div>
               </div>
            </div>
          </section>
        </div>

        {/* BLOCK 5+7: FOOTER — PAYMENT METHODS + ACTIONS */}
        <footer className="shrink-0 border-t border-slate-100 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          {/* Payment Methods */}
          <div className="px-8 pt-5 pb-3">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <CreditCard size={12} /> Instrumentos de Pago
            </p>
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Efectivo</p>
                <p className="text-xs font-black text-on-surface">{formatCurrency(transaction.payment_details?.cash || 0)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Tarjeta/Deb</p>
                <p className="text-xs font-black text-on-surface">{formatCurrency(transaction.payment_details?.debit || 0)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Cta Cte</p>
                <p className="text-xs font-black text-on-surface">{formatCurrency(transaction.payment_details?.credit || 0)}</p>
              </div>
              <div className="p-3 bg-primary/5 rounded-2xl border border-primary/10 text-center">
                <p className="text-[8px] font-black text-primary/60 uppercase mb-1">TOTAL</p>
                <p className="text-xs font-black text-primary">{formatCurrency(transaction.total)}</p>
              </div>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="px-8 pb-5 pt-2 grid grid-cols-3 gap-3">
            {transaction.status !== 'voided' && (
              <button
                onClick={handleVoid}
                className="h-12 rounded-2xl border-2 border-error/20 flex items-center justify-center gap-3 text-error hover:bg-error/5 transition-all font-black uppercase text-[10px] tracking-[0.2em]"
              >
                <Ban size={16} /> Anular
              </button>
            )}
            <button 
              onClick={handlePrint}
              className="h-12 rounded-2xl border-2 border-slate-100 flex items-center justify-center gap-3 text-slate-600 hover:bg-slate-50 transition-all font-black uppercase text-[10px] tracking-[0.2em]"
            >
              <Printer size={16} /> Ticket
            </button>
            <button 
              onClick={handleWhatsApp}
              disabled={isSharing}
              className="h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center gap-3 hover:brightness-110 transition-all font-black uppercase text-[10px] tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSharing ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              {isSharing ? 'Compartiendo...' : 'WhatsApp'}
            </button>
          </div>
        </footer>

        {/* HIDDEN TICKET FOR PRINTING */}
        <div className="hidden print:block">
           <SaleTicket sale={transaction} items={items.map(i => ({
              name: i.variants?.product?.name,
              qty: i.quantity,
              price: i.price_at_sale,
              color: i.variants?.color,
              size: i.variants?.size
           }))} />
        </div>
      </motion.aside>
    </>
  );
}
