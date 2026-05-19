import React from 'react';
import { 
  X, 
  Trash2, 
  Play, 
  Clock, 
  User as UserIcon,
  ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency } from '../common/CommonUI';
import { PendingOrder } from '../../types/cart';

interface PendingOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PendingOrder[];
  onResume: (order: PendingOrder) => void;
  onRemove: (id: string) => void;
}

export const PendingOrdersModal: React.FC<PendingOrdersModalProps> = ({
  isOpen,
  onClose,
  orders,
  onResume,
  onRemove
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border-2 border-on-surface flex flex-col max-h-[80vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b-2 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-on-surface text-white rounded-lg flex items-center justify-center">
                  <Clock size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Órdenes en Espera</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recuperar ventas pausadas</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                  <ShoppingBag size={48} strokeWidth={1} className="mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">No hay órdenes pausadas</p>
                </div>
              ) : (
                orders.map((order) => (
                  <div 
                    key={order.id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-slate-50 border-2 border-slate-100 rounded-xl hover:border-on-surface/20 transition-all group"
                  >
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                      <div className="w-12 h-12 bg-white rounded-lg border-2 border-slate-200 flex items-center justify-center text-slate-400 font-black text-xs">
                        {order.cart.length}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <UserIcon size={12} className="text-slate-400" />
                          <span className="text-sm font-black text-on-surface">
                            {order.customer?.full_name || 'Consumidor Final'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-primary">{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => onRemove(order.id)}
                        className="flex-1 md:flex-none h-11 px-4 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border-2 border-transparent"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => onResume(order)}
                        className="flex-[2] md:flex-none h-11 px-6 bg-on-surface text-white rounded-lg flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                      >
                        <Play size={14} fill="currentColor" />
                        Reanudar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-slate-50 border-t-2 border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Las órdenes en espera se guardan temporalmente en esta sesión
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
