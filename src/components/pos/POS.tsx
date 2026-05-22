import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  User, 
  ChevronDown,
  Menu
} from 'lucide-react';
import { toast, formatCurrency } from '../common/CommonUI';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useOperator } from '../../hooks/useOperator';
import { ProductGrid } from './ProductGrid';
import { CheckoutPanel } from './CheckoutPanel';
import { PendingOrdersModal } from './PendingOrdersModal';
import { SurchargeConfigModal } from './SurchargeConfigModal';
import { CustomerSelectorModal } from './CustomerSelectorModal';
import { CreateCustomerModal } from './CreateCustomerModal';
import { OperatorSelector } from '../Header/OperatorSelector';
import { SaleTicketModal } from './SaleTicketModal';
import { useCart } from '../../hooks/useCart';
import { PendingOrder } from '../../types/cart';

export interface PaymentEntry {
  id: string;
  type: 'cash' | 'qr' | 'debit' | 'credit' | 'storeCredit';
  amount: number;
  finalAmount: number;
  network?: string;
  installments?: number;
}

export interface PaymentFees {
  cashDiscount: number;
  qrSurcharge: number;
  debitSurcharge: number;
  creditSurcharges: {
    [key: number]: number; // cuotas: porcentaje
  };
}


interface POSProps {
  onMenuClick?: () => void;
}

function POS({ onMenuClick }: POSProps) {
  const { user } = useAuth();
  // --- State ---
  const { 
    cart, 
    addItem, 
    removeItem, 
    updateQty, 
    clearCart
  } = useCart();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [displayedProducts, setDisplayedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todas']);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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
  // cart persistence is now handled by useCart

  useEffect(() => {
    localStorage.setItem('arcadia_fees', JSON.stringify(fees));
  }, [fees]);

  useEffect(() => {
    localStorage.setItem('arcadia_pending', JSON.stringify(pendingOrders));
  }, [pendingOrders]);

  // --- Initialization ---

  useEffect(() => {
    const refreshData = async () => {
      try {
        const [attrs, clients, items] = await Promise.all([
          api.getCatalogAttributes(),
          api.getClients(),
          api.getProductsWithStock(categoryFilter === 'Todas' ? undefined : categoryFilter)
        ]);
        if (attrs && Array.isArray(attrs.categories)) {
          setCategories(['Todas', ...attrs.categories.sort()]);
        }
        setCustomers(clients || []);
        if (!searchTerm) {
          setDisplayedProducts(items);
        }
      } catch (e) {
        console.error("Initialization error:", e);
      }
    };
    
    refreshData();

    window.addEventListener('refresh-attributes', refreshData);
    window.addEventListener('refresh-stock', refreshData);
    return () => {
      window.removeEventListener('refresh-attributes', refreshData);
      window.removeEventListener('refresh-stock', refreshData);
    };
  }, []);

  // --- CART INTEGRITY SENTINEL (Production Safety) ---
  useEffect(() => {
    if (cart.length > 0) {
      const hasLegacy = cart.some(i => 'variantId' in i || 'productId' in i || 'price' in i);
      if (hasLegacy) {
        console.error("🚨 [CRITICAL_CONTRACT_VIOLATION] Legacy keys detected in cart state!", cart);
      } else {
        console.log("💎 [CART_SNAPSHOT_VALID]", JSON.stringify(cart, null, 2));
      }
    }
  }, [cart]);

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
      // Defensive check: ensure item and prices exist
      if (!item || !item.prices) return acc;
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

  const handleClearCart = () => {
    if (cart.length === 0) return;
    clearCart();
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
    clearCart();
    setDiscount(0);
    setSelectedCustomer(null);
    toast.success("Orden puesta en espera");
  };

  const loadPendingOrder = (order: PendingOrder) => {
    // Note: Pending orders cart should also be normalized/repaired if possible
    // For now we set them directly but useCart will handle next save
    // Ideally useCart would expose a setBulkCart method with normalization
    // but for now we'll rely on the gate for individual items.
    // Fixed: addItem handles normalization. For bulk, we'll need a different approach
    // but the Gate architecture protects the state.
    // @ts-ignore
    order.cart.forEach(item => addItem(item));
    setSelectedCustomer(order.customer);
    setDiscount(order.discount);
    setPendingOrders(prev => prev.filter(o => o.id !== order.id));
    toast.success("Orden recuperada");
  };

  const removePendingOrder = (id: string) => {
    setPendingOrders(prev => prev.filter(o => o.id !== id));
    toast.success("Orden eliminada");
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

    const usesStoreCredit = payments.some(p => p.type === 'storeCredit');
    if (usesStoreCredit && !selectedCustomer) {
      toast.error("Debe seleccionar un cliente para utilizar Cuenta Corriente");
      return;
    }

    if (totalPaid <= 0) {
      toast.error("El total cobrado debe ser mayor a cero");
      return;
    }

    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userId = authUser?.id;
      if (!userId) throw new Error("No hay una sesión de usuario activa");
      
      // 1. STRICT VARIANT VALIDATION & MAPPING
      const invalidItems: any[] = [];
      const validItems = (cart || []).map(item => {
        if (!item.variant_id) {
          invalidItems.push(item);
          return null;
        }
        return {
          variant_id: item.variant_id,
          quantity: Number(item.quantity || 0),
          price_at_sale: Number(item.price_at_sale || 0)
        };
      }).filter((i): i is { variant_id: string; quantity: number; price_at_sale: number } => i !== null);

      // 2. FAIL-FAST GATE
      if (invalidItems.length > 0) {
        console.error("❌ [SALE_BLOCKED] Items missing variant_id:", invalidItems);
        toast.error(`Error: ${invalidItems.length} productos no tienen ID de variante válido.`);
        setLoading(false);
        return;
      }

      // 3. EXACT PAYLOAD CONSTRUCTION
      const saleId = crypto.randomUUID();
      const payload = {
        saleData: {
          id: saleId,
          user_id: user?.id,
          store_id: user?.store_id || null, // Ensure store_id is present if available
          total: Number(totalPaid),
          payment_method: paymentMethod,
          cash_amount: payments.filter(p => p.type === 'cash').reduce((acc, p) => acc + p.finalAmount, 0),
          credit_amount: payments.filter(p => p.type === 'credit' || p.type === 'debit' || p.type === 'qr').reduce((acc, p) => acc + p.finalAmount, 0),
          store_credit_amount: payments.filter(p => p.type === 'storeCredit').reduce((acc, p) => acc + p.finalAmount, 0),
          vendedor: selectedOperator?.name || 'Vendedor',
          payments: payments.map(p => ({
            type: p.type,
            amount: p.amount,
            final_amount: p.finalAmount,
            installments: p.installments || 1,
            network: p.network || null
          }))
        },
        items: validItems
      };

      // 4. DEBUGGING LOGS
      console.log("🚀 [FINAL_SALE_PAYLOAD]", payload);
      
      // Perform API call
      const localRes = await api.processSale(payload);
      
      const ticketItems = cart.map(item => ({
        name: item.name,
        price: item.prices[paymentMethod],
        qty: item.quantity,
        color: item.color || 'Único',
        size: item.size || 'Único'
      }));

      const saleRecord = {
        id: localRes?.id || 'N/A',
        client_phone: selectedCustomer?.phone || '',
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
      
      clearCart();
      setDiscount(0);
      setSelectedCustomer(null);
      setPayments([]);
      setSearchTerm('');
      setRefreshTrigger(prev => prev + 1);
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
          addItem(itemToAdd);
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
              onAddToCart={addItem} 
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
            onRemove={removeItem}
            onClearCart={handleClearCart}
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
