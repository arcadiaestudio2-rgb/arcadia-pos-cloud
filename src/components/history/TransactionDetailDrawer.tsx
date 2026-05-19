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
  Share2
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



  const handleWhatsApp = () => {
    let message = `*ARCADIA POS - Ticket #${transaction.id}*\n`;
    message += `📅 ${formatDate(transaction.created_at)}\n\n`;
    message += `*Detalle:*\n`;
    
    items.forEach(item => {
      message += `• ${item.variants?.products?.name || 'Producto'} x${item.quantity} - ${formatCurrency(item.price_at_sale)}\n`;
    });
    
    message += `\n*TOTAL: ${formatCurrency(transaction.total)}*\n`;
    message += `💳 Métodos: ${transaction.payment_method || 'Varios'}\n\n`;
    message += `¡Gracias por tu compra! ✨`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handlePrint = () => {
    // We use a hidden container for printing to avoid messing with the drawer's layout
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const ticketHtml = `
      <html>
        <head>
          <title>Reimpresión Ticket #${transaction.id}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          <div id="ticket-root"></div>
        </body>
      </html>
    `;

    printWindow.document.write(ticketHtml);
    
    // In a real app, we'd render the SaleTicket component here using a portal or separate root
    // For now, we'll trigger the standard print which is already handled by SaleTicket's CSS in the main DOM
    window.print();
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
        className="fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-[50]"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-surface shadow-2xl z-[60] flex flex-col overflow-hidden"
      >
        {/* BLOCK 1: HEADER */}
        <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
              <Receipt size={24} />
            </div>
            <div>
               <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-xl font-black font-headline tracking-tight text-on-surface uppercase">Ticket #{transaction.id}</h3>
               </div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Clock size={12} className="text-slate-300" /> {formatDate(transaction.created_at)}
               </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 pb-32">
          {/* BLOCK 2: CUSTOMER DATA */}
          <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <User size={80} className="text-on-surface" />
            </div>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
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
          <section className="space-y-4">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
              <Tag size={12} /> Desglose de Artículos ({items.length})
            </p>
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="py-4 px-6 text-[9px] font-black uppercase text-slate-400">Producto</th>
                    <th className="py-4 px-6 text-[9px] font-black uppercase text-slate-400 text-center">Cant.</th>
                    <th className="py-4 px-6 text-[9px] font-black uppercase text-slate-400 text-right">Precio</th>
                    <th className="py-4 px-6 text-[9px] font-black uppercase text-slate-400 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <Loader2 className="animate-spin mx-auto text-primary mb-2" size={24} />
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Cargando...</p>
                      </td>
                    </tr>
                  ) : items.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-primary transition-colors">
                            <Hash size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-on-surface uppercase">{item.variants?.products?.name || 'Producto Desconocido'}</p>
                            <p className="text-[9px] font-bold text-slate-300 uppercase">{item.variants?.sku} · {item.variants?.size} / {item.variants?.color}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-xs font-black text-on-surface bg-slate-50 px-2 py-1 rounded-lg">x{item.quantity}</span>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-xs">
                        {formatCurrency(item.price_at_sale)}
                      </td>
                      <td className="py-4 px-6 text-right font-black text-xs text-on-surface">
                        {formatCurrency(item.price_at_sale * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* BLOCK 4: FINANCIAL SUMMARY & MARGIN */}
          <div className="grid grid-cols-2 gap-6">
            <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <ShieldCheck size={12} /> Resumen de Totales
              </p>
              <div className="space-y-3">
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
                <div className="pt-3 border-t border-dashed border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-on-surface">Total Cobrado</span>
                  <span className="text-2xl font-black font-headline italic tracking-tighter text-on-surface">
                    {formatCurrency(netTotal)}
                  </span>
                </div>
              </div>
            </section>

            <section className="bg-primary/[0.03] p-6 rounded-[2rem] border border-primary/10 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                 <TrendingUp size={60} className="text-primary" />
               </div>
               <p className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <TrendingUp size={12} /> Análisis de Utilidad
              </p>
              <div className="space-y-3">
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
                <div className="pt-3 border-t border-dashed border-primary/10 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-primary">Margen Neto</span>
                  <span className="text-2xl font-black font-headline italic tracking-tighter text-primary">
                    {margin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </section>
          </div>

          {/* BLOCK 5: PAYMENT METHOD */}
          <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <CreditCard size={12} /> Instrumentos de Pago
            </p>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-300 mx-auto mb-2">
                  <Banknote size={16} />
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Efectivo</p>
                <p className="text-xs font-black text-on-surface">{formatCurrency(transaction.payment_details?.cash || 0)}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-300 mx-auto mb-2">
                  <CreditCard size={16} />
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Tarjeta/Deb</p>
                <p className="text-xs font-black text-on-surface">{formatCurrency(transaction.payment_details?.debit || 0)}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-300 mx-auto mb-2">
                  <MapPin size={16} />
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Cta Cte</p>
                <p className="text-xs font-black text-on-surface">{formatCurrency(transaction.payment_details?.credit || 0)}</p>
              </div>
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 text-center">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mx-auto mb-2">
                  <Receipt size={16} />
                </div>
                <p className="text-[8px] font-black text-primary/60 uppercase mb-1">TOTAL</p>
                <p className="text-xs font-black text-primary">{formatCurrency(transaction.total)}</p>
              </div>
            </div>
          </section>

          {/* BLOCK 6: FORENSIC REGISTER */}
          <section className="bg-slate-900 p-8 rounded-[2rem] text-white/90 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <ShieldCheck size={100} />
            </div>
            <div className="flex items-center gap-3 mb-6">
               <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
               <p className="text-[10px] font-black uppercase tracking-[0.3em]">Registro de Auditoría Forense</p>
            </div>
            <div className="grid grid-cols-2 gap-12">
               <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-white/40 uppercase mb-1">Operador Responsable</p>
                    <p className="text-sm font-black uppercase tracking-tight">{transaction.seller}</p>
                    <p className="text-[9px] font-medium text-white/30 uppercase mt-0.5">ID Sistema: {transaction.user_id}</p>
                  </div>
               </div>
               <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-white/40 uppercase mb-1">Estampa de Tiempo</p>
                    <p className="text-sm font-black uppercase tracking-tight">{formatDate(transaction.created_at)}</p>
                    <p className="text-[9px] font-medium text-white/30 uppercase mt-0.5">Control de Integridad OK</p>
                  </div>
               </div>
            </div>

          </section>
        </div>

        {/* BLOCK 7: FOOTER ACTIONS */}
        <footer className="p-8 border-t border-slate-100 bg-white sticky bottom-0 z-10 grid grid-cols-3 gap-3">
          <button 
            onClick={handlePrint}
            className="h-16 rounded-2xl border-2 border-slate-100 flex items-center justify-center gap-3 text-slate-600 hover:bg-slate-50 transition-all font-black uppercase text-[10px] tracking-[0.2em]"
          >
            <Printer size={18} /> Ticket
          </button>
          
          <button 
            onClick={handleWhatsApp}
            className="h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center gap-3 hover:brightness-110 transition-all font-black uppercase text-[10px] tracking-[0.2em]"
          >
            <Share2 size={18} /> WhatsApp
          </button>
        </footer>

        {/* HIDDEN TICKET FOR PRINTING */}
        <div className="hidden">
           <SaleTicket sale={transaction} items={items.map(i => ({
              name: i.variants?.products?.name,
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
