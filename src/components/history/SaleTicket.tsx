import React from 'react';
import { formatDate, formatCurrency } from '../../utils/format';

interface SaleTicketProps {
  sale: any;
  items: any[];
}

export function SaleTicket({ sale, items }: SaleTicketProps) {
  if (!sale) return null;

  return (
    <div className="print-ticket bg-white text-black p-4 font-mono text-[12px] leading-tight w-[80mm] mx-auto">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print-ticket, .print-ticket * { visibility: visible; }
          .print-ticket { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
          }
          @page { size: auto; margin: 0mm; }
        }
      `}} />
      
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold uppercase tracking-[0.2em] mb-1">ARCADIA</h1>
        <p className="text-[10px] uppercase font-bold text-gray-600">Indumentaria & Calzado</p>
        <div className="border-b border-black border-dashed my-3" />
        <p className="font-bold text-sm">TICKET DE VENTA #{sale.id}</p>
        <p className="text-[10px]">{formatDate(sale.timestamp)}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-4 text-[11px]">
        <p><strong>Terminal:</strong> {sale.terminal || 'Caja 01'}</p>
        <p className="text-right"><strong>Op:</strong> {sale.seller}</p>
        <p className="col-span-2"><strong>Cliente:</strong> {sale.customer || 'Consumidor Final'}</p>
      </div>

      <div className="border-b border-black border-dashed mb-2" />
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between font-bold text-[10px] uppercase">
          <span>Descripción</span>
          <span>Total</span>
        </div>
        {items.map((item, idx) => (
          <div key={idx} className="space-y-0.5">
            <div className="flex justify-between">
              <span className="uppercase">{item.name}</span>
              <span>{formatCurrency(item.price * item.qty)}</span>
            </div>
            <div className="text-[10px] text-gray-600">
              {item.qty} x {formatCurrency(item.price)} [{item.color} / {item.size}]
            </div>
          </div>
        ))}
      </div>

      <div className="border-b border-black border-dashed mb-2" />

      <div className="space-y-1">
        <div className="flex justify-between text-base font-bold">
          <span>TOTAL</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>
        
        {sale.payment_details && (
           <div className="text-[10px] uppercase mt-2 space-y-0.5">
              {sale.payment_details.cash > 0 && (
                <div className="flex justify-between">
                  <span>Efectivo:</span>
                  <span>{formatCurrency(sale.payment_details.cash)}</span>
                </div>
              )}
              {sale.payment_details.debit > 0 && (
                <div className="flex justify-between">
                  <span>Débito/Transf:</span>
                  <span>{formatCurrency(sale.payment_details.debit)}</span>
                </div>
              )}
              {sale.payment_details.credit > 0 && (
                <div className="flex justify-between">
                  <span>Crédito Tienda:</span>
                  <span>{formatCurrency(sale.payment_details.credit)}</span>
                </div>
              )}
           </div>
        )}
      </div>

      <div className="border-b border-black border-dashed my-4" />

      <div className="text-center text-[10px] space-y-1 italic">
        <p>¡Gracias por tu compra!</p>
        <p>Cambios con ticket dentro de los 30 días.</p>
        <p>www.arcadia.com.ar</p>
      </div>
    </div>
  );
}
