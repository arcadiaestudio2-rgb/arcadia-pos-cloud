import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trash2, 
  Minus, 
  Plus, 
  CreditCard, 
  Banknote, 
  Wallet, 
  PlusCircle, 
  Pause, 
  Settings2,
  Clock,
  ChevronRight,
  Split,
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, toast } from '../common/CommonUI';
import { getCategoryImage } from './ProductCard';

interface CartItem {
  id: string;
  variantId: number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category?: string;
  sku?: string;
  size?: string;
  color?: string;
  stock: number;
  prices: {
    cash: number;
    debit: number;
    credit: number;
  };
}

interface PaymentEntry {
  id: string;
  type: 'cash' | 'qr' | 'debit' | 'credit' | 'storeCredit';
  amount: number;
  finalAmount: number;
  network?: string;
  installments?: number;
}

interface PaymentFees {
  cashDiscount: number;
  qrSurcharge: number;
  debitSurcharge: number;
  creditSurcharges: { [key: number]: number };
}

interface CheckoutPanelProps {
  cart: CartItem[];
  subtotal: number;
  discount: number;
  setDiscount: (val: number) => void;
  totalSubtotalToCover: number;
  remainingSubtotal: number;
  totalPaid: number;
  payments: PaymentEntry[];
  setPayments: React.Dispatch<React.SetStateAction<PaymentEntry[]>>;
  customers: any[];
  selectedCustomer: any;
  setSelectedCustomer: (c: any) => void;
  fees: PaymentFees;
  onUpdateQty: (variantId: number, delta: number) => void;
  onRemove: (variantId: number) => void;
  onClearCart: () => void;
  onFinishSale: () => void;
  onSavePending: () => void;
  loading: boolean;
  onShowSurcharge: () => void;
  onShowPending: () => void;
  paymentMethod: 'cash' | 'debit' | 'credit';
  pendingCount: number;
}

export const CheckoutPanel: React.FC<CheckoutPanelProps> = ({
  cart,
  subtotal,
  discount,
  setDiscount,
  totalSubtotalToCover,
  remainingSubtotal,
  totalPaid,
  payments,
  setPayments,
  fees,
  onUpdateQty,
  onRemove,
  onClearCart,
  onFinishSale,
  onSavePending,
  loading,
  onShowSurcharge,
  onShowPending,
  paymentMethod,
  pendingCount
}) => {
  const [isSplit, setIsSplit] = useState(false);

  // Helper to calculate final amount with surcharges and overrides
  const calculateFinalAmount = useCallback((amount: number, type: string, installments: number = 1) => {
    // We calculate the weighted total with surcharges
    // and then apply it pro-rata to the requested 'amount'
    if (subtotal <= 0) return amount;
    const ratio = amount / subtotal;
    
    let weightedTotal = 0;
    cart.forEach(item => {
      let itemPrice = item.prices.cash;
      
      if (type === 'cash') {
        itemPrice = item.prices.cash * (1 - fees.cashDiscount / 100);
      } else if (type === 'qr') {
        itemPrice = item.prices.cash * (1 + fees.qrSurcharge / 100);
      } else if (type === 'debit') {
        itemPrice = item.prices.debit || item.prices.cash;
      } else if (type === 'credit') {
        // Para 1 cuota usamos el precio de crédito manual, para más cuotas aplicamos el recargo global
        if (installments === 1) {
          itemPrice = item.prices.credit || item.prices.cash;
        } else {
          itemPrice = item.prices.cash * (1 + (fees.creditSurcharges[installments] || 0) / 100);
        }
      }

      weightedTotal += itemPrice * item.quantity;
    });

    return weightedTotal * ratio;
  }, [fees, cart, subtotal]);

  // Synchronize payments array when totalSubtotalToCover changes or isSplit changes
  useEffect(() => {
    if (!isSplit) {
      // Single payment mode: one entry covering everything
      setPayments(prev => {
        const current = prev[0] || { id: '1', type: 'cash' as const, amount: totalSubtotalToCover, finalAmount: 0 };
        return [{
          ...current,
          amount: totalSubtotalToCover,
          finalAmount: calculateFinalAmount(totalSubtotalToCover, current.type, current.installments)
        }];
      });
    } else if (payments.length < 2) {
      // Initialize split mode with two entries
      setPayments(prev => {
        const p1 = prev[0] || { id: '1', type: 'cash' as const, amount: totalSubtotalToCover, finalAmount: 0 };
        const p2 = { id: '2', type: 'qr' as const, amount: 0, finalAmount: 0 };
        return [p1, p2];
      });
    }
  }, [isSplit, totalSubtotalToCover, calculateFinalAmount, setPayments]);

  const updatePayment = (index: number, updates: Partial<PaymentEntry>) => {
    setPayments(prev => {
      const next = [...prev];
      const item = { ...next[index], ...updates };
      
      // Recalculate final amount for this item
      item.finalAmount = calculateFinalAmount(item.amount, item.type, item.installments);
      next[index] = item;

      // If we are in split mode and editing the first block's amount, adjust the second block
      if (isSplit && index === 0 && updates.amount !== undefined) {
        const p2 = { ...next[1] };
        p2.amount = Math.max(0, totalSubtotalToCover - updates.amount);
        p2.finalAmount = calculateFinalAmount(p2.amount, p2.type, p2.installments);
        next[1] = p2;
      }

      return next;
    });
  };

  const paymentOptions = [
    { id: 'cash', label: 'Efe', icon: <Banknote size={14} /> },
    { id: 'credit', label: 'Crd', icon: <CreditCard size={14} /> },
    { id: 'debit', label: 'Deb', icon: <CreditCard size={14} /> },
    { id: 'qr', label: 'QR', icon: <Wallet size={14} /> },
    { id: 'storeCredit', label: 'Cta', icon: <PlusCircle size={14} /> }
  ];

  const renderPaymentBlock = (index: number, isReadOnlyAmount: boolean = false) => {
    const payment = payments[index];
    if (!payment) return null;

    return (
      <div className={`p-3 rounded-xl border transition-all duration-300 ${
        isSplit ? 'bg-slate-50/50 border-slate-200 shadow-sm' : 'border-transparent'
      }`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isSplit ? `Pago ${index + 1}` : 'Método de Pago'}
          </span>
          <div className="flex items-center gap-2">
            {!isReadOnlyAmount ? (
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 h-7 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-50 transition-all shadow-sm">
                <span className="text-[11px] font-bold text-slate-400 mr-1">$</span>
                <input 
                  type="number"
                  value={payment.amount || ''}
                  onChange={(e) => updatePayment(index, { amount: Number(e.target.value) })}
                  className="w-16 bg-transparent border-none outline-none text-[12px] font-black text-slate-700 text-right"
                  placeholder="0"
                />
              </div>
            ) : (
              <div className="flex items-center bg-indigo-50 border border-indigo-100 rounded-lg px-2 h-7 shadow-sm">
                <span className="text-[11px] font-bold text-indigo-400 mr-1">$</span>
                <span className="text-[12px] font-black text-indigo-700">{payment.amount.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Method Selector */}
        <div className="grid grid-cols-5 gap-1 mb-2">
          {paymentOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => updatePayment(index, { type: opt.id as any })}
              className={`flex flex-col items-center justify-center gap-1 p-1.5 rounded-lg border transition-all ${
                payment.type === opt.id 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
                  : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200 hover:bg-indigo-50/30'
              }`}
            >
              <span className={payment.type === opt.id ? 'text-white' : 'text-slate-400'}>{opt.icon}</span>
              <span className="text-[9px] font-bold uppercase">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Specific Options */}
        <AnimatePresence mode="wait">
          {payment.type === 'credit' && (
            <motion.div 
              key="credit-opts"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-2 mt-2"
            >
              <div className="flex flex-wrap gap-1">
                {availableInstallments.map(i => (
                  <button
                    key={i}
                    onClick={() => updatePayment(index, { installments: i })}
                    className={`px-2 py-1 rounded-md border text-[10px] font-bold transition-all ${
                      payment.installments === i 
                        ? 'bg-indigo-100 border-indigo-200 text-indigo-700 font-black' 
                        : 'bg-white border-slate-100 text-slate-400'
                    }`}
                  >
                    {i} c
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {['credit', 'debit', 'qr'].includes(payment.type) && (
            <motion.div 
              key="network-opts"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-2 flex flex-wrap gap-1"
            >
              {availableNetworks[payment.type]?.map(net => (
                <button
                  key={net}
                  onClick={() => updatePayment(index, { network: net })}
                  className={`px-2 py-1 rounded-md border text-[9px] font-bold uppercase transition-all ${
                    payment.network === net 
                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                      : 'bg-white border-slate-100 text-slate-400'
                  }`}
                >
                  {net}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Surcharge Preview */}
        {payment.finalAmount !== payment.amount && (
          <div className="mt-2 flex justify-between items-center bg-indigo-50/50 px-2 py-1 rounded-md">
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">Subtotal Real</span>
            <span className="text-[11px] font-black text-indigo-600">
              {formatCurrency(payment.finalAmount)}
            </span>
          </div>
        )}
      </div>
    );
  };

  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<'cash' | 'debit' | 'credit' | 'qr' | 'storeCredit' | null>(null);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [availableInstallments, setAvailableInstallments] = useState([1, 3, 6, 12]);
  const [availableNetworks, setAvailableNetworks] = useState<Record<string, string[]>>({
    credit: ['Visa', 'Master', 'Amex', 'Nara'],
    debit: ['VisaD', 'MasterD', 'Cabal', 'Maestro'],
    qr: ['MPago', 'DNI', 'Uala', 'Transf']
  });

  const isPaymentValid = payments.every(p => {
    if (['credit', 'debit', 'qr'].includes(p.type) && !p.network) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 select-none relative overflow-hidden font-sans">
      {/* HEADER */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-slate-100 bg-white shrink-0 shadow-sm relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <button 
              onClick={() => setShowCartDrawer(true)}
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              <PlusCircle size={20} strokeWidth={2.5} />
            </button>
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-md">
                {cart.reduce((acc, item) => acc + item.quantity, 0)}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-[13px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1 truncate">
              Checkout
            </h2>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Venta</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100 shrink-0">
          <button 
            onClick={onSavePending} 
            disabled={cart.length === 0}
            className="p-2 text-amber-500 hover:bg-white hover:shadow-sm rounded-lg transition-all disabled:opacity-20"
            title="Poner en espera"
          >
            <Pause size={16} strokeWidth={2.5} />
          </button>
          
          <button 
            onClick={onShowSurcharge} 
            className="p-2 text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all"
            title="Recargos"
          >
            <Settings2 size={16} strokeWidth={2.5} />
          </button>

          <button 
            onClick={onShowPending} 
            className="relative p-2 text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all"
            title="Ordenes pendientes"
          >
            <Clock size={16} strokeWidth={2.5} />
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full border-2 border-slate-50"></span>
            )}
          </button>

          <button 
            onClick={onClearCart} 
            disabled={cart.length === 0} 
            className="p-2 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-all shadow-sm disabled:opacity-20"
            title="Vaciar Carrito"
          >
            <Trash2 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* MAIN VIEW: SUMMARY & PAYMENT (No permanent table) */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-none space-y-8">
        
        {/* SUMMARY CARD (Compact) */}
        <div className="bg-slate-50 rounded-3xl p-4 border border-slate-100 shadow-sm space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subtotal</span>
            <span className="text-[13px] font-bold text-slate-600 font-mono">{formatCurrency(subtotal)}</span>
          </div>
          
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Dcto. Manual</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-400 font-black">%</span>
              <input 
                type="number"
                value={discount || ''}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-12 h-6 bg-white border border-red-100 rounded-md text-right text-[12px] font-black text-red-500 focus:outline-none focus:ring-1 focus:ring-red-50 transition-all font-mono"
                placeholder="0"
              />
            </div>
          </div>

          <div className="pt-1">
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-40 mb-0.5">Total a Cobrar</p>
                <p className="text-[22px] font-black tracking-tighter leading-none font-mono">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                <Check size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* PAYMENT CARDS AREA (Minimalist) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Método de Pago</span>
            <button 
              onClick={() => setIsSplit(!isSplit)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${
                isSplit ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Split size={12} />
              <span className="text-[9px] font-black uppercase tracking-tight">{isSplit ? 'Dividido' : 'Dividir Pago'}</span>
            </button>
          </div>
          
          {isSplit ? (
            <div className="space-y-2">
              {payments.map((_, idx) => (
                <React.Fragment key={idx}>
                  {renderPaymentBlock(idx, idx === 1)}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'cash', label: 'Efectivo', icon: Banknote, color: '#38a169' },
                { id: 'qr', label: 'QR/Transf.', icon: Wallet, color: '#0ea5e9' },
                { id: 'debit', label: 'Débito', icon: CreditCard, color: '#3b82f6' },
                { id: 'credit', label: 'Crédito', icon: CreditCard, color: '#a855f7' },
                { id: 'storeCredit', label: 'Cta. Corriente', icon: PlusCircle, color: '#64748b', fullWidth: true }
              ].map((m) => (
                <motion.button
                  key={m.id}
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    // Update the first payment type directly
                    updatePayment(0, { type: m.id as any });
                    setSelectedPaymentDetail(m.id as any);
                  }}
                  className={`flex items-center justify-center gap-3 p-3 rounded-2xl transition-all duration-300 border shadow-sm ${
                    m.fullWidth ? 'col-span-2' : ''
                  } ${
                    paymentMethod === m.id 
                      ? 'border-indigo-500 ring-2 ring-indigo-50' 
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: m.color }}
                >
                  <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-white shadow-inner">
                    <m.icon size={14} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tight text-white">{m.label}</span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FINAL FINISH BUTTON AREA */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
        <button
          onClick={onFinishSale}
          disabled={cart.length === 0 || loading || remainingSubtotal > 0.01 || !isPaymentValid}
          className={`w-full flex items-center justify-center gap-2 h-12 rounded-xl font-black text-[13px] uppercase tracking-widest transition-all shadow-lg active:scale-[0.98] disabled:opacity-30 disabled:grayscale ${
            isPaymentValid ? 'bg-slate-900 text-white shadow-slate-900/10 hover:bg-black' : 'bg-slate-100 text-slate-300 shadow-none'
          }`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check size={20} />
              {remainingSubtotal > 0.01 ? `Faltan ${formatCurrency(remainingSubtotal)}` : 'Finalizar Venta'}
            </>
          )}
        </button>
      </div>

      {/* PAYMENT DETAIL MODAL */}
      <AnimatePresence>
        {selectedPaymentDetail && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md"
              onClick={() => setSelectedPaymentDetail(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[101] bg-white border-t border-slate-100 rounded-t-[3rem] p-8 pb-12 shadow-[0_-20px_40px_rgba(0,0,0,0.1)]"
            >
              <div className="max-w-md mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl"
                         style={{ backgroundColor: 
                           selectedPaymentDetail === 'cash' ? '#38a169' : 
                           selectedPaymentDetail === 'debit' ? '#3b82f6' : 
                           selectedPaymentDetail === 'credit' ? '#a855f7' :
                           selectedPaymentDetail === 'qr' ? '#0ea5e9' : '#64748b'
                         }}>
                      {selectedPaymentDetail === 'cash' ? <Banknote size={28} /> : 
                       selectedPaymentDetail === 'storeCredit' ? <PlusCircle size={28} /> :
                       selectedPaymentDetail === 'qr' ? <Wallet size={28} /> : <CreditCard size={28} />}
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                        {selectedPaymentDetail === 'cash' ? 'Efectivo' : 
                         selectedPaymentDetail === 'debit' ? 'Débito' : 
                         selectedPaymentDetail === 'credit' ? 'Crédito' :
                         selectedPaymentDetail === 'qr' ? 'QR/Transf.' : 'Cta. Corriente'}
                      </h3>
                      <p className="text-slate-400 text-[12px] font-bold uppercase tracking-widest">Detalles del Pago</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedPaymentDetail(null)}
                    className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-8">
                  {/* Amount Info */}
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total a Pagar</span>
                    </div>
                    <div className="text-4xl font-black text-slate-800 font-mono tracking-tighter">
                      {formatCurrency(calculateFinalAmount(totalSubtotalToCover, selectedPaymentDetail))}
                    </div>
                  </div>

                  {/* Options Based on Type */}
                  {selectedPaymentDetail === 'credit' && (
                    <div className="space-y-4">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Planes de Cuotas</span>
                      <div className="grid grid-cols-4 gap-3">
                        {availableInstallments.map(i => (
                          <div key={i} className="relative group">
                            <button
                              onClick={() => updatePayment(0, { installments: i })}
                              className={`w-full py-4 rounded-2xl border text-[14px] font-black transition-all flex flex-col items-center gap-1 ${
                                payments[0]?.installments === i 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20' 
                                  : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-indigo-300'
                              }`}
                            >
                              <span className="text-lg">{i}</span>
                              <span className="text-[8px] uppercase tracking-widest opacity-60">Cuotas</span>
                            </button>
                            <button 
                              onClick={() => setAvailableInstallments(prev => prev.filter(x => x !== i))}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const n = prompt('Ingrese el número de cuotas:');
                            if (n && !isNaN(Number(n))) setAvailableInstallments(prev => [...new Set([...prev, Number(n)])].sort((a,b) => a-b));
                          }}
                          className="py-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-white hover:shadow-lg transition-all flex flex-col items-center justify-center group"
                          title="Agregar Cuotas"
                        >
                          <Plus size={24} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                          <span className="text-[8px] uppercase tracking-widest font-black mt-1">Añadir</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {['credit', 'debit', 'qr'].includes(selectedPaymentDetail) && (
                    <div className="space-y-4">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Seleccionar Red</span>
                      <div className="flex flex-wrap gap-2">
                        {availableNetworks[selectedPaymentDetail]?.map(net => (
                          <div key={net} className="relative group">
                            <button
                              onClick={() => updatePayment(0, { network: net })}
                              className={`px-6 py-3 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all ${
                                payments[0]?.network === net 
                                  ? 'bg-slate-900 border-slate-900 text-white shadow-xl' 
                                  : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-300'
                              }`}
                            >
                              {net}
                            </button>
                            <button 
                              onClick={() => setAvailableNetworks(prev => ({
                                ...prev,
                                [selectedPaymentDetail]: prev[selectedPaymentDetail].filter(x => x !== net)
                              }))}
                              className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const n = prompt('Ingrese el nombre de la red:');
                            if (n) setAvailableNetworks(prev => ({
                              ...prev,
                              [selectedPaymentDetail]: [...new Set([...prev[selectedPaymentDetail], n.toUpperCase()])]
                            }));
                          }}
                          className="px-6 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-white hover:shadow-md transition-all flex items-center justify-center group"
                          title="Agregar Red"
                        >
                          <Plus size={20} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Modal Footer */}
                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => setSelectedPaymentDetail(null)}
                      className="flex-1 py-5 rounded-[1.5rem] bg-slate-100 text-slate-500 font-black text-[13px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPaymentDetail(null);
                      }}
                      className="flex-[2] py-5 rounded-[1.5rem] bg-slate-900 text-white font-black text-[13px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
                    >
                      Confirmar Pago
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* CART DRAWER */}
      <AnimatePresence>
        {showCartDrawer && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowCartDrawer(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md z-[111] bg-white shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                    <PlusCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Artículos</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cart.length} productos cargados</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCartDrawer(false)}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-100 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-12 text-center opacity-40">
                    <PlusCircle size={48} className="text-slate-300 mb-4" />
                    <p className="text-[14px] font-black text-slate-400 uppercase tracking-widest">El carrito está vacío</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {cart.map((item) => (
                      <div key={item.variantId} className="p-4 flex gap-4 hover:bg-slate-50 transition-colors group">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex-shrink-0 flex items-center justify-center text-slate-400">
                          {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover rounded-2xl" /> : <PlusCircle size={24} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-[13px] font-black text-slate-800 uppercase truncate mb-1">{item.name}</h4>
                              <p className="text-[10px] font-bold text-slate-400 font-mono">{item.sku} • {item.size}/{item.color}</p>
                            </div>
                            <button 
                              onClick={() => onRemove(item.variantId)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="flex justify-between items-center mt-3">
                            <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-1 shadow-sm">
                              <button 
                                onClick={() => onUpdateQty(item.variantId, -1)}
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-primary rounded-lg transition-all"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="text-[13px] font-black text-slate-800 min-w-[20px] text-center">{item.quantity}</span>
                              <button 
                                onClick={() => onUpdateQty(item.variantId, 1)}
                                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-primary rounded-lg transition-all"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Subtotal</p>
                              <p className="text-[14px] font-black text-indigo-600 font-mono leading-none">
                                {formatCurrency(item.prices[paymentMethod] * item.quantity)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setShowCartDrawer(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[14px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                >
                  Volver al Pago
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

