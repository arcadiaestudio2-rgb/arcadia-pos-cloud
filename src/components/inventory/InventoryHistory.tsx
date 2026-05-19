import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search,
  AlertTriangle,
  Clock,
  PackagePlus,
  MinusCircle,
  TrendingUp,
  Settings,
  DollarSign,
  Tag,
  User,
  Info,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Package,
  ChevronDown,
  ChevronRight,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryHistoryProps {
  movements: any[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  loadMore?: () => void;
  error: string | null;
  annulSession?: (session: { evento_id?: string | null; movements: any[] }) => Promise<boolean>;
}

const MOVEMENT_TYPES = [
  { id: 'all', label: 'Todos', icon: History, color: 'bg-slate-500' },
  { id: 'ingreso', label: 'Ingresos', icon: PackagePlus, color: 'bg-tertiary' },
  { id: 'egreso', label: 'Egresos', icon: MinusCircle, color: 'bg-error' },
  { id: 'PRICE_CHANGE', label: 'Precios', icon: Tag, color: 'bg-indigo-500' },
  { id: 'financiero', label: 'Financiero', icon: DollarSign, color: 'bg-primary' },
  { id: 'otros', label: 'Otros', icon: Settings, color: 'bg-warning' },
];

const PriceChangeDetail = ({ details }: { details: any }) => {
  if (!details) return null;

  const PriceRow = ({ label, data }: { label: string, data: any }) => {
    const isPositive = data.delta > 0;
    const isNeutral = data.delta === 0;
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400">${data.old.toLocaleString()}</span>
          <ChevronRight size={12} className="text-slate-200" />
          <span className="text-sm font-black text-on-surface">${data.new.toLocaleString()}</span>
          {!isNeutral && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {isPositive ? '+' : ''}{data.percent.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 mt-2">
      <PriceRow label="Efectivo" data={details.cash} />
      <PriceRow label="Débito" data={details.debit} />
      <PriceRow label="Crédito" data={details.credit} />
    </div>
  );
};

export function InventoryHistory({ 
  movements, 
  loading, 
  loadingMore = false,
  hasMore = false,
  loadMore = () => {},
  error,
  annulSession
}: InventoryHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedCustomDates, setAppliedCustomDates] = useState<{ start: string; end: string } | null>(null);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [isAnnulling, setIsAnnulling] = useState<string | null>(null);

  const DATE_CHIPS = useMemo(() => [
    { id: 'hoy', label: 'Hoy' },
    { id: 'ayer', label: 'Ayer' },
    { id: '7days', label: '7 días' },
    { id: 'thisMonth', label: 'Este mes' },
    { id: 'custom', label: 'Custom' },
  ], []);

  const handleDateChipClick = (id: string) => {
    if (dateFilter === id) {
      setDateFilter('all');
      if (id === 'custom') {
        setCustomStartDate('');
        setCustomEndDate('');
        setAppliedCustomDates(null);
      }
    } else {
      setDateFilter(id);
      if (id !== 'custom') {
        setCustomStartDate('');
        setCustomEndDate('');
        setAppliedCustomDates(null);
      }
    }
  };

  const applyCustomDates = () => {
    if (customStartDate || customEndDate) {
      setAppliedCustomDates({ start: customStartDate, end: customEndDate });
    } else {
      setAppliedCustomDates(null);
    }
  };

  const clearCustomDates = () => {
    setCustomStartDate('');
    setCustomEndDate('');
    setAppliedCustomDates(null);
    setDateFilter('all');
  };

  const filteredMovements = useMemo(() => {
    try {
      if (!Array.isArray(movements)) return [];
      return movements.filter(m => {
        const mReason = (m?.reason || '').toLowerCase();
        // Hide POS sales from inventory audit log to keep it focused on manual adjustments
        if (mReason.includes('venta')) return false;

        const search = searchTerm.toLowerCase().trim();
        const matchesSearch = 
          (m?.product_name?.toLowerCase() || '').includes(search) ||
          mReason.includes(search) ||
          (m?.user?.toLowerCase() || '').includes(search) ||
          (m?.sku?.toLowerCase() || '').includes(search);
        
        let mType = 'otros';
        const type = (m?.type || '').toLowerCase();
        const amount = m?.change_amount || m?.quantity || 0;
        
        if (type === 'ingreso' || mReason.includes('ingreso') || mReason.includes('devolución') || mReason.includes('alta') || amount > 0) {
          mType = 'ingreso';
        } else if (type === 'egreso' || mReason.includes('rotura') || mReason.includes('robo') || mReason.includes('baja') || amount < 0) {
          mType = 'egreso';
        } else if (type === 'financiero' || mReason.includes('precio') || mReason.includes('costo') || mReason.includes('margen')) {
          mType = 'financiero';
        } else {
          mType = 'otros';
        }

        const matchesType = filterType === 'all' || mType === filterType;

        let matchesDate = true;
        if (dateFilter !== 'all') {
          const mDate = new Date(m.created_at || m.created_at);
          const now = new Date();

          if (dateFilter === 'hoy') {
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            matchesDate = mDate >= startOfToday && mDate <= endOfToday;
          } else if (dateFilter === 'ayer') {
            const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
            const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
            matchesDate = mDate >= startOfYesterday && mDate <= endOfYesterday;
          } else if (dateFilter === '7days') {
            const startOf7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
            matchesDate = mDate >= startOf7Days;
          } else if (dateFilter === 'thisMonth') {
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            matchesDate = mDate >= startOfThisMonth;
          } else if (dateFilter === 'custom' && appliedCustomDates) {
            const { start, end } = appliedCustomDates;
            if (start) {
              const startDate = new Date(start + 'T00:00:00');
              if (mDate < startDate) matchesDate = false;
            }
            if (end) {
              const endDate = new Date(end + 'T23:59:59.999');
              if (mDate > endDate) matchesDate = false;
            }
          }
        }

        return matchesSearch && matchesType && matchesDate;
      });
    } catch (e) {
      console.error("Error filtering movements:", e);
      return [];
    }
  }, [movements, searchTerm, filterType, dateFilter, appliedCustomDates]);

  const groupedSessions = useMemo(() => {
    // ── STRICT REDUCE: ONE ENTRY PER BATCH OPERATION ──────────────────────────
    // Priority for group key:
    //   1. batch_id   (explicit batch identifier)
    //   2. evento_id  (event identifier — same semantics)
    //   3. fallback   baseName + date(day) + reason + type
    //      → groups ALL variants of the same load operation even without a batch ID
    const groups = filteredMovements.reduce<Record<string, any>>((acc, m) => {
      // Use event_id (the correct field name from the API)
      const batchKey = m.batch_id || m.event_id || null;
      const dateDay  = new Date(m.created_at || m.created_at).toISOString().slice(0, 10);

      // Strip "(Talle - Color)" parenthetical to obtain the base product name
      // Prefer base_product_name if available (flat field added in api.ts)
      const baseName = m.base_product_name
        || (m.product_name || 'Producto').replace(/\s*\([^)]*\)\s*$/, '').trim();

      // Normalise reason: remove SKU tokens so variants with different SKUs share the same key
      const normReason = (m.reason || '')
        .replace(/SKU:\s*\S+/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .toLowerCase();

      const groupKey = batchKey
        ? `batch__${batchKey}`
        : `op__${baseName}__${dateDay}__${normReason}__${m.type ?? 'otros'}`;

      if (!acc[groupKey]) {
        acc[groupKey] = {
          id: groupKey,
          batch_id:    m.batch_id  || null,
          evento_id:   m.event_id  || null,  // store under evento_id for annulSession compatibility
          created_at: m.created_at || m.created_at,
          user:        m.operator  || m.user_name || m.user || 'Sistema',
          reason:      m.reason,
          type:        m.type,
          is_annulled: !!m.is_annulled,
          is_batch:    !!batchKey,
          movements:   [],
          total_amount: 0,
          product_name: baseName,
        };
      }

      acc[groupKey].movements.push(m);

      // Accumulate stock units only for non-financial movements
      if (m.type !== 'financiero') {
        acc[groupKey].total_amount += (m.change_amount ?? m.quantity ?? 0);
      }

      // Propagate annulment flag
      if (m.is_annulled) acc[groupKey].is_annulled = true;

      return acc;
    }, {});

    // ── POST-PROCESS: resolve display name & build variant summary ─────────────
    Object.values(groups).forEach((group: any) => {
      const stripVariant = (name: string) =>
        (name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

      const firstBase = stripVariant(group.movements[0]?.product_name ?? '');
      const isMixed   = group.movements.some(
        (mv: any) => stripVariant(mv.product_name) !== firstBase
      );

      // Always use the clean base name (no "(L - Rojo)" in the title)
      if (isMixed) {
        group.product_name = `Lote Mixto (${group.movements.length} ítems)`;
      } else if (firstBase) {
        group.product_name = firstBase;
      }

      // Build compact variant summary using flat size/color fields from API
      const stockMoves = group.movements.filter((mv: any) => mv.type !== 'financiero');

      const resolveSize  = (mv: any) => mv.size  || mv.inventory_items?.size  || mv.variant?.size  || 'ÚNICA';
      const resolveColor = (mv: any) => mv.color || mv.inventory_items?.color || mv.variant?.color || 'S/C';

      if (stockMoves.length > 1) {
        group.variant_summary = stockMoves
          .map((mv: any) => {
            const size  = resolveSize(mv);
            const color = resolveColor(mv);
            const qty   = Math.abs(mv.change_amount ?? mv.quantity ?? 0);
            return `${size} - ${color} (${qty}u)`;
          })
          .join(', ');
        group.single_variant = null;
      } else {
        // Single-variant: expose "Talle · Color" for inline display on the master row
        const mv = stockMoves[0] ?? group.movements[0];
        group.variant_summary = null;
        group.single_variant  = mv
          ? `${resolveSize(mv)} · ${resolveColor(mv)}`
          : null;
      }
    });


    // Sort by most recent first
    return Object.values(groups).sort(
      (a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filteredMovements]);

  const toggleSession = (id: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAnnul = async (e: React.MouseEvent, session: any) => {
    e.stopPropagation();
    if (!annulSession) return;

    const moveCount = session.movements?.length ?? 1;
    if (!window.confirm(
      `¿Estás seguro de que deseas anular esta operación?\n` +
      `Se revertirán ${moveCount} movimiento(s). Esta acción no se puede deshacer.`
    )) return;

    setIsAnnulling(session.id);
    try {
      await annulSession({
        evento_id: session.evento_id ?? null,
        movements: session.movements ?? [],
      });
    } finally {
      setIsAnnulling(null);
    }
  };

  const getMovementStyle = (movement: any) => {
    const styleReason = (movement.reason || '').toLowerCase();
    const type = (movement.type || '').toLowerCase();
    const amount = movement.change_amount || movement.quantity || 0;

    if (type === 'ingreso' || type === 'venta' || type === 'initial_stock' || styleReason.includes('alta') || styleReason.includes('ingreso') || styleReason.includes('venta') || amount > 0) {
      return { 
        border: 'border-l-tertiary', 
        text: 'text-tertiary', 
        bg: 'bg-tertiary/5', 
        icon: type === 'venta' ? TrendingUp : PackagePlus,
        accent: 'tertiary'
      };
    }
    
    if (type === 'egreso' || styleReason.includes('rotura') || styleReason.includes('robo') || styleReason.includes('ajuste (-)') || styleReason.includes('baja') || amount < 0) {
      return { 
        border: 'border-l-error', 
        text: 'text-error', 
        bg: 'bg-error/5', 
        icon: MinusCircle,
        accent: 'error'
      };
    }
    
    if (type === 'financiero' || type === 'price_change' || type === 'price_change' || styleReason.includes('precio') || styleReason.includes('costo') || styleReason.includes('margen')) {
      const isPriceChange = type === 'price_change' || type === 'price_change' || styleReason.includes('price_change');
      return { 
        border: isPriceChange ? 'border-l-indigo-500' : 'border-l-primary', 
        text: isPriceChange ? 'text-indigo-600' : 'text-primary', 
        bg: isPriceChange ? 'bg-indigo-50/50' : 'bg-primary/5', 
        icon: isPriceChange ? Tag : DollarSign,
        accent: isPriceChange ? 'indigo' : 'primary'
      };
    }

    return { 
      border: 'border-l-warning', 
      text: 'text-warning', 
      bg: 'bg-warning/5', 
      icon: Settings,
      accent: 'warning'
    };
  };

  const parseMovementDetails = (movement: any) => {
    const fullReason = movement.reason || '';
    let operator = movement.user_name || movement.user || '';

    // Extract operator from [Op: Name] or (Op: Name) patterns
    const opMatch = fullReason.match(/[(\[]Op:?\s*([^)\]]+)[)\]]/i);
    let cleanReason = fullReason;
    if (opMatch) {
      // If found in reason, this is likely the more accurate operator for this movement
      operator = opMatch[1].trim();
      cleanReason = fullReason.replace(opMatch[0], '').trim();
    }

    // Handle JSON Price Change Logs
    if (cleanReason.startsWith('PRICE_CHANGE_V1|')) {
      try {
        const payload = JSON.parse(cleanReason.split('|')[1]);
        return {
          motive: 'Ajuste de Precios',
          description: payload.reason || 'Cambio masivo de lista',
          operator: payload.operator?.name || operator || 'Sistema',
          priceChange: payload.prices,
          source: payload.source,
          isRich: true
        };
      } catch (e) {
        console.warn("Error parsing price log:", e);
      }
    }

    // Handle structured financial data: COSTO: {cost} | MARGEN: {margin} | PVP: {pvp} | MOTIVO: {reason}
    if (cleanReason.includes('COSTO:') && cleanReason.includes('MARGEN:')) {
      const parts = cleanReason.split('|').map((p: string) => p.trim());
      const data: any = {};
      parts.forEach((p: string) => {
        const [k, ...v] = p.split(':');
        if (k && v.length) data[k.trim()] = v.join(':').trim();
      });

      return {
        motive: 'Ajuste Financiero',
        description: data.MOTIVO || 'Cambio de precios',
        operator: operator || 'Sistema',
        financial: {
          cost: data.COSTO,
          margin: data.MARGEN,
          pvp: data.PVP
        }
      };
    }

    // Split by colon to separate Motive and Description
    // e.g., "Ingreso: Carga inicial" -> motive: "Ingreso", description: "Carga inicial"
    const parts = cleanReason.split(':');
    let motive = '';
    let description = '';

    if (parts.length > 1) {
      motive = parts[0].trim();
      description = parts.slice(1).join(':').trim();
    } else {
      // If no colon, use a generic motive if it's one of the known types, otherwise use the reason as motive
      motive = cleanReason || 'Sin especificar';
      
      // If the motive is too long, it's probably a description
      if (motive.length > 30) {
        description = motive;
        motive = 'Ajuste';
      }
    }

    return { motive, description, operator: operator || 'Sistema' };
  };

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="text-error" size={32} />
        </div>
        <h3 className="text-xl font-black uppercase text-on-surface mb-2">¡Ups! Algo salió mal</h3>
        <p className="text-slate-500 font-bold max-w-sm mx-auto">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header & Search */}
      <div className="flex flex-col gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="relative group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search className="text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
          </div>
          <input
            type="text"
            placeholder="Buscar por producto, SKU, operador o motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border-0 rounded-2xl pl-16 pr-8 py-4 text-sm font-bold text-on-surface focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-slate-300 outline-none"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {/* Date quick filters */}
          <div className="flex items-center gap-2 shrink-0 border-r border-slate-100 pr-3 mr-1">
            {DATE_CHIPS.map((chip) => (
              <button
                key={chip.id}
                onClick={() => handleDateChipClick(chip.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                  dateFilter === chip.id 
                    ? 'bg-primary border-primary text-white shadow-sm' 
                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                }`}
              >
                <Calendar size={13} />
                {chip.label}
              </button>
            ))}
          </div>

          {/* Type filters */}
          {MOVEMENT_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setFilterType(type.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                filterType === type.id 
                  ? 'bg-on-surface border-on-surface text-white' 
                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
              }`}
            >
              <type.icon size={14} />
              {type.label}
            </button>
          ))}
        </div>

        {/* Level 2: Custom Datepicker Inline */}
        <AnimatePresence>
          {dateFilter === 'custom' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-wrap items-end gap-4 p-5 bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-100 overflow-hidden"
            >
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-bold">Desde</span>
                <input 
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer h-10 min-w-[140px]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-bold">Hasta</span>
                <input 
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer h-10 min-w-[140px]"
                />
              </div>
              <div className="flex gap-2 h-10">
                <button
                  onClick={applyCustomDates}
                  className="px-5 bg-on-surface text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm flex items-center justify-center min-w-[90px] font-bold"
                >
                  Aplicar
                </button>
                <button
                  onClick={clearCustomDates}
                  className="px-5 bg-white border border-slate-200 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center min-w-[90px] font-bold"
                >
                  Limpiar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session List View */}
      <div className="space-y-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-32 bg-slate-50 rounded-[2.5rem] animate-pulse border border-slate-100" />
          ))
        ) : groupedSessions.length > 0 ? (
          groupedSessions.map((session, idx) => {
            const style = getMovementStyle(session);
            const isExpanded = expandedSessions.has(session.id);
            const isPositive = session.total_amount > 0;
            const Icon = style.icon;
            
            return (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                key={session.id}
                className={`group relative bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden transition-all duration-300 ${
                  session.is_annulled ? 'opacity-60 grayscale' : 'hover:shadow-xl hover:border-slate-200'
                }`}
              >
                {/* Main Card Content */}
                <div 
                  onClick={() => toggleSession(session.id)}
                  className={`p-6 cursor-pointer flex flex-col md:flex-row items-start md:items-center gap-6 border-l-[6px] ${style.border} group-hover:bg-slate-50/50 transition-colors duration-500`}
                >
                  {/* Left: Icon & Badge */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className={`w-16 h-16 rounded-[1.25rem] ${style.bg} ${style.text} flex items-center justify-center shadow-inner relative group-hover:scale-105 transition-transform duration-500`}>
                      <Icon size={32} />
                      {session.movements.length > 1 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-black shadow-sm border border-slate-100 text-slate-400">
                          {session.movements.length}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${style.bg} ${style.text} shadow-sm shadow-current/10`}>
                          {(() => {
                            const details = parseMovementDetails(session);
                            if (details.priceChange) return 'Ajuste de Precio';
                            if (session.type === 'STOCK_CHANGE') return 'Stock';
                            if (session.type === 'PRODUCT_EDIT') return 'Edición';
                            if (session.type === 'VARIANT_CREATED') return 'Nueva Variante';
                            return session.is_batch ? 'Operación de Carga' : 'Movimiento';
                          })()}
                        </span>
                        {session.is_annulled && (
                          <span className="px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 border border-slate-200 flex items-center gap-1">
                            <XCircle size={10} /> Anulado
                          </span>
                        )}
                      </div>
                      <h4 className="font-black text-on-surface uppercase text-lg leading-tight tracking-tight">
                        {session.product_name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar size={12} className="text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {new Date(session.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                          {', '}
                          {new Date(session.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Descripción, Operador, Variantes */}
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
                    <div className="flex flex-col col-span-2 md:col-span-1">
                      <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest mb-1">Descripción</span>
                      <span className="text-xs font-bold text-slate-600 line-clamp-2" style={{ lineClamp: 2 }}>
                        {(() => {
                          const details = parseMovementDetails(session);
                          if (details.isRich && details.priceChange) {
                            return `Origen: ${details.source === 'quick_editor' ? 'Ajuste Rápido' : 'Editor Maestro'}`;
                          }
                          if (details.financial) {
                            return `COSTO: $${details.financial.cost} | MG: ${details.financial.margin}% | PVP: $${details.financial.pvp}`;
                          }
                          return details.description || 'Sin descripción';
                        })()}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest mb-1">
                        {parseMovementDetails(session).priceChange ? 'Cambio' : 'Impacto'}
                      </span>
                      <span className={`text-xl font-black italic tracking-tighter ${style.text}`}>
                        {parseMovementDetails(session).priceChange ? 'REF' : `${isPositive ? '+' : ''}${session.total_amount}`}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest mb-1">Operador</span>
                      <div className="flex items-center gap-1.5">
                        <User size={12} className="text-slate-300" />
                        <span className="text-xs font-bold text-slate-600 truncate">{parseMovementDetails(session).operator}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Total & Actions */}
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-50">
                    <div className="flex items-center gap-2">
                      {annulSession && !session.is_annulled && (
                        <button
                          onClick={(e) => handleAnnul(e, session)}
                          disabled={isAnnulling === session.id}
                          className="w-10 h-10 flex items-center justify-center bg-error/5 text-error rounded-xl hover:bg-error hover:text-white transition-all disabled:opacity-50"
                          title="Anular este movimiento"
                        >
                          {isAnnulling === session.id ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <RotateCcw size={18} />
                          )}
                        </button>
                      )}
                      <div className={`w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown size={20} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Detail Section: Variant Table */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="bg-slate-50 border-t border-slate-100 overflow-hidden"
                    >
                      <div className="px-8 pt-6 pb-8">
                        <div className="flex items-center gap-3 mb-4">
                          <Package size={16} className={style.text} />
                          <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            {parseMovementDetails(session).priceChange ? 'Detalle de Ajuste' : `Desglose de Variantes — ${session.movements.length} líneas`}
                          </h5>
                        </div>

                        {/* Variant List or Price Details */}
                        <div className="space-y-3">
                          {(() => {
                            const details = parseMovementDetails(session);
                            if (details.isRich && details.priceChange) {
                              return <PriceChangeDetail details={details.priceChange} />;
                            }
                            
                            return session.movements.map((m: any, mIdx: number) => {
                              const mAmount = m.change_amount || m.quantity || 0;
                              const mPositive = mAmount > 0;
                              const color = typeof m.color === 'string' ? m.color : (m.color?.name || m.color?.value || '-');
                              const sku = m.sku || 'N/A';
                              
                              return (
                                <div key={m.id || mIdx} className="grid grid-cols-[1fr_80px_100px_80px] gap-4 items-center p-3 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100">
                                  <span className="text-xs font-black text-on-surface uppercase">
                                    {m.size || '-'}
                                  </span>
                                  <span className="text-xs font-bold text-slate-600 uppercase">
                                    {color}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400 truncate" title={sku}>
                                    {sku}
                                  </span>
                                  <span className={`text-sm font-black italic text-right tabular-nums ${
                                    m.type === 'financiero' ? 'text-primary' : mPositive ? 'text-tertiary' : 'text-error'
                                  }`}>
                                    {m.type === 'financiero' ? '—' : `${mPositive ? '+' : ''}${mAmount}`}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* Summary footer */}
                        <div className="mt-4 flex items-center justify-between px-4 pt-4 border-t border-slate-200">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                            {parseMovementDetails(session).priceChange ? 'Estado del ajuste' : 'Total del lote'}
                          </span>
                          <span className={`text-base font-black italic ${style.text}`}>
                            {parseMovementDetails(session).priceChange ? 'PRECIOS ACTUALIZADOS' : `${isPositive ? '+' : ''}${session.total_amount} unidades`}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full p-20 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <History className="text-slate-200 mx-auto mb-4" size={64} />
            <h3 className="text-xl font-black text-slate-300 uppercase tracking-widest">Sin resultados</h3>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {hasMore && !searchTerm && (
        <div className="flex justify-center mt-12 pb-10">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className={`
              flex items-center gap-3 px-10 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all
              ${loadingMore 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-white border-2 border-on-surface text-on-surface hover:bg-on-surface hover:text-white shadow-lg hover:shadow-on-surface/20 hover:-translate-y-1 active:scale-95'
              }
            `}
          >
            {loadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                <span>Cargando...</span>
              </>
            ) : (
              <>
                <Clock size={18} />
                <span>Cargar más movimientos</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedSession && (() => {
          const style = getMovementStyle(selectedSession);
          const { operator } = parseMovementDetails(selectedSession);
          const amount = selectedSession.change_amount || selectedSession.quantity || 0;
          const isPositive = amount > 0;
          
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedSession(null)}
                className="absolute inset-0 bg-on-surface/40 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden"
              >
                <div className={`h-3 w-full ${style.bg.replace('/5', '')}`} />
                <div className="p-10">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${style.bg} ${style.text} mb-3 inline-block`}>
                        {selectedSession.type || 'Detalle de Movimiento'}
                      </span>
                      <h2 className="text-3xl font-black text-on-surface uppercase leading-tight font-headline">
                        {selectedSession.product_name}
                      </h2>
                    </div>
                    <button 
                      onClick={() => setSelectedSession(null)}
                      className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-colors"
                    >
                      <ChevronRight size={24} className="rotate-90" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Cantidad</p>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.bg} ${style.text}`}>
                          {isPositive ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                        </div>
                        <p className={`text-3xl font-black italic tracking-tighter ${style.text}`}>
                          {selectedSession.type === 'financiero' ? 'OK' : `${isPositive ? '+' : ''}${amount}`}
                        </p>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">SKU / Código</p>
                      <div className="flex items-center gap-3">
                        <Tag size={20} className="text-primary" />
                        <p className="text-xl font-black text-on-surface">{selectedSession.sku || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                        <Calendar size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Fecha y Hora</p>
                        <p className="font-black text-on-surface uppercase">
                          {new Date(selectedSession.created_at).toLocaleString('es-AR', { 
                            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                        <User size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Operador Responsable</p>
                        <p className="font-black text-on-surface uppercase">{operator}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                        <Info size={24} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Motivo y Descripción</p>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          {(() => {
                            const details = parseMovementDetails(selectedSession);
                            if (details.financial) {
                              return (
                                <div className="space-y-2">
                                  <p className="font-black text-primary uppercase text-sm">AJUSTE DE PRECIOS</p>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                                      <p className="text-[8px] font-black text-slate-400 uppercase">Costo</p>
                                      <p className="font-black text-on-surface text-xs">${details.financial.cost}</p>
                                    </div>
                                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                                      <p className="text-[8px] font-black text-slate-400 uppercase">Margen</p>
                                      <p className="font-black text-on-surface text-xs">{details.financial.margin}%</p>
                                    </div>
                                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                                      <p className="text-[8px] font-black text-slate-400 uppercase">PVP</p>
                                      <p className="font-black text-on-surface text-xs">${details.financial.pvp}</p>
                                    </div>
                                  </div>
                                  <p className="text-slate-500 font-bold italic text-xs mt-2">"{details.description}"</p>
                                </div>
                              );
                            }
                            return (
                              <>
                                <p className="font-black text-on-surface uppercase text-sm mb-1">{details.motive}</p>
                                {details.description && <p className="text-slate-500 font-bold italic text-xs leading-relaxed">"{details.description}"</p>}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    
                    {(selectedSession.evento_id || selectedSession.payload_json) && (
                      <div className="flex items-start gap-5 mt-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                          <Settings size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Detalles de Evento</p>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 overflow-x-auto">
                            {selectedSession.evento_id && (
                              <p className="font-black text-on-surface uppercase text-xs mb-2">
                                <span className="text-slate-400">ID Evento:</span> {selectedSession.evento_id}
                              </p>
                            )}
                            {selectedSession.payload_json && (
                              <div className="mt-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Payload JSON</p>
                                <pre className="text-[10px] text-slate-500 overflow-x-auto whitespace-pre-wrap font-mono bg-white p-2 rounded border border-slate-100">
                                  {(() => {
                                    try {
                                      return JSON.stringify(JSON.parse(selectedSession.payload_json), null, 2);
                                    } catch (e) {
                                      return selectedSession.payload_json;
                                    }
                                  })()}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setSelectedSession(null)}
                    className="w-full mt-10 py-5 bg-on-surface text-white rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Cerrar Detalle
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
