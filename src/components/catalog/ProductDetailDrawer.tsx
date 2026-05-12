import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Shirt,
  LayoutGrid,
  DollarSign,
  List,
  TrendingUp,
  Banknote,
  CreditCard,
  Plus
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, compareSizes } from '../../utils/format';

interface ProductDetailDrawerProps {
  product: any;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (product: any) => void;
}

type TabType = 'STOCK' | 'FINANZAS' | 'PRODUCTO';

export function ProductDetailDrawer({ product, isOpen, onClose, onEdit }: ProductDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('STOCK');
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      setLoading(true);
      api.getProductVariants(product.id)
        .then(setVariants)
        .catch(err => console.error('Error loading variants:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const colors = Array.from(new Set(variants.map(v => v.color)));
  const sizes = Array.from(new Set(variants.map(v => v.size))).sort(compareSizes);

  const getVariant = (color: string, size: string) => {
    return variants.find(v => v.color === color && v.size === size);
  };

  const totalStock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
  
  const unitsOptimo = variants.filter(v => v.stock > 5).reduce((acc, v) => acc + v.stock, 0);
  const unitsBajo = variants.filter(v => v.stock > 0 && v.stock <= 5).reduce((acc, v) => acc + v.stock, 0);
  const variantsCritico = variants.filter(v => v.stock <= 0).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }}>
          {/* Backdrop with extreme blur to match reference */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.15)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
          />

          {/* Side Panel with precise dimensions from request */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 220 }}
            style={{ 
              position: 'relative', 
              zIndex: 1001, 
              height: '100%', 
              width: '100%', 
              maxWidth: '520px', 
              backgroundColor: '#ffffff', 
              boxShadow: '-20px 0 60px rgba(0,0,0,0.1)', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden',
              borderTopLeftRadius: '32px',
              borderBottomLeftRadius: '32px'
            }}
          >
            {/* Header Section - Exactly like Image 4 */}
            <div style={{ padding: '40px 32px 24px 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ 
                  width: '64px', height: '64px', borderRadius: '20px', backgroundColor: '#f1f5f9', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' 
                }}>
                  <Shirt size={32} strokeWidth={1.5} />
                </div>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#1a1a2e', letterSpacing: '-0.02em', margin: 0 }}>{product.name}</h2>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '8px 0 0 0' }}>
                    <span style={{ color: '#3b82f6' }}>+</span> {product.category || 'GENERAL'} <span style={{ opacity: 0.3, margin: '0 4px' }}>•</span> {product.barcode || 'SKU-0000'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                 <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '10px', fontWeight: 900, color: '#8892a4', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0' }}>Stock Total</p>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: '6px' }}>
                      <span style={{ fontSize: '42px', fontWeight: 900, color: '#1a1a2e', lineHeight: 1, letterSpacing: '-0.04em' }}>{totalStock}</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#8892a4', marginBottom: '6px' }}>u.</span>
                    </div>
                 </div>
                 <button 
                  onClick={onClose}
                  style={{ 
                    width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    borderRadius: '12px', backgroundColor: '#f8fafc', color: '#94a3b8', border: '1px solid #f1f5f9', cursor: 'pointer'
                  }}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Tabs Navigation - Line Style */}
            <div style={{ padding: '0 32px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', gap: '40px', borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
                {(['STOCK', 'FINANZAS', 'PRODUCTO'] as TabType[]).map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{ 
                        position: 'relative', paddingBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', 
                        fontSize: '12px', fontWeight: 900, letterSpacing: '0.05em', border: 'none', background: 'none', cursor: 'pointer',
                        color: isActive ? '#1a1a2e' : '#94a3b8', transition: 'color 0.2s'
                      }}
                    >
                      {tab}
                      {isActive && (
                        <motion.div 
                          layoutId="activeTabIndicator"
                          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', backgroundColor: '#3b82f6', borderRadius: '4px' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 48px 32px' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {activeTab === 'STOCK' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      {/* Summary Cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                         <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 900, color: '#15803d', textTransform: 'uppercase' }}>Óptimo</span>
                            <span style={{ fontSize: '32px', fontWeight: 900, color: '#166534', lineHeight: 1 }}>{unitsOptimo}</span>
                         </div>
                         <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 900, color: '#b45309', textTransform: 'uppercase' }}>Bajo</span>
                            <span style={{ fontSize: '32px', fontWeight: 900, color: '#92400e', lineHeight: 1 }}>{unitsBajo}</span>
                         </div>
                         <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 900, color: '#b91c1c', textTransform: 'uppercase' }}>Crítico</span>
                            <span style={{ fontSize: '32px', fontWeight: 900, color: '#991b1b', lineHeight: 1 }}>{variantsCritico}</span>
                         </div>
                      </div>

                      {/* Matrix View */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h4 style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Existencias por Variante</h4>
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                <th style={{ padding: '20px 24px', textAlign: 'left', fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Color / Talle</th>
                                {sizes.map(size => (
                                  <th key={size} style={{ padding: '20px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>{size}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {colors.map((color, idx) => (
                                <tr key={color} style={{ borderBottom: '1px solid #f8fafc' }}>
                                  <td style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: ['#1e3a5f', '#1a1a2e', '#e53e3e', '#38a169'][idx % 4] }} />
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e' }}>{color}</span>
                                  </td>
                                  {sizes.map(size => {
                                    const variant = getVariant(color, size);
                                    const stockVal = variant?.stock || 0;
                                    
                                    let bg = '#f8fafc';
                                    let fg = '#cbd5e1';
                                    if (stockVal > 5) { bg = '#f0fdf4'; fg = '#22c55e'; }
                                    else if (stockVal > 0) { bg = '#fffbeb'; fg = '#f59e0b'; }
                                    else if (stockVal <= 0) { bg = '#fef2f2'; fg = '#ef4444'; }

                                    return (
                                      <td key={size} style={{ padding: '20px 8px', textAlign: 'center' }}>
                                        <div style={{ 
                                          width: '48px', height: '48px', margin: '0 auto', borderRadius: '16px', 
                                          backgroundColor: bg, color: fg, display: 'flex', flexDirection: 'column', 
                                          alignItems: 'center', justifyContent: 'center', gap: '2px', fontWeight: 900
                                        }}>
                                          <span style={{ fontSize: '16px' }}>{stockVal}</span>
                                          <span style={{ fontSize: '9px', opacity: 0.7 }}>u.</span>
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Add Button */}
                      <button 
                        onClick={() => onEdit(product)}
                        style={{ 
                          width: '100%', padding: '20px', border: '2px dashed #e2e8f0', borderRadius: '16px', 
                          backgroundColor: '#ffffff', color: '#94a3b8', fontSize: '12px', fontWeight: 900, cursor: 'pointer'
                        }}
                      >
                        + AGREGAR VARIANTE O AJUSTAR STOCK
                      </button>
                    </div>
                  )}

                  {activeTab === 'FINANZAS' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <TrendingUp size={20} color="#3b82f6" />
                          <h3 style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Precios de Venta</h3>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '32px', display: 'flex', alignItems: 'center', gap: '24px' }}>
                          <div style={{ width: '64px', height: '64px', borderRadius: '18px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                            <Banknote size={32} />
                          </div>
                          <div>
                            <p style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Efectivo</p>
                            <p style={{ fontSize: '42px', fontWeight: 900, color: '#1a1a2e', margin: 0 }}>{formatCurrency(product.price_cash || 0)}</p>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          <div style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <CreditCard size={24} color="#3b82f6" />
                            <div>
                              <p style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Débito</p>
                              <p style={{ fontSize: '28px', fontWeight: 900, color: '#1a1a2e', margin: 0 }}>{formatCurrency(product.price_debit || 0)}</p>
                            </div>
                          </div>
                          <div style={{ backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <CreditCard size={24} color="#8b5cf6" />
                            <div>
                              <p style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Crédito</p>
                              <p style={{ fontSize: '28px', fontWeight: 900, color: '#1a1a2e', margin: 0 }}>{formatCurrency(product.price_credit || 0)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'PRODUCTO' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Nombre</label>
                          <div style={{ padding: '20px', backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '16px', fontWeight: 900 }}>{product.name}</div>
                       </div>
                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Marca</label>
                            <div style={{ padding: '20px', backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '16px', fontWeight: 700 }}>{product.brand || '---'}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Categoría</label>
                            <div style={{ padding: '20px', backgroundColor: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '16px', fontWeight: 700 }}>{product.category || '---'}</div>
                          </div>
                       </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc', fontSize: '10px', fontWeight: 900, color: '#cbd5e1', letterSpacing: '0.2em' }}>
              INJECTED STYLE V5.0 • {new Date().toLocaleTimeString()}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
