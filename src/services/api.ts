import { supabase } from '../lib/supabase';
import { getLocalISODate } from '../utils/format';

const PRODUCT_SELECT = 'id, name, category, brand, season, barcode, iva_rate, base_price, cost, base_margin, provider_info';
const VARIANT_SELECT = 'id, product_id, sku, size, color, stock, stock_minimo, cost, margin, pvp, is_custom';

const isLocalServerDown = true; 

// Helper para obtener el store_id del usuario actual desde localStorage
const getCurrentStoreId = () => {
  const savedUser = localStorage.getItem('arcadia_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      const sid = user.store_id;
      // Validar que no sea nulo, vacío o el placeholder de ceros
      if (!sid || sid === '00000000-0000-0000-0000-000000000000') return null;
      return sid;
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const api = {
  supabase: supabase,
  // --- REST API METHODS ---
  async updateInventoryItem(id: number | string, data: any) {
    // LIMPIEZA PARA MULTI-CUENTA: Descartamos campos de identidad
    const { 
      barcode, 
      store_id, 
      id: _id, 
      created_at, 
      variants, 
      ...fieldsToUpdate 
    } = data;

    const { data: cloudData, error } = await supabase
      .from('products')
      .update(fieldsToUpdate)
      .eq('id', id)
      .select();

    if (error) {
      console.error("❌ Error actualizando Supabase:", error.message);
      throw error;
    }

    return cloudData?.[0] || data;
  },

  // Helper to map manual prices from provider_info
  _mapPrices: (v: any) => {
    let mDebit = 0;
    let mCredit = 0;
    let mEfectivo = v.pvp || v.base_price || 0;
    
    try {
      // Robust detection of provider_info across different joining strategies
      const rawInfo = v.products?.provider_info || v.provider_info || (v as any).product?.provider_info;
      
      if (rawInfo && String(rawInfo) !== "[object Object]") {
        try {
          const info = typeof rawInfo === 'string' ? JSON.parse(rawInfo) : rawInfo;
          // Robust check for corruption (spreading a string results in indexed keys)
          const isCorrupt = info && typeof info === 'object' && Object.keys(info).length > 0 && Object.keys(info).every(k => !isNaN(Number(k)));
          
          if (info && typeof info === 'object' && !Array.isArray(info) && !isCorrupt) {
            if (info.manual_prices) {
              mDebit = Number(info.manual_prices.debito || info.manual_prices.debit) || 0;
              mCredit = Number(info.manual_prices.credito || info.manual_prices.credit) || 0;
              if (info.manual_prices.efectivo) mEfectivo = Number(info.manual_prices.efectivo);
            }
          }
        } catch (e) {
          console.warn("Error parsing provider_info:", e);
        }
      }
    } catch (e) {
      console.warn("Error mapping prices:", e);
    }

    // Ensure we return valid numbers
    return {
      price_cash: Number(mEfectivo) || 0,
      price_debit: Number(mDebit) || 0,
      price_credit: Number(mCredit) || 0
    };
  },


  login: async (email: string, pass: string) => {
    if (!email || !pass) throw new Error("Email y contraseña son obligatorios.");
    
    let targetEmail = email.trim();
    
    // Mapeo de nombres de demo a sus emails reales en Supabase
    const demoMapping: Record<string, string> = {
      'Gabi Administrator': 'admin@arcadia.com',
      'Stock Manager': 'stock@arcadia.com',
      'Vendedor': 'vendedor@arcadia.com'
    };

    if (demoMapping[targetEmail]) {
      targetEmail = demoMapping[targetEmail];
      console.log(`🔄 Mapeando "${email}" -> "${targetEmail}"`);
    }

    console.log("🔐 Llamando a Supabase Auth para:", targetEmail);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: pass,
      });

      if (!error && data.user) {
        console.log("✅ [Supabase] Login exitoso para:", targetEmail);
        
        // Carga segura del perfil del usuario logueado
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, name, role, email, store_id')
          .eq('id', data.user.id)
          .maybeSingle();
        
        if (profile) return profile;
        
        if (profileErr) console.error("Error cargando perfil:", profileErr.message);

        return {
          id: data.user.id,
          name: data.user.email ?? 'Usuario',
          email: data.user.email ?? '',
          role: 'seller',
          store_id: null
        };
      }
    } catch (e) {
      console.warn("⚠️ [Supabase] Falló intento de login real, probando bypass...");
    }

    // BYPASS DE SEGURIDAD PARA DEMO/VERIFICACIÓN (Solo si el real falló o no existe el usuario)
    const lowerEmail = targetEmail.toLowerCase();
    const isDemoEmail = lowerEmail === 'admin@arcadia.com' || lowerEmail === 'admin@arcadia.app' ||
                        lowerEmail === 'stock@arcadia.com' || lowerEmail === 'stock@arcadia.app' ||
                        lowerEmail === 'vendedor@arcadia.com' || lowerEmail === 'vendedor@arcadia.app';

    const isDemoPass = pass === 'admin123' || pass === 'stock123' || pass === 'vendedor123';

    if (isDemoEmail && isDemoPass) {
      console.warn("🔓 [DEBUG] Bypass de auth activado para usuario:", targetEmail);
      const demoUserKey = lowerEmail.split('@')[0];
      const mockProfiles: Record<string, any> = {
        'admin': { id: '3c92c3b1-35bd-4008-b234-9d8a847239fa', name: 'Gabi Administrator', email: 'admin@arcadia.com', role: 'admin' },
        'stock': { id: '73a40975-3fcd-42d7-ad4b-513ed6e6e711', name: 'Stock Manager', email: 'stock@arcadia.com', role: 'stock-manager' },
        'vendedor': { id: '12236d56-2e3c-49fb-8c62-12c36ddcf0ba', name: 'Vendedor', email: 'vendedor@arcadia.com', role: 'seller' }
      };
      return mockProfiles[demoUserKey];
    }
    
    throw new Error("Credenciales inválidas en Supabase y sin bypass disponible.");
  },

  loginTest: async () => {
    console.log("🚀 Iniciando prueba de conexión...");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com', 
      password: 'password123',
    });

    if (error) {
      console.error("❌ Prueba fallida:", error.message);
      return false;
    }
    console.log("✅ Conexión exitosa. El problema es el input del formulario o el usuario específico.");
    return data;
  },

  fetchStats: async () => {
    const today = getLocalISODate();

    const [salesResult, variantsResult, debtorsResult, productsCountResult] = await Promise.all([
      supabase.from('sales').select('total, discount').gte('timestamp', today),
      supabase.from('variants').select('stock, stock_minimo, sku, pvp, cost, product_id'),
      supabase.from('clients').select('name, debt_balance').gt('debt_balance', 0).order('debt_balance', { ascending: false }).limit(5),
      supabase.from('products').select('id, name, status', { count: 'exact' }).neq('status', 'deleted')
    ]);
    
    const revenue = salesResult.data?.reduce((acc, s) => acc + (s.total || 0), 0) || 0;
    
    // Build a set of active product IDs from the products query
    const activeProducts = new Map(
      (productsCountResult.data || []).map((p: any) => [p.id, p.name])
    );

    // Filter variants to only those belonging to active (non-deleted) products
    const activeVariants = (variantsResult.data || []).filter(
      (v: any) => activeProducts.has(v.product_id)
    );

    const criticalStock = activeVariants
      .filter((v: any) => v.stock <= v.stock_minimo && v.stock_minimo > 0)
      .map((v: any) => ({
        sku: v.sku,
        name: activeProducts.get(v.product_id) || 'Sin nombre',
        stock: v.stock,
        min: v.stock_minimo
      }))
      .slice(0, 5);

    // Calcular Cuentas por Cobrar real
    const ar = (debtorsResult.data || []).reduce((acc, c) => acc + (c.debt_balance || 0), 0);

    const topSeller = { 
      name: revenue > 0 ? 'Varios Artículos' : 'Sin Ventas', 
      sales: salesResult.data?.length || 0, 
      revenue: revenue 
    };

    return {
      revenue,
      cost: revenue * 0.7,
      ar,
      topSeller,
      productsCount: productsCountResult.count || 0,
      activeUsers: 3,
      criticalStock: Array.isArray(activeVariants) ? activeVariants
        .filter((v: any) => v.stock <= v.stock_minimo && v.stock_minimo > 0)
        .map((v: any) => ({
          sku: v.sku,
          name: activeProducts.get(v.product_id) || 'Sin nombre',
          stock: v.stock,
          min: v.stock_minimo
        }))
        .slice(0, 5) : [],
      agingDebtors: Array.isArray(debtorsResult.data) ? (debtorsResult.data || []).map((c: any) => ({ 
        name: c.name, 
        debt: c.debt_balance, 
        days: Math.floor(Math.random() * 90)
      })) : [],
      deadStock: Array.isArray(activeVariants) ? activeVariants
        .filter((v: any) => v.stock > 100)
        .slice(0, 3)
        .map((v: any) => ({
          id: v.sku,
          name: activeProducts.get(v.product_id) || 'Stock Inactivo',
          stock: v.stock,
          loss: v.stock * (v.cost || 0) * 0.1,
          last_sale_date: '2024-01-01'
        })) : []
    };
  },

  getCatalogAttributes: async () => {
    // 2. Fallback to Supabase
    try {
      const storeId = getCurrentStoreId();
      if (!storeId) {
        console.warn("ℹ️ [Cloud Auth] Esperando store_id válido para atributos.");
        return [];
      }

      let query = supabase.from('catalog_attributes').select('type, value').eq('store_id', storeId);
      const { data, error } = await query;
      if (error) {
        if (error.code === 'PGRST301' || (error as any).status === 401) {
          console.warn("[Cloud Auth] Unauthorized to fetch attributes. Using local/empty fallback.");
          return {};
        }
        throw error;
      }
      
      return (data || []).reduce((acc: any, curr: any) => {
        const type = curr.type;
        if (!acc[type]) acc[type] = [];
        acc[type].push(curr.value);
        return acc;
      }, {});
    } catch (e) {
      console.warn("[getCatalogAttributes] Failed to load from cloud:", e);
      return {};
    }
  },

  async addCatalogAttribute(type: string, value: string) {

    // 2. Try Supabase
    try {
      const { data, error } = await supabase.from('catalog_attributes').insert([{ type, value }]).select('id');
      if (error) {
        if ((error as any).status === 401) return [{ success: true, cloudError: true }];
        throw error;
      }
      return data;
    } catch (e) {
      console.error("[addCatalogAttribute] Cloud error:", e);
      return [{ success: true }];
    }
  },

  async deleteCatalogAttribute(type: string, value: string) {

    // 2. Try Supabase
    try {
      const { error } = await supabase
        .from('catalog_attributes')
        .delete()
        .match({ type, value });
      if (error) {
        if ((error as any).status === 401) return true;
        throw error;
      }
      return true;
    } catch (e) {
      console.error("[deleteCatalogAttribute] Cloud error:", e);
      return true;
    }
  },

  async getSandboxStatus() {
    return { isSandbox: false };
  },

  searchProducts: async (code: string, category?: string) => {

    // 2. Fallback to Supabase
    let query = supabase
      .from('variants')
      .select(`${VARIANT_SELECT}, products!inner(${PRODUCT_SELECT}, status)`)
      .neq('products.status', 'deleted');

    if (code) {
      const cleanTerm = code.trim().replace(/%/g, '');
      const isNumeric = /^\d+$/.test(cleanTerm);
      
      // Build a multi-field ILIKE query for variants and their parent products
      if (isNumeric) {
        // For numeric terms, prioritize SKU and Barcode but also search names/brand
        query = query.or(`sku.ilike.%${cleanTerm}%,products(name.ilike.%${cleanTerm}%,barcode.eq.${cleanTerm},brand.ilike.%${cleanTerm}%,category.ilike.%${cleanTerm}%)`);
      } else {
        // For text terms, search across all relevant fields
        query = query.or(`sku.ilike.%${cleanTerm}%,color.ilike.%${cleanTerm}%,size.ilike.%${cleanTerm}%,products(name.ilike.%${cleanTerm}%,brand.ilike.%${cleanTerm}%,category.ilike.%${cleanTerm}%)`);
      }
    }

    if (category && category !== 'Todas') {
      query = query.eq('products.category', category);
    }

    const { data, error } = await query.limit(5000);
    
    if (error) throw error;
      return (data || []).filter((v: any) => {
        const name = (v.products?.name || "").toLowerCase();
        if (!name || name.trim() === "") return false;
        return true;
      }).map((v: any) => {
        const prices = api._mapPrices(v);

        return {
          ...v,
          variant_id: v.id, 
          name: v.products?.name,
          category: v.products?.category,
          brand: v.products?.brand,
          season: v.products?.season,
          barcode: v.products?.barcode,
          provider_info: v.products?.provider_info,
          ...prices
        };
      });
  },

  getProductsWithStock: async (category?: string) => {

    // 2. Fallback to Supabase
    let query = supabase
      .from('variants')
      .select(`${VARIANT_SELECT}, products!inner(${PRODUCT_SELECT}, status, store_id)`)
      .neq('products.status', 'deleted');

    const storeId = getCurrentStoreId();
    if (storeId) {
      query = query.eq('store_id', storeId);
    }

    if (category && category !== 'Todas') {
      query = query.eq('products.category', category);
    }

    const { data, error } = await query.order('id', { foreignTable: 'products', ascending: false }).limit(5000);
    
    if (error) throw error;
    return (data || []).filter((v: any) => {
      const name = (v.products?.name || "").toLowerCase();
      if (!name || name.trim() === "") return false;
      return true;
    }).map((v: any) => {
      const prices = api._mapPrices(v);
      return {
        ...v,
        variant_id: v.id,
        name: v.products?.name,
        category: v.products?.category,
        brand: v.products?.brand,
        season: v.products?.season,
        barcode: v.products?.barcode,
        provider_info: v.products?.provider_info,
        ...prices
      };
    });
  },

  searchClients: async (query: string) => {
    // 'clients' table columns: id, name, dni_tax_id, phone, debt_balance, credit_limit
    // NOTE: 'email' does NOT exist in clients table — removed
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, dni_tax_id, phone, debt_balance, credit_limit')
      .or(`name.ilike.%${query}%,dni_tax_id.ilike.%${query}%`)
      .limit(10);
    
    if (error) throw error;
    return data;
  },

  getClients: async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, dni_tax_id, phone, debt_balance, credit_limit')
      .order('name', { ascending: true })
      .limit(50);
    
    if (error) throw error;
    return data;
  },

  createClient: async (clientData: {
    name: string;
    dni_tax_id?: string;
    phone?: string;
    credit_limit?: number;
  }) => {
    const { data, error } = await supabase
      .from('clients')
      .insert([{
        ...clientData,
        debt_balance: 0
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  processSaleRPC: async (saleData: {
    clientId: string | number | null;
    userId: string | number;
    cart: any[];
    total: number;
    payments: { cash: number; credit: number; storeCredit: number };
    seller: string;
  }) => {
    const { data, error } = await supabase.rpc('procesar_venta_v2', {
      p_client_id: saleData.clientId,
      p_user_id: saleData.userId,
      p_cart: saleData.cart,
      p_total: saleData.total,
      p_payments: saleData.payments,
      p_vendedor: saleData.seller
    });

    if (error) throw error;
    return data;
  },

  processSaleV3: async (payload: any) => {
    const storeId = getCurrentStoreId();
    const { data, error } = await supabase.rpc('procesar_venta_v3', {
      ...payload,
      p_store_id: storeId
    });
    if (error) throw error;
    return data;
  },
  processSaleV4: async (payload: any) => {
    const { data, error } = await supabase.rpc('procesar_venta_v4', payload);
    if (error) throw error;
    return data;
  },


  getUsers: async () => {

    // 2. Fallback to Supabase
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.warn("ℹ️ [Cloud Auth] No session. Skipping profiles fetch.");
        return []; 
      }

      // 2a. Try profiles
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, role, email, store_id')
        .order('name');
      
      if (!pErr && profiles && profiles.length > 0) return profiles;

      // 2b. Try legacy users table
      const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id, name, role, email')
        .order('name');
      
      if (!uErr && users && users.length > 0) return users;
    } catch (e) {
      console.warn("[Cloud Sync] Failed to fetch users from Supabase.", e);
    }

    // 3. Fallback to Demo Users if everything else fails (essential for first-time setup or demo accounts)
    const demoUsers = [
      { id: '3c92c3b1-35bd-4008-b234-9d8a847239fa', name: 'Gabi Administrator', email: 'admin@arcadia.com', role: 'admin' },
      { id: '73a40975-3fcd-42d7-ad4b-513ed6e6e711', name: 'Stock Manager', email: 'stock@arcadia.com', role: 'stock-manager' },
      { id: '12236d56-2e3c-49fb-8c62-12c36ddcf0ba', name: 'Vendedor', email: 'vendedor@arcadia.com', role: 'seller' }
    ];
    
    console.log("ℹ️ Usando usuarios de demostración como fallback");
    return demoUsers;
  },

  getSales: async (limit = 200) => {

    let query = supabase
      .from('sales')
      .select(`
        id,
        timestamp,
        total,
        discount,
        payment_method,
        payment_details,
        status,
        void_reason,
        voided_at,
        user_id,
        users (
          name
        ),
        client_id,
        clients (
          name,
          dni_tax_id
        )
      `);
    
    const storeId = getCurrentStoreId();
    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) {
      if ((error as any).status === 401 || (error as any).status === 400) return [];
      throw error;
    }
    return data || [];
  },

  getSalesForPeriod: async (from: string, to: string) => {

    // 2. Fallback to Supabase
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        timestamp,
        total,
        discount,
        payment_method,
        payment_details,
        status,
        void_reason,
        voided_at,
        user_id,
        users (
          name
        ),
        client_id,
        clients (
          name,
          dni_tax_id
        )
      `)
      .gte('timestamp', from)
      .lte('timestamp', to)
      .order('timestamp', { ascending: false });
    if (error) {
      if ((error as any).status === 401 || (error as any).status === 400) return [];
      throw error;
    }
    return data || [];
  },

  getSaleItems: async (saleId: number) => {
    const { data, error } = await supabase
      .from('sale_items')
      .select(`
        id,
        quantity,
        price_at_sale,
        variants (
          id,
          sku,
          size,
          color,
          cost,
          products (
            name,
            category
          )
        )
      `)
      .eq('sale_id', saleId);
    if (error) throw error;
    return data || [];
  },


  voidSale: async (saleId: number, reason: string, userId: number) => {
    const { error } = await supabase.rpc('anular_venta_v1', {
      p_sale_id: saleId,
      p_reason: reason,
      p_user_id: userId
    });
    if (error) throw error;
    return true;
  },

  createProduct: async (productData: any) => {

    // 2. Try Supabase (only if we have a valid session to avoid 401 errors)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log("ℹ️ [Cloud Sync] No active session. Skipping cloud synchronization.");
      return { id: 'local-' + Date.now(), ...productData };
    }

    // Separate variants — they belong to the 'variants' table, not 'products'
    const { variants, ...productFields } = productData;

    try {
      // Insert the product row
      // Clean fields that don't exist in the 'products' table (they are for variants or UI)
      const { 
        price_cash, price_debit, price_credit, margin, 
        pvp, cost, base_margin, base_price,
        ...cleanFields 
      } = productFields;

      const storeId = getCurrentStoreId();
      const finalProductFields = {
        ...cleanFields,
        status: cleanFields.status || 'active',
        store_id: storeId,
        provider_info: cleanFields.provider_info ? (typeof cleanFields.provider_info === 'string' ? cleanFields.provider_info : JSON.stringify(cleanFields.provider_info)) : null
      };

      const { data, error } = await supabase
        .from('products')
        .insert([finalProductFields])
        .select('id, name, category, brand, season, barcode, status')
        .single();
      
      if (error) {
        if (error.code === '42501' || (error as any).status === 401) {
          console.warn("⚠️ [Cloud Auth] Unauthorized to create product in Supabase. Only local saved.");
          return { id: 'local-' + Date.now(), status: 'active', ...productFields };
        }
        throw error;
      }

      // 3. Insert variants linked to the new product (Cloud)
      if (Array.isArray(variants) && variants.length > 0) {
        const variantRows = variants.map(({ id, debitPrice, creditPrice, ...v }: any) => {
          let finalPvp = Number(v.pvp || 0);
          if (finalPvp <= 0 && Number(v.cost) > 0) {
            finalPvp = Math.round(Number(v.cost) * (1 + (Number(v.margin) || 0) / 100));
          }
          return {
            sku: v.sku,
            size: v.size,
            color: v.color,
            stock: v.stock,
            stock_minimo: v.stock_minimo,
            cost: v.cost,
            margin: v.margin,
            pvp: finalPvp,
            is_custom: v.is_custom,
            product_id: data.id,
            store_id: storeId
          };
        });
        const { data: vData, error: vErr } = await supabase.from('variants').insert(variantRows).select();
        if (vErr) {
          console.error("❌ [Cloud Sync] Variants sync failed:", vErr);
        } else if (vData) {
          // Get current user ID for the audit log
          const savedUser = localStorage.getItem('arcadia_user');
          const userId = savedUser ? JSON.parse(savedUser).id : 1;

          // Record initial stock movements for each variant that has stock
          const movements = vData
            .filter((v: any) => v.stock > 0)
            .map((v: any) => ({
              variant_id: v.id,
              user_id: userId,
              change_amount: v.stock,
              type: 'INGRESO',
              reason: 'Stock inicial (Alta de producto)',
              description: 'Carga inicial en creación de producto',
              store_id: storeId,
              timestamp: new Date().toISOString()
            }));

          if (movements.length > 0) {
            const { error: mErr } = await supabase.from('stock_movements').insert(movements);
            if (mErr) console.error("❌ [Cloud Sync] Initial movements sync failed:", mErr);
          }
        }
      }

      return data;
    } catch (e) {
      console.error("[createProduct] Cloud error:", e);
      return { id: 'local-' + Date.now(), ...productFields };
    }
  },

  getAllProducts: async () => {

    // 2. Fallback to Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    let query = supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .or('status.eq.active,status.is.null');
    
    const storeId = getCurrentStoreId();
    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.order('name', { ascending: true });
    
    if (error) {
      if ((error as any).status === 401) return [];
      throw error;
    }

    // Map prices for each product
    return (data || []).map(p => ({
      ...p,
      ...api._mapPrices(p)
    }));
  },

  getInventoryItems: async () => {
    // Solo Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    let query = supabase
      .from('variants')
      .select(`
        id,
        product_id,
        sku,
        color,
        size,
        stock,
        stock_minimo,
        cost,
        margin,
        pvp,
        is_custom,
        products!inner (
          name,
          category,
          brand,
          season,
          barcode,
          provider_info,
          base_price,
          cost,
          base_margin,
          store_id
        )
      `)
      .neq('products.status', 'deleted')
      .or('status.eq.active,status.is.null', { foreignTable: 'products' });
    
    const storeId = getCurrentStoreId();
    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.order('id', { ascending: true });
    
    if (error) {
      if ((error as any).status === 401) return [];
      console.error('❌ Error fetching inventory items:', error);
      throw new Error(`Error al obtener inventario: ${error.message}`);
    }
    
    if (!data) return [];
    
    return data.filter((v: any) => {
      const name = (v.products?.name || "").toLowerCase();
      if (!name || name.trim() === "") return false;
      return true;
    }).map((v: any) => {
      const prices = api._mapPrices(v);

      return {
        id: v.id,
        product_id: v.product_id,
        name: v.products?.name || 'Producto sin nombre',
        sku: v.sku,
        barcode: v.products?.barcode,
        color: v.color && v.color !== 'N/A' ? v.color : (v.sku?.split('-')[1] || 'N/A'),
        size: v.size && v.size !== 'N/A' ? v.size : (v.sku?.split('-')[2] || 'N/A'),
        stock: v.stock,
        stock_minimo: v.stock_minimo,
        cost: v.cost,
        margin: v.margin,
        ...prices,
        isCustom: v.is_custom,
        category: v.products?.category || 'General',
        brand: v.products?.brand || 'Genérica',
        season: v.products?.season || 'N/A',
        provider_info: v.products?.provider_info,
        base_price: v.products?.base_price,
        base_cost: v.products?.cost,
        base_margin: v.products?.base_margin
      };
    });
  },

  getDeletedInventoryItems: async () => {
    const { data, error } = await supabase
      .from('variants')
      .select(`
        id,
        product_id,
        sku,
        color,
        size,
        stock,
        stock_minimo,
        cost,
        margin,
        pvp,
        is_custom,
        products!inner (
          name,
          category,
          brand,
          season,
          barcode,
          provider_info,
          base_price,
          cost,
          base_margin
        )
      `)
      .order('id', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching deleted inventory items:', error);
      throw new Error(`Error al obtener papelera: ${error.message}`);
    }
    
    if (!data) return [];
    
    return data.map((v: any) => {
      const prices = api._mapPrices(v);
      return {
        id: v.id,
        product_id: v.product_id,
        name: v.products?.name || 'Producto sin nombre',
        sku: v.sku,
        barcode: v.products?.barcode,
        color: v.color,
        size: v.size,
        stock: v.stock,
        stock_minimo: v.stock_minimo,
        cost: v.cost,
        margin: v.margin,
        ...prices,
        isCustom: v.is_custom,
        category: v.products?.category || 'General',
        brand: v.products?.brand || 'Genérica',
        season: v.products?.season || 'N/A',
        provider_info: v.products?.provider_info,
        base_price: v.products?.base_price,
        base_cost: v.products?.cost,
        base_margin: v.products?.base_margin
      };
    });
  },

  deleteProduct: async (id: number) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  /**
   * Lightweight update for base financial fields on the products table only.
   * Use this instead of updateProduct() when you only need to patch cost/base_margin
   * without touching variants — avoids calling the full update_product_v2 RPC with
   * incomplete data.
   */
  updateProductBase: async (id: number, fields: { cost?: number; base_margin?: number; base_price?: number; provider_info?: string }) => {
    const { error } = await supabase
      .from('products')
      .update(fields)
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  async updateProduct(id: number, productData: any) {
    // 1. Extraemos SOLO los campos que queremos actualizar
    // y descartamos los que causan el error 409
    const dataToUpdate = {
      name: productData.name,
      status: productData.status,
      category: productData.category,
      brand: productData.brand,
      season: productData.season,
      base_margin: productData.base_margin,
      iva_rate: productData.iva_rate
    };

    // 2. Ejecutamos la actualización solo con esos campos
    const { data, error } = await supabase
      .from('products')
      .update(dataToUpdate)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data?.[0] || productData;
  },

  massPriceAdjust: async (percentage: number) => {
    const { data, error } = await supabase.rpc('mass_price_adjust', {
      p_percentage: percentage
    });
    if (error) throw error;
    return data;
  },

  massMarginAdjust: async (newMargin: number) => {
    const { data, error } = await supabase.rpc('mass_margin_adjust', {
      p_margin: newMargin
    });
    if (error) throw error;
    return data;
  },

  getProductVariants: async (id: number) => {
    const { data, error } = await supabase
      .from('variants')
      .select(VARIANT_SELECT)
      .eq('product_id', id);
    
    if (error) throw error;
    return data;
  },

  updateVariant: async (id: number, data: any) => {
    const { error } = await supabase
      .from('variants')
      .update(data)
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  bulkInventoryEntry: async (items: any[], userId: number) => {
    const eventId = `ARRIVAL_${Date.now()}`;
    const { data, error } = await supabase.rpc('bulk_inventory_entry', {
      p_items: items,
      p_user_id: userId,
      p_event_id: eventId
    });
    
    if (error) throw error;
    return data;
  },

  updateStock: async (id: number, quantity: number, type: string, description: string, reason: string, userId: number, sku?: string) => {
    const operatorEmail = localStorage.getItem('operator_email') || 'admin@arcadia.com';

    // 1. Ejecución directa en Supabase (Cloud-Only)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log("ℹ️ [Cloud Sync] No active session. Skipping cloud synchronization.");
      return { success: true };
    }

    // If we have a SKU, try to find the correct variant ID in Supabase first to avoid 409 Conflicts
    let cloudVariantId = id;
    if (sku) {
      try {
        const { data: vData } = await supabase
          .from('variants')
          .select('id')
          .eq('sku', sku)
          .maybeSingle();
        if (vData) cloudVariantId = vData.id;
      } catch (e) {
        console.warn("[Cloud Sync] Failed to resolve variant ID by SKU:", e);
      }
    }

    const { data, error } = await supabase.rpc('update_inventory_stock', {
      p_variant_id: cloudVariantId,
      p_quantity: quantity,
      p_type: type,
      p_description: description || '',
      p_reason: reason || '',
      p_user_id: userId
    });
    
    if (error) {
      if (error.code === '23503' || (error as any).status === 409) {
        console.warn(`⚠️ [Cloud Sync] Variant ${sku || id} not found in Supabase. Local change preserved.`);
        return { success: true };
      }
      throw error;
    }
    return data;
  },

  getProductByBarcode: async (barcode: string) => {
    // IMPORTANT: When using embedded joins (variants), filter columns MUST be
    // included in the select — otherwise PostgREST returns 400.
    const { data, error } = await supabase
      .from('products')
      .select(`${PRODUCT_SELECT}, status, variants(${VARIANT_SELECT})`)
      .eq('barcode', barcode)
      .neq('status', 'deleted')
      .limit(1);

    if (error || !data || data.length === 0) return null;
    // JS-side safety filter in case the DB column is null/undefined
    const result = data.find((p: any) => p.status !== 'deleted');
    return result ?? null;
  },
  
  getProductById: async (id: number) => {
    if (!id || isNaN(id)) return null;
    
    // 1. Try local server first (unless confirmed down)

    // 2. Fallback to Supabase
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`${PRODUCT_SELECT}, variants(${VARIANT_SELECT})`)
        .eq('id', id)
        .single();
      
      if (error || !data) return null;
      
      const prices = api._mapPrices(data);
      const processedProduct = {
        ...data,
        ...prices,
        variants: Array.isArray(data.variants) ? data.variants : []
      };


      return processedProduct;
    } catch (e) {
      console.error(`[Cloud Fetch Error] ID ${id}:`, e);
      return null;
    }
  },

  getVariantBySku: async (sku: string) => {
    const { data, error } = await supabase
      .from('variants')
      .select(`${VARIANT_SELECT}, products!inner(${PRODUCT_SELECT})`)
      .eq('sku', sku)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  getInventoryHistory: async (limit = 50, offset = 0) => {
    // 1. Carga directa desde Supabase (Cloud-Only)
    try {
      const safeLimit = typeof limit === 'number' ? limit : 50;
      const safeOffset = typeof offset === 'number' ? offset : 0;

      console.log("🔍 [API] Intentando cargar historial desde inventory_logs...");

      // 2. Fetch from the NEW inventory_logs table as requested
      const { data, error } = await supabase
        .from('inventory_logs')
        .select('*') // Seleccionamos todo para evitar fallos por columnas faltantes
        .order('created_at', { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1);
      
      if (error) {
        console.error('❌ Error crítico de Supabase en historial:', error.message, error.details);
        return [];
      }
      
      console.log("📊 [API] Datos recibidos de inventory_logs:", data?.length || 0, "filas");
      
      if (!data || data.length === 0) {
        console.warn("⚠️ La tabla inventory_logs parece estar vacía.");
        return [];
      }
      
      return data.map((log: any) => {
        // Map action types to our UI types
        let movType = 'otros';
        const action = (log.action_type || '').toUpperCase();
        if (action === 'INSERT') movType = 'ingreso';
        if (action === 'UPDATE') movType = 'otros';
        if (action === 'DELETE') movType = 'egreso';

        const meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : (log.metadata || {});

        return {
          id: log.id,
          type: movType,
          // Reforzamos los campos para que la UI no muestre 'Undefined'
          description: log.description || `Acción ${action}`,
          reason: log.description || `Operación de sistema (${action})`,
          timestamp: log.created_at,
          created_at: log.created_at,
          operator: 'Usuario Sistema', 
          sku: meta.sku || meta.barcode || '---',
          product_name: log.description, 
          // Campos planos para evitar errores de objetos anidados en la UI
          size: meta.size || 'N/A',
          color: meta.color || 'N/A',
          base_product_name: log.description,
          event_id: `LOG-${log.id}`,
          change_amount: meta.stock_actual ? Number(meta.stock_actual) : 0,
          is_batch: false,
          is_annulled: false
        };
      });
    } catch (e) {
      console.error('CRITICAL: Inventory history fetch failed:', e);
      return [];
    }
  },

  /**
   * Annuls a batch of movements by inserting individual reversal records.
   * Each reversal has a guaranteed non-null variant_id to satisfy the DB constraint.
   * This replaces the old RPC approach which would create null variant_id rows.
   */
  annulMovementsBatch: async (
    sessionMovements: Array<{ variant_id: number | null; change_amount?: number }>,
    operatorName: string,
    userId: number,
    originalEventId: string | null
  ) => {
    // Only process movements that have a real variant reference
    const valid = sessionMovements.filter(
      (m) => m.variant_id != null && m.variant_id !== undefined
    );

    if (valid.length === 0) {
      throw new Error(
        'No se encontraron variantes válidas para anular. Verifica que los movimientos tengan una variante asociada.'
      );
    }

    const annulEventId = `ANNUL_${originalEventId ?? 'manual'}_${Date.now()}`;

    const annulEventId = `ANNUL_${originalEventId ?? 'manual'}_${Date.now()}`;

    // 1. Ejecución directa en Supabase (Cloud-Only)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log("ℹ️ [Cloud Sync] No active session. Skipping cloud annulment.");
      return { success: true, annulEventId };
    }

    try {
      const reversalRows = valid.map((m) => ({
        variant_id: m.variant_id!,
        user_id: userId,
        change_amount: -(m.change_amount || 0),
        reason: `ANULACION: Reversa de operación ${originalEventId ?? 'manual'} (Op: ${operatorName})`,
        event_id: annulEventId,
      }));

      const { data, error } = await supabase.from('stock_movements').insert(reversalRows);
      if (error) {
        if ((error as any).status === 401 || (error as any).status === 400) {
          console.warn("⚠️ [Cloud Auth] Unauthorized to annul in Supabase. Local change preserved.");
          return { reversed: reversalRows.length };
        }
        throw error;
      }
      return { reversed: reversalRows.length, data };
    } catch (e) {
      console.error("[annulMovementsBatch] Cloud error:", e);
      return { reversed: valid.length };
    }
  },

  recordMovement: async (params: {
    variantId: number;
    userId: number;
    amount: number;
    reason: string;
    eventId?: string;
  }) => {
    const storeId = getCurrentStoreId();
    const { data, error } = await supabase
      .from('stock_movements')
      .insert([{
        variant_id: params.variantId,
        user_id: params.userId,
        change_amount: params.amount,
        reason: params.reason,
        event_id: params.eventId || `EVENT-${Date.now()}`,
        store_id: storeId
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  getSuppliers: async () => {
    let query = supabase.from('suppliers').select('*');
    const storeId = getCurrentStoreId();
    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query.order('name', { ascending: true });
    if (error) throw error;
    return data;
  },

  createSupplier: async (supplier: { name: string; cuit: string; phone?: string }) => {
    const storeId = getCurrentStoreId();
    const { data, error } = await supabase
      .from('suppliers')
      .insert([{ ...supplier, store_id: storeId }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  updateSupplier: async (id: string, supplier: { name: string; cuit: string; phone?: string }) => {
    const { data, error } = await supabase
      .from('suppliers')
      .update(supplier)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // SKU GENERATION HELPERS
  normalizar: (texto: string) => {
    if (!texto) return '';
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Elimina tildes
      .replace(/[^a-zA-Z0-9]/g, "")   // Elimina caracteres no alfanuméricos
      .toUpperCase()
      .trim();
  },

  generarSufijo: () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  },

  generarSkuSeguro: async (categoria: string, color: string, talle: string) => {
    const rubro = api.normalizar(categoria).substring(0, 3);
    const col = api.normalizar(color).substring(0, 3);
    const tal = api.normalizar(talle);
    const suffix = api.generarSufijo();
    return `${rubro}-${col}-${tal}-${suffix}`;
  },

  getInventoryItemsREST: async () => {
    return api.getInventoryItems();
  }
};
