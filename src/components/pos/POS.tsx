import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  ShoppingCart, 
  User, 
  Keyboard,
  ArrowLeft,
  ChevronDown,
  Menu
} from 'lucide-react';
import { toast, formatCurrency } from '../common/CommonUI';
import { api } from '../../services/api';
import { useOperator } from '../../context/OperatorContext';
import { ProductGrid } from './ProductGrid';
import { CheckoutPanel } from './CheckoutPanel';
import { PendingOrdersModal } from './PendingOrdersModal';
import { SurchargeConfigModal } from './SurchargeConfigModal';
import { CustomerSelectorModal } from './CustomerSelectorModal';
import { CreateCustomerModal } from './CreateCustomerModal';
import { OperatorSelector } from '../Header/OperatorSelector';
import { SaleTicketModal } from './SaleTicketModal';

export interface CartItem {
  id: string; // product_id
  variantId: number;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  image: string;
  category: string;
  stock: number;
  prices: {
    cash: number;
    debit: number;
    credit: number;
  };
}

export interface PaymentFees {
  cashDiscount: number;
  qrSurcharge: number;
  debitSurcharge: number;
  creditSurcharges: {
    [key: number]: number; // cuotas: porcentaje
  };
}

export interface PendingOrder {
  id: string;
  cart: CartItem[];
  customer: any;
  timestamp: number;
  discount: number;
  total: number;
  payments?: PaymentEntry[];
  note?: string;
}

export interface PaymentEntry {
  id: string;
  type: 'cash' | 'qr' | 'debit' | 'credit' | 'storeCredit';
  amount: number; // Amount of subtotal covered
  finalAmount: number; // Amount actually paid
  network?: string;
  installments?: number;
}

interface POSProps {
  onMenuClick?: () => void;
}

function POS({ onMenuClick }: POSProps) {
  // --- State ---
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('arcadia_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [displayedProducts, setDisplayedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todas']);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'cart' | 'checkout'>('cart');
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showSurchargeModal, setShowSurchargeModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);

  const [lastSaleData, setLastSaleData] = useState<{ sale: any; items: any[] } | null>(null);
  

  // Payment Logic States
  const [payments, setPayments] = useState<PaymentEntry[]>([]);

  const paymentMethod = useMemo(() => {
    if (payments.length === 0) return 'cash';
    const type = payments[0].type;
    if (type === 'debit' || type === 'qr') return 'debit';
    if (type === 'credit') return 'credit';
    return 'cash';
  }, [payments]);
  const [fees, setFees] = useState<PaymentFees>(() => {
    const saved = localStorage.getItem('arcadia_fees');
    return saved ? JSON.parse(saved) : {
      cashDiscount: 10,
      qrSurcharge: 0,
      debitSurcharge: 5,
      creditSurcharges: { 1: 10, 3: 20, 6: 45, 12: 90 }
    };
  });

  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(() => {
    const saved = localStorage.getItem('arcadia_pending');
    return saved ? JSON.parse(saved) : [];
  });

  const { selectedOperator: rawOperator } = useOperator();
  // Ensure selectedOperator is an object with an ID
  const selectedOperator = rawOperator || { id: 1, name: 'Vendedor' };
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('arcadia_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('arcadia_fees', JSON.stringify(fees));
  }, [fees]);

  useEffect(() => {
    localStorage.setItem('arcadia_pending', JSON.stringify(pendingOrders));
  }, [pendingOrders]);

  // --- Initialization ---

  useEffect(() => {
    const init = async () => {
      try {
        const [attrs, clients] = await Promise.all([
          api.getCatalogAttributes(),
          api.getClients()
        ]);
        if (attrs && Array.isArray(attrs.categories)) setCategories(['Todas', ...attrs.categories]);
        setCustomers(clients || []);
      } catch (e) {
        console.error("Initialization error:", e);
      }
    };
    init();
  }, []);

  // --- Search Logic ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!searchTerm) {
          const results = await api.getProductsWithStock(categoryFilter === 'Todas' ? undefined : categoryFilter);
          setDisplayedProducts(results);
          setSearchResults([]);
          return;
        }
        
        const results = await api.searchProducts(searchTerm, categoryFilter === 'Todas' ? undefined : categoryFilter);
        setSearchResults(results);
        setDisplayedProducts(results);
      } catch (e) {
        console.error("Search error:", e);
      }
    };

    const delayDebounceFn = setTimeout(fetchData, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, categoryFilter, refreshTrigger]);

  // --- Logic ---
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const price = item.prices[paymentMethod] || item.prices.cash || 0;
      return acc + (price * item.quantity);
    }, 0);
  }, [cart, paymentMethod]);
  const [discount, setDiscount] = useState(0); // Manual discount %
  


  const manualDiscountAmount = (subtotal * discount) / 100;
  const afterManualDiscount = subtotal - manualDiscountAmount;
  
  // The total is the sum of finalAmounts of added payments
  // plus the remaining balance calculated with a "preview" method if needed
  // But for simplicity, we'll show the total as the sum of already added payments
  // and the "remaining" balance in the UI.
  
  const totalSubtotalToCover = afterManualDiscount;
  const subtotalCovered = payments.reduce((acc, p) => acc + p.amount, 0);
  const totalPaid = payments.reduce((acc, p) => acc + p.finalAmount, 0);
  const remainingSubtotal = Math.max(0, totalSubtotalToCover - subtotalCovered);

  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDiscount(0);
    setPayments([]);
    toast.success("Carrito vaciado");
  };

  const saveToPending = () => {
    if (cart.length === 0) return;
    const newPending: PendingOrder = {
      id: Math.random().toString(36).substr(2, 9),
      cart: [...cart],
      customer: selectedCustomer,
      timestamp: Date.now(),
      discount,
      total: totalSubtotalToCover
    };
    setPendingOrders(prev => [newPending, ...prev]);
    setCart([]);
    setDiscount(0);
    setSelectedCustomer(null);
    toast.success("Orden puesta en espera");
  };

  const loadPendingOrder = (order: PendingOrder) => {
    setCart(order.cart);
    setSelectedCustomer(order.customer);
    setDiscount(order.discount);
    setPendingOrders(prev => prev.filter(o => o.id !== order.id));
    toast.success("Orden recuperada");
  };

  const removePendingOrder = (id: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== id));
    toast.success("Orden eliminada");
  };

  const addToCart = (prod: any) => {
    if (prod.stock <= 0) {
      toast.error("Producto sin stock disponible");
      return;
    }

    const existing = cart.find(i => i.variantId === prod.variant_id);
    if (existing) {
      if (existing.quantity >= prod.stock) {
        toast.error(`Stock máximo alcanzado (${prod.stock})`);
        return;
      }
      setCart(prev => prev.map(i => i.variantId === prod.variant_id ? { ...i, quantity: i.quantity + 1 } : i));
      return;
    }

    setCart(prev => {
      
      // Parse manual price overrides from provider_info (with validation for corrupt data)
      let overridePrices = undefined;
      try {
        const rawInfo = prod.provider_info;
        // Validation: skip if it's the known corrupt string "[object Object]"
        if (rawInfo && String(rawInfo) !== "[object Object]") {
          const pInfo = typeof rawInfo === 'string' ? JSON.parse(rawInfo) : rawInfo;
          if (pInfo && pInfo.manual_prices) {
            overridePrices = {
              debit: Number(pInfo.manual_prices.debito || pInfo.manual_prices.debit) || 0,
              credit: Number(pInfo.manual_prices.credito || pInfo.manual_prices.credit) || 0,
              efectivo: Number(pInfo.manual_prices.efectivo) || 0
            };
          }
        }
      } catch (e) {
        console.warn("Invalid provider_info format:", e);
      }

      const baseCash = overridePrices?.efectivo || prod.pvp || prod.price || 0;

      const newItem: CartItem = { 
        id: prod.id, 
        variantId: prod.variant_id,
        sku: prod.sku,
        name: prod.name,
        price: baseCash, // Default displayed price
        quantity: 1,
        size: prod.size || 'N/A',
        color: prod.color || 'N/A',
        image: prod.image,
        category: prod.category || 'General',
        stock: prod.stock,
        prices: {
          cash: baseCash,
          debit: overridePrices?.debit || baseCash,
          credit: overridePrices?.credit || baseCash
        }
      };
      return [...prev, newItem];
    });
  };

  const removeFromCart = (variantId: number) => setCart(prev => prev.filter(i => i.variantId !== variantId));
  
  const updateQty = (variantId: number, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.variantId === variantId) {
        const newQty = i.quantity + delta;
        if (newQty < 1) return i;
        if (delta > 0 && newQty > i.stock) {
          toast.error(`Stock máximo alcanzado (${i.stock})`);
          return i;
        }
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const handleFinishSale = async () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }

    if (remainingSubtotal > 0.01) {
      toast.error(`Aún falta cubrir ${formatCurrency(remainingSubtotal)} del subtotal`);
      return;
    }

    // Validation: Store Credit (Cta. Corriente) requires a selected customer
    const usesStoreCredit = payments.some(p => p.type === 'storeCredit');
    if (usesStoreCredit && !selectedCustomer) {
      toast.error("Debe seleccionar un cliente para utilizar Cuenta Corriente");
      return;
    }

    setLoading(true);
    try {
      // 1. Resolve Numerical User ID
      let numericalUserId: any = 1; 
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          console.log("🔍 Buscando perfil para:", authUser.email);
          const { data: profile, error: profileErr } = await supabase
            .from('users')
            .select('id')
            .eq('email', authUser.email)
            .maybeSingle();
          
          if (profile) {
            numericalUserId = profile.id;
            console.log("✅ ID Numérico encontrado:", numericalUserId);
          } else {
            console.warn("⚠️ No se encontró perfil en 'users' para este email. Usando fallback 1.");
            if (profileErr) console.error("Error perfil:", profileErr);
          }
        }
      } catch (userErr) {
        console.warn("⚠️ Error al resolver ID de usuario:", userErr);
      }

      // 2. Prepare data
      const v2Payments = {
        cash: payments.filter(p => p.type === 'cash').reduce((a, b) => a + b.amount, 0),
        credit: payments.filter(p => p.type === 'credit').reduce((a, b) => a + b.amount, 0),
        storeCredit: payments.filter(p => p.type === 'storeCredit').reduce((a, b) => a + b.amount, 0)
      };

      const cartMapped = cart.map(item => ({
        variant_id: item.variantId,
        quantity: Number(item.quantity),
        price: Number(item.prices[paymentMethod] || item.prices.cash)
      }));

      let response;
      try {
        // PRIORIDAD 1: Cloud V3
        console.log("📡 Intentando Venta Cloud (V3)...");
        response = await api.processSaleV3({
          p_client_id: selectedCustomer?.id || null,
          p_user_id: numericalUserId,
          p_cart: cartMapped,
          p_payments: payments, 
          p_total: Number(totalPaid),
          p_vendedor: selectedOperator?.name || 'Vendedor'
        });
      } catch (err: any) {
        console.warn("⚠️ Cloud V3 falló:", err.message);
        try {
          // PRIORIDAD 2: Cloud V2
          console.log("📡 Intentando Venta Cloud (V2)...");
          response = await api.processSaleRPC({
            clientId: selectedCustomer?.id || null,
            userId: numericalUserId,
            cart: cartMapped,
            total: Number(totalPaid),
            payments: v2Payments,
            seller: selectedOperator?.name || 'Vendedor'
          });
        } catch (v2Err: any) {
          const isExpected = v2Err.code === '42501' || v2Err.code === '42703';
          if (isExpected) {
            console.log("ℹ️ Cloud bloqueado por RLS/Esquema. Procesando venta en modo LOCAL...");
          } else {
            console.warn("⚠️ Fallo inesperado en la nube, intentando modo LOCAL...", v2Err.message || v2Err);
          }
          try {
            // PRIORIDAD 3: Local Server
            response = await api.processSaleLocal({
              clientId: selectedCustomer?.id || null,
              userId: numericalUserId,
              cart: cart.map(item => ({
                id: item.variantId,
                quantity: item.quantity,
                pvp: item.prices[paymentMethod] || item.prices.cash
              })),
              total: Number(totalPaid),
              paymentMethod: paymentMethod,
              payments: v2Payments,
              seller: selectedOperator?.name || 'Vendedor'
            });
            toast.info("Venta guardada en servidor local.");
          } catch (localErr: any) {
            console.error("❌ Fallo total de sincronización:", localErr);
            if (localErr.message?.includes('42501') || String(localErr).includes('42501')) {
              toast.error("Error de Permisos (RLS): La base de datos bloquea la venta. Revise las políticas de la tabla 'sales' en Supabase.");
            } else {
              toast.error("Error al procesar venta. Verifique consola.");
            }
            throw localErr;
          }
        }
      }
      
      // Prepare ticket data
      const ticketItems = cart.map(item => ({
        name: item.name,
        price: item.prices[paymentMethod],
        qty: item.quantity,
        color: item.color || 'Único',
        size: item.size || 'Único'
      }));

      const saleRecord = {
        id: response.sale_id || response.id || 'N/A',
        timestamp: new Date().toISOString(),
        customer: selectedCustomer?.name || 'Consumidor Final',
        seller: selectedOperator?.name || 'Vendedor',
        terminal: 'CAJA 01',
        total: totalPaid,
        payment_details: {
          cash: payments.filter(p => p.type === 'cash').reduce((acc, p) => acc + p.finalAmount, 0),
          debit: payments.filter(p => p.type === 'debit' || p.type === 'qr').reduce((acc, p) => acc + p.finalAmount, 0),
          credit: payments.filter(p => p.type === 'credit' || p.type === 'storeCredit').reduce((acc, p) => acc + p.finalAmount, 0)
        }
      };

      setLastSaleData({
        sale: saleRecord,
        items: ticketItems
      });

      try {
        const chimeAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2434/2434-preview.mp3');
        chimeAudio.volume = 0.4;
        chimeAudio.play().catch(() => {});
      } catch {}

      toast.success(`Venta de ${formatCurrency(totalPaid)} Finalizada con Éxito`);
      
      window.dispatchEvent(new CustomEvent('refresh-stock'));
      window.dispatchEvent(new CustomEvent('refresh-sales'));
      
      // Reset
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setPayments([]);
      setSearchTerm('');
      setRefreshTrigger(prev => prev + 1);
      setView('cart');
      setShowTicketModal(true);
      
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } catch (e: any) {
      toast.error(e.message || "Error al procesar la venta");
    } finally {
      setLoading(false);
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setShowSurchargeModal(true);
      }
      if (e.key === 'F10') {
        e.preventDefault();
        handleFinishSale();
      }
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setPayments(prev => {
          const first = prev[0] || { id: '1', type: 'cash', amount: totalSubtotalToCover, finalAmount: totalSubtotalToCover };
          let nextType: PaymentEntry['type'] = 'cash';
          if (first.type === 'cash') nextType = 'credit';
          else if (first.type === 'credit') nextType = 'storeCredit';
          else nextType = 'cash';
          
          return [{ ...first, type: nextType }];
        });
      }
      if (e.key === 'Enter' && searchTerm && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        const itemToAdd = searchResults.find(p => p.barcode === searchTerm || p.sku === searchTerm) || (searchResults.length === 1 ? searchResults[0] : null);
        if (itemToAdd) {
          addToCart(itemToAdd);
          setSearchTerm('');
          setSearchResults([]);
          toast.success(`Añadido: ${itemToAdd.name}`);
        }
      }
      if (e.key === 'Escape') {
        setSearchTerm('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, totalSubtotalToCover, searchResults, searchTerm]);

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-[#F8F9FA] font-sans">

      <div className="flex flex-1 overflow-hidden border-t border-[#E9ECEF] bg-white">
        {/* LEFT COLUMN: PRODUCTS (Flexible) */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-[#E9ECEF] overflow-hidden">
          {/* TOPBAR */}
          <div className="flex items-center gap-4 p-4 border-b border-slate-100 bg-white shrink-0 shadow-sm z-10">
            <button 
              onClick={onMenuClick}
              className="lg:hidden p-2 text-slate-500 hover:text-indigo-600 transition-colors shrink-0"
            >
              <Menu size={22} />
            </button>
            
            <div className="relative flex-1 group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Search size={18} strokeWidth={2.5} />
                <div className="w-[1px] h-4 bg-slate-200 group-focus-within:bg-indigo-200"></div>
              </div>
              <input 
                ref={searchInputRef}
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-4 text-[13px] font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium shadow-inner"
                placeholder="Buscar por nombre, talle, marca, SKU o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-300 bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-sm">ENTER</span>
              </div>
            </div>

            <div className="hidden xl:block">
              <OperatorSelector />
            </div>

            <button 
              onClick={() => setShowCustomerModal(true)}
              className="flex items-center h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 gap-3 cursor-pointer hover:bg-white hover:border-indigo-400 hover:shadow-md transition-all shrink-0 group"
            >
              <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                <User size={16} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col items-start leading-none overflow-hidden">
                <span className="text-[12px] font-black text-slate-800 truncate uppercase tracking-tight">
                  {selectedCustomer?.name || 'Cliente'}
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  {selectedCustomer?.dni_tax_id || 'Consumidor Final'}
                </span>
              </div>
              <ChevronDown size={14} className="text-slate-300 ml-1 group-hover:text-indigo-500 transition-colors" />
            </button>

            <div className="flex gap-1 shrink-0">
              <div className="relative group">
                <select 
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-12 appearance-none bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-10 text-[12px] font-black text-slate-800 outline-none cursor-pointer hover:bg-white hover:border-indigo-400 hover:shadow-md transition-all shadow-inner"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-indigo-500 pointer-events-none transition-colors" />
              </div>
            </div>
          </div>

          {/* PRODUCT GRID AREA */}
          <div className="flex-1 overflow-y-auto bg-[#FBFBFC] scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            <ProductGrid 
              products={displayedProducts} 
              onAddToCart={addToCart} 
              isLoading={loading}
            />
          </div>
        </div>

        {/* RIGHT COLUMN: CHECKOUT (Fixed 300px) */}
        <div className="w-[300px] flex flex-col bg-white overflow-hidden shrink-0">
          <CheckoutPanel 
            cart={cart}
            subtotal={subtotal}
            paymentMethod={paymentMethod}
            discount={discount}
            setDiscount={setDiscount}
            totalSubtotalToCover={totalSubtotalToCover}
            remainingSubtotal={remainingSubtotal}
            totalPaid={totalPaid}
            payments={payments}
            setPayments={setPayments}
            customers={customers}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            fees={fees}
            onUpdateQty={updateQty}
            onRemove={removeFromCart}
            onClearCart={clearCart}
            onFinishSale={handleFinishSale}
            onSavePending={saveToPending}
            loading={loading}

            onShowSurcharge={() => setShowSurchargeModal(true)}
            onShowPending={() => setShowPendingModal(true)}
            pendingCount={pendingOrders.length}
          />
        </div>
      </div>

      {/* Modals */}
      <PendingOrdersModal 
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        orders={pendingOrders}
        onResume={(order) => {
          loadPendingOrder(order);
          setShowPendingModal(false);
        }}
        onRemove={removePendingOrder}
      />

      <SurchargeConfigModal 
        isOpen={showSurchargeModal}
        onClose={() => setShowSurchargeModal(false)}
        fees={fees}
        onUpdateFees={setFees}
      />

      <CustomerSelectorModal 
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSelect={(customer) => {
          setSelectedCustomer(customer);
          setShowCustomerModal(false);
        }}
        onCreateNew={() => {
          setShowCustomerModal(false);
          setShowCreateCustomerModal(true);
        }}
      />

      <CreateCustomerModal 
        isOpen={showCreateCustomerModal}
        onClose={() => setShowCreateCustomerModal(false)}
        onSuccess={(customer) => {
          setSelectedCustomer(customer);
          setShowCreateCustomerModal(false);
        }}
      />

      <SaleTicketModal 
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        saleData={lastSaleData}
      />
    </div>
  );
}


export default POS;
