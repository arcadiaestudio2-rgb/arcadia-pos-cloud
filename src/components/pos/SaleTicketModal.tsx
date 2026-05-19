import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, X, CheckCircle2, Share2, Download } from 'lucide-react';
import { SaleTicket } from '../history/SaleTicket';

interface SaleTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  saleData: {
    sale: any;
    items: any[];
  } | null;
}

export const SaleTicketModal: React.FC<SaleTicketModalProps> = ({ isOpen, onClose, saleData }) => {
  if (!saleData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const sale = saleData.sale;
    const items = saleData.items;
    
    let message = `*ARCADIA POS - Ticket #${sale.id}*\n`;
    message += `📅 ${new Date(sale.created_at || Date.now()).toLocaleString()}\n\n`;
    message += `*Detalle:*\n`;
    
    items.forEach(item => {
      message += `• ${item.name || item.variant_id} x${item.quantity} - $${item.price?.toLocaleString() || item.price_at_sale?.toLocaleString()}\n`;
    });
    
    message += `\n*TOTAL: $${sale.total?.toLocaleString()}*\n`;
    message += `💳 Métodos: ${sale.payment_method || 'Varios'}\n\n`;
    message += `¡Gracias por tu compra! ✨`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleSave = () => {
    // Basic implementation: download as text file if PDF is not available
    const sale = saleData.sale;
    const items = saleData.items;
    let content = `ARCADIA POS - Ticket #${sale.id}\n`;
    content += `Fecha: ${new Date(sale.created_at || Date.now()).toLocaleString()}\n\n`;
    items.forEach(item => {
      content += `${item.name} x${item.quantity} - $${item.price || item.price_at_sale}\n`;
    });
    content += `\nTOTAL: $${sale.total}\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket_${sale.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header / Success Indicator */}
            <div className="bg-emerald-500 p-6 text-white flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-3"
              >
                <CheckCircle2 size={32} />
              </motion.div>
              <h2 className="text-xl font-bold">¡Venta Exitosa!</h2>
              <p className="text-white/80 text-sm">La transacción se ha completado correctamente.</p>
              
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Ticket Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50 flex flex-col items-center">
              <div className="bg-white shadow-lg rounded-sm transform transition-transform hover:scale-[1.01] duration-300">
                <SaleTicket sale={saleData.sale} items={saleData.items} />
              </div>
              
              <div className="mt-6 flex flex-wrap justify-center gap-3 no-print">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  <Printer size={20} />
                  Imprimir
                </button>
                
                <button
                  onClick={handleWhatsApp}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  <Share2 size={20} />
                  WhatsApp
                </button>
                
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-100 active:scale-95 transition-all"
                >
                  <Download size={20} />
                  Guardar
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-100 flex justify-center">
              <button
                onClick={onClose}
                className="text-slate-400 font-medium hover:text-slate-600 transition-colors"
              >
                Cerrar ventana
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
