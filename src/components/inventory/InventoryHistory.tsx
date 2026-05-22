import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  AlertTriangle,
  Clock,
  PackagePlus,
  MinusCircle,
  Trash2,
  Settings,
  DollarSign,
  Tag,
  ClipboardCheck,
  User,
  Info,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  RotateCcw,
  Loader2,
  XCircle
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── Movement Visual Configuration ──────────────────────────────────────────
interface MovementVariant {
  key: string;
  label: string;
  icon: LucideIcon;
  badgeClass: string;
  borderClass: string;
  textClass: string;
  bgClass: string;
  showPrice?: boolean;
}

const MOVEMENT_VARIANTS: Record<string, MovementVariant> = {
  INGRESO: {
    key: 'INGRESO', label: 'Ingreso', icon: PackagePlus,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    borderClass: 'border-l-emerald-500', textClass: 'text-emerald-600', bgClass: 'bg-emerald-50'
  },
  EGRESO: {
    key: 'EGRESO', label: 'Egreso', icon: MinusCircle,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    borderClass: 'border-l-rose-500', textClass: 'text-rose-600', bgClass: 'bg-rose-50'
  },
  BAJA_MERCADERIA: {
    key: 'BAJA_MERCADERIA', label: 'Baja / Pérdida', icon: Trash2,
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    borderClass: 'border-l-orange-500', textClass: 'text-orange-600', bgClass: 'bg-orange-50'
  },
  PRICE_CHANGE: {
    key: 'PRICE_CHANGE', label: 'Cambio de Precio', icon: Tag,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    borderClass: 'border-l-blue-500', textClass: 'text-blue-600', bgClass: 'bg-blue-50',
    showPrice: true
  },
  FINANCIERO: {
    key: 'FINANCIERO', label: 'Ajuste Financiero', icon: DollarSign,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    borderClass: 'border-l-indigo-500', textClass: 'text-indigo-600', bgClass: 'bg-indigo-50'
  },
  AJUSTE_MANUAL: {
    key: 'AJUSTE_MANUAL', label: 'Ajuste Manual', icon: ClipboardCheck,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    borderClass: 'border-l-slate-400', textClass: 'text-slate-600', bgClass: 'bg-slate-50'
  },
  ANULACION: {
    key: 'ANULACION', label: 'Anulación', icon: RotateCcw,
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
    borderClass: 'border-l-slate-400', textClass: 'text-slate-500', bgClass: 'bg-slate-50'
  },
  VARIANT_CREATED: {
    key: 'VARIANT_CREATED', label: 'Alta de Variante', icon: PackagePlus,
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    borderClass: 'border-l-teal-500', textClass: 'text-teal-600', bgClass: 'bg-teal-50'
  },
};

const FALLBACK_VARIANT: MovementVariant = {
  key: 'UNKNOWN', label: 'Movimiento', icon: Settings,
  badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  borderClass: 'border-l-amber-400', textClass: 'text-amber-600', bgClass: 'bg-amber-50'
};

function resolveMovementKey(movement: any): string {
  const rawType = (movement.type || '').toUpperCase();
  const reason = (movement.reason || '').toLowerCase();

  if (!rawType || rawType === 'STOCK_CHANGE') {
    const sType = (movement.session_type || '').toUpperCase();

    if (sType === 'VARIANT_CREATED') return 'VARIANT_CREATED';

    if (sType === 'PRODUCT_EDIT') {
      if (reason.includes('precio') || reason.includes('costo') || reason.includes('pvp')) {
        return 'PRICE_CHANGE';
      }
      return 'FINANCIERO';
    }

    if (reason.includes('baja') || reason.includes('rotura') || reason.includes('pérdida') || reason.includes('vencido')) {
      return 'BAJA_MERCADERIA';
    }
    if (reason.includes('ajuste') || reason.includes('manual') || reason.includes('auditoría') || reason.includes('corrección')) {
      return 'AJUSTE_MANUAL';
    }

    return (movement.change_amount || 0) >= 0 ? 'INGRESO' : 'EGRESO';
  }

  return rawType;
}

function parsePriceDelta(reason: string): string | null {
  try {
    const pvpMatch = reason.match(/PVP:\s*([0-9.]+)/i);
    if (pvpMatch) {
      const currentPvp = parseFloat(pvpMatch[1]);
      return `PVP: $${currentPvp.toLocaleString('es-AR')}`;
    }
  } catch (e) {
    console.error("Error parseando precio", e);
  }
  return null;
}

interface AuditLogRowProps {
  movement: any;
  onSelect: (movement: any) => void;
  onAnnul: (e: React.MouseEvent, movement: any) => void;
  isAnnullingId: string | null;
  canAnnulSession: boolean;
}

const AuditLogRow: React.FC<AuditLogRowProps> = ({
  movement,
  onSelect,
  onAnnul,
  isAnnullingId,
  canAnnulSession
}) => {
  const variantKey = useMemo(() => resolveMovementKey(movement), [movement]);
  const variant = MOVEMENT_VARIANTS[variantKey] ?? FALLBACK_VARIANT;
  const Icon = variant.icon;

  const priceDisplay = variant.showPrice ? parsePriceDelta(movement.reason || '') : null;
  const amount = movement.change_amount ?? 0;
  const formattedAmount = amount >= 0 ? `+${amount}` : `${amount}`;

  const colorText = typeof movement.color === 'string'
    ? movement.color
    : (movement.color?.name || movement.color?.value || '-');

  const normalizedColor = colorText !== '-' ? colorText : '';
  const variantDetails = [movement.size, normalizedColor].filter(Boolean).join(' · ') || 'Base';

  const productName = useMemo(() => {
    if (movement.product_name?.trim()) return movement.product_name.trim();
    if (movement.base_product_name?.trim()) return movement.base_product_name.trim();
    if (movement.product?.trim()) return movement.product.trim();
    if (movement.inventory_items?.products?.name) return movement.inventory_items.products.name;
    if (movement.variants?.products?.name) return movement.variants.products.name;
    if (movement.products?.name) return movement.products.name;
    if (movement.old_data?.product_name) return movement.old_data.product_name;
    if (movement.new_data?.product_name) return movement.new_data.product_name;

    if (movement.reason) {
      const productMatch = movement.reason.match(/PRODUCTO:\s*([^|]+)/i);
      if (productMatch && productMatch[1]) return productMatch[1].trim();
    }

    return movement.sku ? `Ref: ${movement.sku}` : 'Producto no identificado';
  }, [movement]);

  const showAnnulButton = canAnnulSession && !movement.is_annulled;
  const isCurrentAnnulling = isAnnullingId === movement.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative bg-white border border-slate-100 rounded-[2rem] transition-all duration-300 ${
        movement.is_annulled ? 'opacity-60 grayscale' : 'hover:shadow-lg hover:border-slate-200'
      }`}
    >
      <div
        onClick={() => onSelect(movement)}
        className={`p-4 flex items-center justify-between border-l-[6px] ${variant.borderClass} group-hover:bg-slate-50/50 transition-colors duration-500 cursor-pointer rounded-[2rem]`}
      >
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <div className={`p-2.5 rounded-xl ${variant.bgClass} border border-slate-100 shrink-0`}>
            <Icon className={`w-5 h-5 ${variant.textClass}`} />
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center space-x-2">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border uppercase ${variant.badgeClass}`}>
                {variant.label}
              </span>
              {movement.sku && (
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  SKU: {movement.sku}
                </span>
              )}
              {movement.is_annulled && (
                <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 border border-slate-200 flex items-center gap-1">
                  <XCircle size={8} /> Anulado
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-slate-800 truncate">
              {productName}
              {variantDetails !== 'Base' && (
                <span className="text-xs text-slate-500 font-normal ml-1.5 uppercase">
                  ({variantDetails})
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 truncate max-w-md">
              {movement.reason || 'Sin observaciones registradas.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="text-right">
            {variant.showPrice && priceDisplay ? (
              <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                {priceDisplay}
              </span>
            ) : (
              <span className={`text-xs font-mono font-bold px-2 py-1 rounded-md ${
                amount >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
              }`}>
                {formattedAmount} un.
              </span>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              {new Date(movement.created_at).toLocaleDateString('es-AR')} - {new Date(movement.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {showAnnulButton && (
            <button
              onClick={(e) => onAnnul(e, movement)}
              disabled={isCurrentAnnulling}
              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-50"
              title="Anular movimiento"
            >
              {isCurrentAnnulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            </button>
          )}

          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>
      </div>
    </motion.div>
  );
};

const MOVEMENT_TYPES = [
  { id: 'all', label: 'Todos', icon: History, color: 'bg-slate-500' },
  { id: 'INGRESO', label: 'Ingresos', icon: PackagePlus, color: 'bg-emerald-500' },
  { id: 'EGRESO', label: 'Egresos', icon: MinusCircle, color: 'bg-rose-500' },
  { id: 'BAJA_MERCADERIA', label: 'Bajas/Pérdidas', icon: Trash2, color: 'bg-orange-500' },
  { id: 'PRICE_CHANGE', label: 'Cambios de Precio', icon: Tag, color: 'bg-blue-500' },
  { id: 'FINANCIERO', label: 'Ajuste Financiero', icon: DollarSign, color: 'bg-indigo-500' },
  { id: 'AJUSTE_MANUAL', label: 'Ajustes Manuales', icon: ClipboardCheck, color: 'bg-slate-500' },
  { id: 'ANULACION', label: 'Anulaciones', icon: RotateCcw, color: 'bg-slate-400' },
  { id: 'VARIANT_CREATED', label: 'Altas de Variante', icon: PackagePlus, color: 'bg-teal-500' },
];

interface InventoryHistoryProps {
  movements: any[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  loadMore?: () => void;
  error: string | null;
  annulSession?: (session: { evento_id?: string | null; movements: any[] }) => Promise<boolean>;
}

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
  const [selectedMovement, setSelectedMovement] = useState<any | null>(null);
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

        // Determine movement type using the centralized resolveMovementKey
        const mType = resolveMovementKey(m);

        // Apply type filter: PRICE_CHANGE also matches FINANCIERO filter for backward compat
        if (filterType !== 'all') {
          if (mType === 'PRICE_CHANGE') {
            if (filterType !== 'PRICE_CHANGE' && filterType !== 'FINANCIERO') return false;
          } else if (mType !== filterType) {
            return false;
          }
        }

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

        return matchesSearch && matchesDate;
      });
    } catch (e) {
      console.error("Error filtering movements:", e);
      return [];
    }
  }, [movements, searchTerm, filterType, dateFilter, appliedCustomDates]);

  const handleAnnul = async (e: React.MouseEvent, movement: any) => {
    e.stopPropagation();
    if (!annulSession) return;

    if (!window.confirm(
      `¿Estás seguro de que deseas anular este movimiento?\n` +
      `Esta acción no se puede deshacer.`
    )) return;

    setIsAnnulling(movement.id);
    try {
      await annulSession({
        evento_id: movement.event_id ?? movement.evento_id ?? null,
        movements: [movement],
      });
    } finally {
      setIsAnnulling(null);
    }
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

      {/* Movement List View */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="h-24 bg-slate-50 rounded-[2rem] animate-pulse border border-slate-100" />
          ))
        ) : filteredMovements.length > 0 ? (
          filteredMovements.map((m, idx) => (
            <AuditLogRow
              key={m.id || idx}
              movement={m}
              onSelect={setSelectedMovement}
              onAnnul={handleAnnul}
              isAnnullingId={isAnnulling}
              canAnnulSession={!!annulSession}
            />
          ))
        ) : (
          <div className="col-span-full p-16 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <History className="text-slate-200 mx-auto mb-4" size={48} />
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
        {selectedMovement && (() => {
          const modalVariantKey = resolveMovementKey(selectedMovement);
          const modalVariant = MOVEMENT_VARIANTS[modalVariantKey] ?? FALLBACK_VARIANT;
          const { operator } = parseMovementDetails(selectedMovement);
          const amount = selectedMovement.change_amount || selectedMovement.quantity || 0;
          const isPositive = amount > 0;
          const name = selectedMovement.product_name?.trim() || selectedMovement.base_product_name || selectedMovement.product || selectedMovement.inventory_items?.products?.name || 'Producto';
          const sku = selectedMovement.sku || 'N/A';
          const color = typeof selectedMovement.color === 'string' ? selectedMovement.color : (selectedMovement.color?.name || selectedMovement.color?.value || '-');
          
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedMovement(null)}
                className="absolute inset-0 bg-on-surface/40 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden"
              >
                <div className={`h-3 w-full ${modalVariant.bgClass}`} />
                <div className="p-10">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${modalVariant.badgeClass} mb-3 inline-block`}>
                        {modalVariant.label}
                      </span>
                      <h2 className="text-3xl font-black text-on-surface uppercase leading-tight font-headline">
                        {name}
                      </h2>
                    </div>
                    <button 
                      onClick={() => setSelectedMovement(null)}
                      className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-colors"
                    >
                      <ChevronRight size={24} className="rotate-90" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Cantidad</p>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${modalVariant.bgClass}`}>
                          {isPositive ? <ArrowUpRight size={18} className={modalVariant.textClass} /> : <ArrowDownLeft size={18} className={modalVariant.textClass} />}
                        </div>
                        <p className={`text-3xl font-black italic tracking-tighter ${modalVariant.textClass}`}>
                          {selectedMovement.type === 'financiero' ? 'OK' : `${isPositive ? '+' : ''}${amount}`}
                        </p>
                      </div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">SKU / Código</p>
                      <div className="flex items-center gap-3">
                        <Tag size={20} className="text-primary" />
                        <p className="text-xl font-black text-on-surface">{sku}</p>
                      </div>
                    </div>
                  </div>

                  {selectedMovement.size || color !== '-' ? (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Variante</p>
                      <p className="font-bold text-on-surface">{selectedMovement.size || 'ÚNICA'} · {color}</p>
                    </div>
                  ) : null}

                  <div className="space-y-6">
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                        <Calendar size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Fecha y Hora</p>
                        <p className="font-black text-on-surface uppercase">
                          {new Date(selectedMovement.created_at).toLocaleString('es-AR', { 
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
                            const details = parseMovementDetails(selectedMovement);
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
                    
                    {(selectedMovement.evento_id || selectedMovement.payload_json) && (
                      <div className="flex items-start gap-5 mt-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                          <Settings size={24} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Detalles de Evento</p>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 overflow-x-auto">
                            {selectedMovement.evento_id && (
                              <p className="font-black text-on-surface uppercase text-xs mb-2">
                                <span className="text-slate-400">ID Evento:</span> {selectedMovement.evento_id}
                              </p>
                            )}
                            {selectedMovement.payload_json && (
                              <div className="mt-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Payload JSON</p>
                                <pre className="text-[10px] text-slate-500 overflow-x-auto whitespace-pre-wrap font-mono bg-white p-2 rounded border border-slate-100">
                                  {(() => {
                                    try {
                                      return JSON.stringify(JSON.parse(selectedMovement.payload_json), null, 2);
                                    } catch (e) {
                                      return selectedMovement.payload_json;
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
                    onClick={() => setSelectedMovement(null)}
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
