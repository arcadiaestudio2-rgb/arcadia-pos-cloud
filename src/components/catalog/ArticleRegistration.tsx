import { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Tag, 
  Truck, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Calculator, 
  Percent, 
  DollarSign,
  Smartphone,
  FileText,
  User,
  Save,
  X,
  Info,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import { Button, toast } from '../common/CommonUI';
import { useOperator } from '../../hooks/useOperator';
import { calculatePVP, calculateMargin } from '../../utils/pricing';
import { normalizeAttributeValue, sanitizeNumericSize } from '../../utils/validation';

interface VariantRow {
  id: string;
  sku: string;
  color: string;
  size: string;
  stock: number;
  stockMinimo: number;
  cost: number;
  margin: number;
  pvp: number;
}

const STEPS = [
  { id: 'identity', label: 'Identidad', icon: Tag },
  { id: 'economics', label: 'Economía', icon: DollarSign },
  { id: 'variants', label: 'Variantes', icon: Package },
  { id: 'review', label: 'Confirmación', icon: CheckCircle2 }
];


export const ArticleRegistration = ({ onClose }: { onClose: () => void }) => {
  const { isOperatorSelected, operatorName } = useOperator();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Form State
  const [productName, setProductName] = useState('');
  const sessionSuffix = useMemo(() => Math.random().toString(36).substring(2, 6).toUpperCase(), []);
  const [categoryId, setCategoryId] = useState('General');
  const [brand, setBrand] = useState('');
  const [season, setSeason] = useState('');
  const [barcode, setBarcode] = useState('');
  
  // Economics State
  const [baseCost, setBaseCost] = useState(0);
  const [baseMargin, setBaseMargin] = useState(50);
  const [ivaRate, setIvaRate] = useState(21);
  const [baseStockMin, setBaseStockMin] = useState(5);
  const [baseDebitPrice, setBaseDebitPrice] = useState(0);
  const [baseCreditPrice, setBaseCreditPrice] = useState(0);

  // Variants State
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [currentSizeType, setCurrentSizeType] = useState<'alpha' | 'numeric' | 'none'>('alpha');
  const [variants, setVariants] = useState<VariantRow[]>([]);

  // Provider State
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchSupplier, setSearchSupplier] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [providerName, setProviderName] = useState('');
  const [providerCuit, setProviderCuit] = useState('');
  const [providerPhone, setProviderPhone] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [showProvider, setShowProvider] = useState(false);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

  // New Supplier form state
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCuit, setNewSupplierCuit] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');

  // Catalog Attributes
  const [dbAttributes, setDbAttributes] = useState<any>(() => {
    const saved = localStorage.getItem('arcadia_catalog_attributes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      categories: ['Remeras', 'Pantalones', 'Abrigos', 'Accesorios', 'General'],
      alpha: ['S', 'M', 'L', 'XL', 'XXL'],
      numeric: ['38', '40', '42', '44', '46'],
      colors: ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo'],
      seasons: ['INV 24', 'VER 24', 'CONT', 'PRE-FA']
    };
  });

  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');

  // Debounced barcode lookup — only fires when barcode looks complete (≥13 chars EAN-13)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (barcode && barcode.length >= 13) { // EAN-13 standard length
        try {
          const existingProduct = await api.getProductByBarcode(barcode);
          if (existingProduct) {
            setProductName(existingProduct.name || '');
            setCategoryId(existingProduct.category || '');
            setBrand(existingProduct.brand || '');
            setSeason(existingProduct.season || '');
          }
        } catch (error) {
          console.error("Error searching barcode:", error);
        } finally {
        }
      }
    }, 800); // 800ms debounce to avoid firing mid-type

    return () => clearTimeout(timer);
  }, [barcode]);

  const loadAttributes = async () => {
    const saved = localStorage.getItem('arcadia_catalog_attributes');
    if (saved) {
      try {
        setDbAttributes(JSON.parse(saved));
      } catch (e) {}
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await api.getSuppliers();
      if (data && Array.isArray(data)) {
        setSuppliers(data);
      }
    } catch (e) {
      console.error("Error loading suppliers", e);
    }
  };

  useEffect(() => {
    loadAttributes();
    loadSuppliers();
  }, []);

  const suggestedPVP = useMemo(() => calculatePVP(baseCost, baseMargin, ivaRate), [baseCost, baseMargin, ivaRate]);

  // Handle PVP change to update margin
  const handleBasePVPChange = (newPVP: number) => {
    const newMargin = calculateMargin(baseCost, newPVP, ivaRate);
    setBaseMargin(Math.round(newMargin));
  };

  // Matrix Generation logic
  useEffect(() => {
    if ((selectedSizes.length === 0 && currentSizeType !== 'none') || selectedColors.length === 0) {
      setVariants([]); 
      return;
    }

    // Identificar qué pares color-talle necesitamos
    const pairs: { color: string, size: string }[] = [];
    selectedColors.forEach(color => {
      const sizesToProcess = currentSizeType === 'none' ? ['U'] : selectedSizes;
      sizesToProcess.forEach(size => {
        pairs.push({ color, size });
      });
    });

    // Construir la nueva lista de variantes preservando datos pero actualizando SKU
    const newVariants: VariantRow[] = [];
    
    for (const pair of pairs) {
      const existing = variants.find(v => v.color === pair.color && v.size === pair.size);

      // Siempre recalcular el SKU con la categoría actual
      const rubroId = (categoryId || 'GEN').substring(0, 3).toUpperCase().padEnd(3, 'X');
      const colorId = (pair.color || 'XXX').substring(0, 3).toUpperCase().padEnd(3, 'X');
      const talleId = pair.size || 'UNI';
      // Reusar el sufijo aleatorio existente para mantener identidad, o generar uno nuevo
      const existingSuffix = existing?.sku?.split('-')[3];
      const shortId = (existingSuffix && existingSuffix.length === 4)
        ? existingSuffix
        : Math.random().toString(36).substring(2, 6).toUpperCase();
      const generatedSku = `${rubroId}-${colorId}-${talleId}-${shortId}`;

      if (existing) {
        // Preservar datos de precios/stock pero actualizar el SKU con prefijo correcto
        newVariants.push({ ...existing, sku: generatedSku });
      } else {
        newVariants.push({
          id: `new-${Date.now()}-${pair.color}-${pair.size}`,
          sku: generatedSku,
          color: pair.color,
          size: pair.size,
          stock: 0,
          stockMinimo: baseStockMin,
          cost: baseCost,
          margin: baseMargin,
          pvp: suggestedPVP
        });
      }
    }

    setVariants(newVariants);
  }, [selectedSizes, selectedColors, currentSizeType, categoryId, sessionSuffix, baseStockMin, baseCost, baseMargin, suggestedPVP]);

  const filteredSuppliers = useMemo(() => {
    if (!searchSupplier) return suppliers;
    const q = searchSupplier.toLowerCase();
    return suppliers.filter(s => 
      s.name?.toLowerCase().includes(q) || 
      s.cuit?.toLowerCase().includes(q)
    );
  }, [searchSupplier, suppliers]);

  const handleCreateNewSupplier = async () => {
    if (!newSupplierName) return;
    try {
      const created = await api.createSupplier({
        name: newSupplierName,
        cuit: newSupplierCuit,
        phone: newSupplierPhone
      });
      toast.success("Proveedor creado con éxito");
      setNewSupplierName('');
      setNewSupplierCuit('');
      setNewSupplierPhone('');
      setSelectedSupplierId(created.id);
      setProviderName(created.name);
      setProviderCuit(created.cuit || '');
      setProviderPhone(created.phone || '');
      setSearchSupplier(created.name);
      setSuppliers(prev => [...prev, created]);
      setIsSupplierDropdownOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Error al crear proveedor");
    }
  };

  const handleSave = async () => {
    if (!isOperatorSelected) {
      toast.error("Seleccioná tu nombre para operar");
      return;
    }

    if (!productName || !categoryId || !brand || !season) {
      toast.error("Completá los campos obligatorios de Identidad");
      setCurrentStep(0);
      return;
    }

    if (variants.length === 0) {
      toast.error("Debes configurar al menos una variante");
      setCurrentStep(2);
      return;
    }

    setLoading(true);
    try {
      if (showProvider && selectedSupplierId) {
        await api.updateSupplier(selectedSupplierId, {
          name: providerName,
          cuit: providerCuit,
          phone: providerPhone
        });
      }

      const payload = {
        name: productName,
        category: categoryId,
        brand,
        season,
        barcode: barcode || `BC-${Date.now()}`,
        ivaRate: ivaRate,
        priceCash: Number(variants[0]?.pvp || suggestedPVP || 0),
        priceDebit: Number(baseDebitPrice || variants[0]?.pvp || suggestedPVP || 0),
        priceCredit: Number(baseCreditPrice || variants[0]?.pvp || suggestedPVP || 0),
        cost: baseCost,
        baseMargin: baseMargin,
        stockMinimo: baseStockMin,
        operator: operatorName,
        providerInfo: showProvider ? {
          name: providerName,
          cuit: providerCuit,
          phone: providerPhone,
          invoice_number: invoiceNumber,
          manual_prices: {
            efectivo: Number(variants[0]?.pvp || suggestedPVP || 0),
            debito: Number(baseDebitPrice) || Number(variants[0]?.pvp || suggestedPVP || 0),
            credito: Number(baseCreditPrice) || Number(variants[0]?.pvp || suggestedPVP || 0)
          }
        } : {
          manual_prices: {
            efectivo: Number(variants[0]?.pvp || suggestedPVP || 0),
            debito: Number(baseDebitPrice) || Number(variants[0]?.pvp || suggestedPVP || 0),
            credito: Number(baseCreditPrice) || Number(variants[0]?.pvp || suggestedPVP || 0)
          }
        },
        variants: variants.map(v => ({
          sku: v.sku, 
          size: v.size,
          color: v.color,
          stock: Number(v.stock),
          stockMinimo: Number(v.stockMinimo) || 0,
          cost: Number(v.cost),
          margin: Number(v.margin),
          priceCash: Number(v.pvp),
          priceDebit: Number(baseDebitPrice || v.pvp),
          priceCredit: Number(baseCreditPrice || v.pvp)
        }))
      };

      await api.createProduct(payload);
      toast.success(`${productName} registrado con éxito`);
      window.dispatchEvent(new CustomEvent('refresh-stock'));
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Error al registrar el producto");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.ctrlKey && e.key === 'Enter') {
        if (currentStep === STEPS.length - 1) handleSave();
        else nextStep();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, variants]);

  const handleSeasonChange = (val: string) => {
    if (val === 'NEW_SEASON') {
      setIsSeasonModalOpen(true);
    } else {
      setSeason(val);
    }
  };

  const handleAddNewSeason = async () => {
    if (!newSeasonName.trim()) return;
    
    const name = newSeasonName.trim().toUpperCase();
    
    // Check for duplicates
    const exists = dbAttributes.seasons?.some((s: string) => s.toUpperCase() === name);
    
    if (exists) {
      setSeason(name);
      setIsSeasonModalOpen(false);
      setNewSeasonName('');
      toast.info(`La temporada "${name}" ya existe. Seleccionada.`);
      return;
    }

    try {
      setLoading(true);
      await api.addCatalogAttribute('seasons', name);
      await loadAttributes();
      setSeason(name);
      setIsSeasonModalOpen(false);
      setNewSeasonName('');
      toast.success(`Temporada ${name} añadida`);
    } catch (e: any) {
      toast.error(e.message || "Error al añadir temporada");
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'identity':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre del Producto *</label>
                <input 
                  type="text" 
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="Ej: Remera Over Blue"
                  className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rubro / Categoría *</label>
                <select 
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none shadow-sm"
                >
                  {dbAttributes.categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Marca *</label>
                  <input 
                    type="text" 
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                    placeholder="Ej: Arcadia"
                    className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Temporada *</label>
                  <select 
                    value={season}
                    onChange={e => handleSeasonChange(e.target.value)}
                    className="w-full bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none shadow-sm"
                  >
                    <option value="">Seleccionar...</option>
                    {dbAttributes.seasons?.map((s: string) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="NEW_SEASON" className="text-primary font-black">+ Agregar Nueva...</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
               <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Código de Barras (Opcional)</label>
                <input 
                  type="text" 
                  value={barcode}
                  onChange={e => setBarcode(e.target.value)}
                  placeholder="Scanner ready..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-mono font-bold outline-none"
                />
              </div>

              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Truck size={16} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700">Proveedor del Producto</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="assign-provider-toggle"
                      type="checkbox"
                      checked={showProvider}
                      onChange={(e) => {
                        setShowProvider(e.target.checked);
                        if (!e.target.checked) {
                          setSearchSupplier('');
                          setProviderName('');
                          setProviderCuit('');
                          setProviderPhone('');
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-200 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="assign-provider-toggle" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                      Asignar proveedor
                    </label>
                  </div>
                </div>
                
                <AnimatePresence>
                  {showProvider && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-visible mt-6 space-y-6"
                    >
                      {/* Subsection A: Seleccionar proveedor existente */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                          <span className="text-xs font-bold text-slate-700">Buscar proveedor existente</span>
                        </div>
                        <div className="relative">
                          <input 
                            type="text" 
                            placeholder="Buscar proveedor por nombre o CUIT..."
                            value={searchSupplier}
                            onChange={e => {
                              setSearchSupplier(e.target.value);
                              setIsSupplierDropdownOpen(true);
                            }}
                            onFocus={() => setIsSupplierDropdownOpen(true)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                          />
                          {isSupplierDropdownOpen && filteredSuppliers.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-2 space-y-1">
                              {filteredSuppliers.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSupplierId(s.id);
                                    setSearchSupplier(s.name);
                                    setProviderName(s.name);
                                    setProviderCuit(s.cuit || '');
                                    setProviderPhone(s.phone || '');
                                    setIsSupplierDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-lg font-bold transition-colors"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-slate-800">{s.name}</span>
                                    {s.cuit && <span className="text-slate-400 text-[10px]">CUIT: {s.cuit}</span>}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {isSupplierDropdownOpen && (
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setIsSupplierDropdownOpen(false)} 
                            />
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Nombre / Razón social</label>
                            <input 
                              type="text" 
                              value={providerName}
                              onChange={e => setProviderName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">CUIT</label>
                              <input 
                                type="text" 
                                value={providerCuit}
                                onChange={e => setProviderCuit(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Teléfono</label>
                              <input 
                                type="text" 
                                value={providerPhone}
                                onChange={e => setProviderPhone(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Subsection B: Crear nuevo proveedor */}
                      <div className="space-y-3 border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-tertiary"></div>
                          <span className="text-xs font-bold text-slate-700">O crear un proveedor nuevo</span>
                        </div>
                        <input 
                          type="text" 
                          placeholder="Nombre del nuevo proveedor"
                          value={newSupplierName}
                          onChange={e => setNewSupplierName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input 
                            type="text" 
                            placeholder="CUIT del nuevo proveedor"
                            value={newSupplierCuit}
                            onChange={e => setNewSupplierCuit(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                          />
                          <input 
                            type="text" 
                            placeholder="Teléfono del nuevo proveedor"
                            value={newSupplierPhone}
                            onChange={e => setNewSupplierPhone(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleCreateNewSupplier}
                          disabled={!newSupplierName}
                          className="w-full py-3 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                        >
                          <Plus size={14} />
                          <span>Guardar nuevo proveedor</span>
                        </button>
                      </div>

                      {/* Remito */}
                      <div className="border-t border-slate-100 pt-4">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Número de remito</label>
                        <input 
                          type="text" 
                          placeholder="Ej: 0001-00004321"
                          value={invoiceNumber}
                          onChange={e => setInvoiceNumber(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        );

      case 'economics':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Estructura de Costos</label>
                <div className="flex items-center gap-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-xl shadow-slate-200/50">
                  <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30">
                    <DollarSign size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo Unitario (Base)</p>
                    <input 
                      type="number" 
                      value={baseCost}
                      onChange={e => setBaseCost(Number(e.target.value))}
                      className="w-full text-3xl font-black font-headline tracking-tighter text-on-surface outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 rounded-3xl p-6">
                  <div className="flex items-center gap-2 text-slate-400 mb-4">
                    <Percent size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Margen (%)</span>
                  </div>
                  <input 
                    type="number" 
                    value={baseMargin}
                    onChange={e => setBaseMargin(Number(e.target.value))}
                    className="w-full text-2xl font-black font-headline tracking-tighter text-on-surface outline-none"
                  />
                </div>
                <div className="bg-white border border-slate-100 rounded-3xl p-6">
                  <div className="flex items-center gap-2 text-slate-400 mb-4">
                    <Info size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">IVA (%)</span>
                  </div>
                  <select 
                    value={ivaRate}
                    onChange={e => setIvaRate(Number(e.target.value))}
                    className="w-full text-2xl font-black font-headline tracking-tighter text-on-surface outline-none appearance-none"
                  >
                    <option value={21}>21%</option>
                    <option value={10.5}>10.5%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center items-center p-10 bg-gradient-to-br from-[#0F172A] to-[#1E293B] rounded-[3rem] border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 blur-[60px] -z-10" />
              
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Estructura de Precios</p>
              
              <div className="w-full space-y-4">
                {/* Master Price (Cash) */}
                <div className="bg-primary/10 rounded-2xl p-6 border-2 border-primary/20 ring-1 ring-primary/5 group/price">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[9px] font-black text-primary/60 uppercase tracking-widest">Efectivo (Cash)</label>
                    <span className="text-[8px] font-black bg-primary text-white px-2 py-0.5 rounded-full uppercase">Principal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black text-primary/40 italic">$</span>
                    <input 
                      type="number"
                      value={suggestedPVP || ''}
                      onChange={e => handleBasePVPChange(Number(e.target.value))}
                      className="text-5xl w-full font-black font-headline tracking-tighter text-white bg-transparent outline-none italic placeholder:text-slate-800"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Second Row: Debit & Credit */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/50 hover:border-slate-700 transition-all group/price">
                    <label className="text-[9px] font-black text-slate-500 block mb-2 group-hover/price:text-slate-400 transition-colors uppercase tracking-widest">Débito</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-black text-slate-700">$</span>
                      <input 
                        type="number"
                        className="bg-transparent text-xl font-black text-white outline-none w-full placeholder:text-slate-800"
                        placeholder="0"
                        value={baseDebitPrice || ''}
                        onChange={(e) => setBaseDebitPrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/50 hover:border-slate-700 transition-all group/price">
                    <label className="text-[9px] font-black text-slate-500 block mb-2 group-hover/price:text-slate-400 transition-colors uppercase tracking-widest">Crédito</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg font-black text-slate-700">$</span>
                      <input 
                        type="number"
                        className="bg-transparent text-xl font-black text-white outline-none w-full placeholder:text-slate-800"
                        placeholder="0"
                        value={baseCreditPrice || ''}
                        onChange={(e) => setBaseCreditPrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-4 items-center">
                <button 
                  onClick={() => {
                    const cash = suggestedPVP;
                    setBaseDebitPrice(Math.round(cash * 1.10)); // 10%
                    setBaseCreditPrice(Math.round(cash * 1.15)); // 15%
                    toast.success('Sugerencias aplicadas');
                  }}
                  className="flex items-center gap-2 text-[9px] font-black text-slate-500 tracking-widest hover:text-primary transition-all bg-slate-900/50 px-4 py-2.5 rounded-xl border border-slate-800"
                >
                  <Calculator size={12} />
                  SUGERIR PRECIOS
                </button>
                <div className="flex items-center gap-2 text-slate-500">
                  <Info size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">IVA INCLUIDO</span>
                </div>
              </div>
              
              <div className="mt-8 p-6 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-slate-800 w-full">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Stock Mínimo Global</label>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                    <AlertCircle size={18} />
                  </div>
                  <input 
                    type="number" 
                    value={baseStockMin}
                    onChange={e => setBaseStockMin(Number(e.target.value))}
                    className="flex-1 bg-transparent text-xl font-black text-white outline-none"
                  />
                </div>
              </div>
            </div>

          </div>
        );

      case 'variants':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Type Selection */}
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Curva de Talles</label>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button 
                      onClick={() => setCurrentSizeType('alpha')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentSizeType === 'alpha' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Letras
                    </button>
                    <button 
                      onClick={() => setCurrentSizeType('numeric')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentSizeType === 'numeric' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Números
                    </button>
                    <button 
                      onClick={() => setCurrentSizeType('none')}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentSizeType === 'none' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      Único
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {currentSizeType !== 'none' && dbAttributes[currentSizeType].map((size: string) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                      className={`px-4 py-3 rounded-xl text-xs font-bold transition-all border ${selectedSizes.includes(size) ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}
                    >
                      {size}
                    </button>
                  ))}
                  {currentSizeType === 'none' && (
                    <div className="px-6 py-4 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-dashed border-slate-200">
                      Talle Único Seleccionado
                    </div>
                  )}
                </div>

                {/* Manual size input */}
                <div className="flex gap-2 mt-3 w-full">
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="Talle personalizado..."
                    className="flex-1 h-10 bg-slate-50 border-none rounded-xl px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = sanitizeNumericSize(e.currentTarget.value);
                        if (val) {
                          const normalized = normalizeAttributeValue(val);
                          const exists = dbAttributes[currentSizeType]?.some(
                            (v: string) => normalizeAttributeValue(v) === normalized
                          );
                          if (!exists) {
                            const updated = {
                              ...dbAttributes,
                              [currentSizeType]: [...(dbAttributes[currentSizeType] || []), val],
                            };
                            setDbAttributes(updated);
                            localStorage.setItem(
                              'arcadia_catalog_attributes',
                              JSON.stringify(updated)
                            );
                          }
                          setSelectedSizes((prev) =>
                            prev.includes(val) ? prev : [...prev, val]
                          );
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.target as HTMLElement)
                        .closest('.flex')
                        ?.querySelector('input');
                      if (!input) return;
                      const val = sanitizeNumericSize(input.value);
                      if (val) {
                        const normalized = normalizeAttributeValue(val);
                        const exists = dbAttributes[currentSizeType]?.some(
                          (v: string) => normalizeAttributeValue(v) === normalized
                        );
                        if (!exists) {
                          const updated = {
                            ...dbAttributes,
                            [currentSizeType]:
                              [...(dbAttributes[currentSizeType] || []), val],
                          };
                          setDbAttributes(updated);
                          localStorage.setItem(
                            'arcadia_catalog_attributes',
                            JSON.stringify(updated)
                          );
                        }
                        setSelectedSizes((prev) =>
                          prev.includes(val) ? prev : [...prev, val]
                        );
                        input.value = '';
                      }
                    }}
                    className="h-10 px-4 bg-primary text-white text-[10px] font-black uppercase rounded-xl hover:bg-primary-dark transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Color Selection */}
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Colores Disponibles</label>
                <div className="flex flex-wrap gap-3">
                  {dbAttributes.colors.map((color: string) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color])}
                      className={`group relative pl-4 pr-6 py-3 rounded-2xl text-xs font-bold transition-all border flex items-center gap-3 ${selectedColors.includes(color) ? 'bg-on-surface border-on-surface text-white' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}
                    >
                      <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: color.toLowerCase() === 'blanco' ? '#fff' : color.toLowerCase() === 'negro' ? '#000' : color.toLowerCase() }} />
                      {color}
                      {selectedColors.includes(color) && <CheckCircle2 size={12} className="text-tertiary-fixed" />}
                    </button>
                  ))}
                  <button 
                    className="p-3 rounded-2xl border border-dashed border-slate-200 text-slate-400 hover:text-primary hover:border-primary transition-all"
                    onClick={() => {
                      const newColor = prompt("Nombre del color:");
                      if (newColor) {
                        const rawColor = newColor.trim();
                        const normalized = normalizeAttributeValue(rawColor);

                        setDbAttributes((prev: any) => {
                          const exists = (prev.colors || []).some(
                            (c: string) => normalizeAttributeValue(c) === normalized
                          );
                          if (exists) {
                            toast.info(`"${rawColor}" ya existe`);
                            return prev;
                          }
                          const updated = {
                            ...prev,
                            colors: [...(prev.colors || []), rawColor],
                          };
                          localStorage.setItem(
                            'arcadia_catalog_attributes',
                            JSON.stringify(updated)
                          );
                          toast.success(`${rawColor} agregado`);
                          return updated;
                        });
                      }
                    }}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black tracking-tighter uppercase text-slate-800 flex items-center gap-3">
                <Package className="text-primary" size={24} /> Matriz de Inventario
              </h3>
            </div>
            {/* Matrix View */}
            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Variante</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU GEN</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Margen %</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">PVP</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Mínimo</th>
                    <th className="px-6 py-5 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {variants.map((v, idx) => (
                    <tr key={v.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[9px] font-black text-slate-500">
                            {v.size}
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 truncate max-w-[80px]">{v.color}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          value={v.sku}
                          readOnly
                          className="bg-transparent text-[10px] font-mono font-bold text-slate-400 cursor-not-allowed w-32"
                          title="El SKU se auto-genera internamente"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          value={v.cost}
                          onChange={e => {
                            const next = [...variants];
                            const newCost = Number(e.target.value);
                            next[idx].cost = newCost;
                            next[idx].pvp = calculatePVP(newCost, next[idx].margin, ivaRate);
                            setVariants(next);
                          }}
                          className="w-16 bg-slate-100/50 rounded-lg px-2 py-1.5 text-[11px] font-black text-on-surface outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          value={v.margin}
                          onChange={e => {
                            const next = [...variants];
                            const newMargin = Number(e.target.value);
                            next[idx].margin = newMargin;
                            next[idx].pvp = calculatePVP(next[idx].cost, newMargin, ivaRate);
                            setVariants(next);
                          }}
                          className="w-14 bg-slate-100/50 rounded-lg px-2 py-1.5 text-[11px] font-black text-on-surface outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          value={v.pvp}
                          onChange={e => {
                            const next = [...variants];
                            const newPVP = Number(e.target.value);
                            next[idx].pvp = newPVP;
                            next[idx].margin = Math.round(calculateMargin(next[idx].cost, newPVP, ivaRate));
                            setVariants(next);
                          }}
                          className="w-20 bg-primary/5 rounded-lg px-2 py-1.5 text-[11px] font-black text-primary outline-none"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          value={v.stock}
                          onChange={e => {
                            const next = [...variants];
                            next[idx].stock = Number(e.target.value);
                            setVariants(next);
                          }}
                          className="w-14 bg-slate-100/50 rounded-lg px-2 py-1.5 text-[11px] font-black text-on-surface outline-none text-center"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          value={v.stockMinimo}
                          onChange={(e) => {
                            const next = [...variants];
                            next[idx].stockMinimo = Number(e.target.value);
                            setVariants(next);
                          }}
                          className="w-14 bg-error/5 rounded-lg px-2 py-1.5 text-[11px] font-black text-error outline-none text-center"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setVariants(prev => prev.filter(item => item.id !== v.id))}
                          className="text-slate-300 hover:text-error transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {variants.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 text-slate-300">
                          <Package size={48} className="opacity-20" />
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">Configurá talles y colores para generar la matriz</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 border-b border-slate-50 pb-4">Resumen del Artículo</h3>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Modelo</p>
                    <h4 className="text-2xl font-black font-headline tracking-tighter text-on-surface">{productName}</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Marca / Rubro</p>
                      <p className="text-xs font-bold text-slate-600">{brand} • {categoryId}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Temporada</p>
                      <p className="text-xs font-bold text-slate-600">{season}</p>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-slate-50">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4">Finanzas</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo</p>
                        <p className="text-sm font-black text-slate-700">${baseCost.toLocaleString()}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Margen</p>
                        <p className="text-sm font-black text-slate-700">{baseMargin}%</p>
                      </div>
                      <div className="p-4 bg-tertiary/5 rounded-2xl">
                        <p className="text-[8px] font-black text-tertiary uppercase tracking-widest mb-1">PVP</p>
                        <p className="text-sm font-black text-tertiary">${suggestedPVP.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {providerName && (
                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Package size={64} className="text-primary" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Proveedor Enlazado</h3>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-primary">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-on-surface uppercase">{providerName}</h4>
                      <p className="text-[10px] font-bold text-slate-400">CUIT: {providerCuit || 'No especificado'}</p>
                    </div>
                  </div>
                  {providerPhone && (
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
                      <div className="flex items-center gap-3">
                        <Smartphone size={14} className="text-primary" />
                        <span className="text-[10px] font-black uppercase text-primary">{providerPhone}</span>
                      </div>
                    <span className="text-[8px] font-black uppercase text-primary/40 tracking-widest">WhatsApp Configurado</span>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-[#0F172A] text-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-900/20 flex flex-col relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-tertiary/10 rounded-full blur-[80px] pointer-events-none" />
                
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-8 relative z-10">Estructura de Variantes</h3>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[350px] custom-scrollbar relative z-10">
                  {variants.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 group hover:border-white/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xs font-black text-white/90">
                          {v.size}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{v.color}</p>
                          <p className="text-xs font-mono font-bold text-primary">{v.sku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Stock Inicial</p>
                        <p className="text-sm font-black text-white">{v.stock} <span className="text-[10px] opacity-40">unid.</span></p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-8 pt-8 border-t border-white/5 relative z-10">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/30">
                    <span>Total Unidades</span>
                    <span className="text-white text-lg">{variants.reduce((acc, v) => acc + Number(v.stock), 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-on-surface text-white rounded-[2.5rem] p-8 shadow-2xl shadow-on-surface/30 flex flex-col">
              <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">Total Unidades</p>
                  <p className="text-2xl font-black font-headline tracking-tighter">{variants.reduce((acc, v) => acc + v.stock, 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">Operador</p>
                  <div className="flex items-center gap-2 justify-end">
                    <User size={12} className="text-primary" />
                    <p className="text-xs font-black uppercase">{operatorName}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-6xl h-[90vh] bg-slate-50 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/20"
      >
        {/* Header */}
        <header className="px-12 py-8 bg-white border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Package size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black font-headline tracking-tighter text-on-surface italic uppercase">
                Alta de <span className="text-primary">Artículos</span>
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="px-2 py-0.5 bg-slate-100 text-[8px] font-black text-slate-500 rounded uppercase tracking-widest">v3.0 Maestro</span>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Info size={10} />
                  <span className="text-[9px] font-bold uppercase tracking-widest italic">Wizard Multi-Paso</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Step Indicator */}
          <div className="hidden lg:flex items-center gap-10">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center gap-4 relative">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${idx <= currentStep ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 text-slate-300'}`}>
                  <step.icon size={18} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${idx <= currentStep ? 'text-primary' : 'text-slate-300'}`}>Paso 0{idx + 1}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${idx <= currentStep ? 'text-on-surface' : 'text-slate-300'}`}>{step.label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                   <div className={`w-8 h-px ${idx < currentStep ? 'bg-primary' : 'bg-slate-100'} ml-4`} />
                )}
              </div>
            ))}
          </div>

          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:text-error hover:bg-error/5 transition-all flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-12 py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="px-12 py-8 bg-white border-t border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User size={12} className="text-primary" />
              Sesión de: <span className="text-on-surface">{operatorName || 'SIN SELECCIONAR'}</span>
            </div>
            <div className="w-px h-4 bg-slate-100" />
            <div className="text-[10px] font-bold text-slate-300 italic">
              Esc para cancelar • Ctrl + Enter para avanzar
            </div>
          </div>

          <div className="flex items-center gap-4">
            {currentStep > 0 && (
              <button 
                onClick={prevStep}
                className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-on-surface transition-all flex items-center gap-2"
              >
                <ChevronLeft size={14} />
                Atrás
              </button>
            )}
            
            {currentStep < STEPS.length - 1 ? (
              <Button 
                onClick={nextStep}
                className="!px-10 !py-5"
                disabled={currentStep === 0 && (!productName || !categoryId || !brand || !season)}
              >
                Continuar
                <ChevronRight size={16} />
              </Button>
            ) : (
              <Button 
                onClick={handleSave}
                variant="tertiary"
                className="!px-12 !py-5"
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Confirmar y Registrar'}
                <Save size={16} />
              </Button>
            )}
          </div>
        </footer>
      </motion.div>

      {/* Add Season Modal */}
      <AnimatePresence>
        {isSeasonModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Package size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-on-surface">Nueva Temporada</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Añadir al catálogo</p>
                    </div>
                  </div>
                  <button onClick={() => setIsSeasonModalOpen(false)} className="w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre de Temporada</label>
                    <input 
                      autoFocus
                      type="text" 
                      value={newSeasonName}
                      onChange={e => setNewSeasonName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddNewSeason()}
                      placeholder="Ej: VERANO 2025"
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => setIsSeasonModalOpen(false)}
                    className="flex-1 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-on-surface transition-all"
                  >
                    Cancelar
                  </button>
                  <Button 
                    onClick={handleAddNewSeason}
                    disabled={!newSeasonName.trim() || loading}
                    className="flex-1"
                  >
                    {loading ? 'Añadiendo...' : 'Añadir Temporada'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
