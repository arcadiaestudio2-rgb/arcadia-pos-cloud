import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import 'dotenv/config';
import pkg from 'pg';
import crypto from 'crypto';
const { Pool } = pkg;
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pzlkzoemyfefwgaywegn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bGt6b2VteWZlZndnYXl3ZWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDUwNDQsImV4cCI6MjA5MTkyMTA0NH0.Xf5uKEQ0ztv1xWbt5ZwFraMMRQXMOsI3pE6jYYWCGz4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 5000;
  
  app.use(cors({ origin: '*', credentials: true }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use(express.json());
  
  // Log de Red: Ver todas las peticiones
  app.use((req, res, next) => {
    console.log("Petición recibida en:", req.method, req.url);
    next();
  });

  const isSandbox = process.env.PERSIST_DATA === 'false';
  if (isSandbox) {
    console.log("-----------------------------------------");
    console.log("⚠️ MODO SANDBOX ACTIVADO");
    console.log("Los datos se guardarán en memoria y se");
    console.log("perderán al reiniciar el servidor.");
    console.log("-----------------------------------------");
  }

  // --- DATABASE INITIALIZATION ---
  const connectionString = process.env.SQL_DATABASE;
  const isPostgres = connectionString && connectionString.startsWith('postgres');
  
  let db: any;
  let pgPool: pkg.Pool | null = null;

  if (isPostgres) {
    console.log('Connecting to PostgreSQL...');
    pgPool = new Pool({ connectionString });
    
    const translateSql = (sql: string) => {
      let count = 0;
      return sql.replace(/\?/g, () => `$${++count}`);
    };

    db = {
      exec: async (sql: string) => pgPool!.query(sql),
      prepare: (sql: string, trxClient?: any) => {
        const pgSql = translateSql(sql);
        const executor = trxClient || pgPool;
        return {
          get: async (params: any[] = []) => {
            const res = await executor!.query(pgSql, params);
            return res.rows[0];
          },
          all: async (params: any[] = []) => {
            const res = await executor!.query(pgSql, params);
            return res.rows;
          },
          run: async (params: any[] = []) => {
            let finalSql = pgSql;
            if (finalSql.trim().toUpperCase().startsWith('INSERT') && !finalSql.toUpperCase().includes('RETURNING')) {
              finalSql += ' RETURNING id';
            }
            const res = await executor!.query(finalSql, params);
            return { 
              lastInsertRowid: res.rows?.[0]?.id || (res as any).oid || null,
              changes: res.rowCount 
            };
          }
        };
      },
      transaction: async (callback: (trx: any) => Promise<any>) => {
        const client = await pgPool!.connect();
        try {
          await client.query('BEGIN');
          const trx = {
            prepare: (sql: string) => db.prepare(sql, client),
            query: (sql: string, params: any[]) => client.query(translateSql(sql), params)
          };
          const result = await callback(trx);
          await client.query('COMMIT');
          return result;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
    };
  } else {
    console.log('Using SQLite...');
    let sqlitePath: string;
    
    if (isSandbox) {
      sqlitePath = ':memory:';
    } else {
      sqlitePath = (connectionString && !connectionString.includes('://')) ? connectionString : path.join(__dirname, 'arcadia.db');
    }
    
    const sqlite = new Database(sqlitePath, { timeout: 5000 });
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = DELETE');
    console.log('SQLite: Journal mode set to DELETE');
    
    db = {
      exec: (sql: string) => sqlite.exec(sql),
      prepare: (sql: string) => ({
        get: async (params: any[] = []) => sqlite.prepare(sql).get(...params),
        all: async (params: any[] = []) => sqlite.prepare(sql).all(...params),
        run: async (params: any[] = []) => {
          const info = sqlite.prepare(sql).run(...params);
          return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
        }
      }),
      transaction: async (callback: (trx: any) => Promise<any>) => {
        sqlite.prepare('BEGIN').run();
        try {
          const trx = {
            prepare: (sql: string) => ({
              get: async (params: any[] = []) => sqlite.prepare(sql).get(...params),
              all: async (params: any[] = []) => sqlite.prepare(sql).all(...params),
              run: async (params: any[] = []) => {
                const info = sqlite.prepare(sql).run(...params);
                return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
              }
            }),
            query: async (sql: string, params: any[]) => ({ rows: sqlite.prepare(sql).all(...params) })
          };
          const result = await callback(trx);
          sqlite.prepare('COMMIT').run();
          return result;
        } catch (e) {
          sqlite.prepare('ROLLBACK').run();
          throw e;
        }
      }
    };
  }

  // Unified Schema
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL,
      password TEXT NOT NULL,
      session_token TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT,
      season TEXT,
      barcode TEXT UNIQUE,
      iva_rate REAL DEFAULT 21,
      base_price REAL,
      cost REAL,
      base_margin REAL DEFAULT 60,
      provider_info TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catalog_attributes (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      UNIQUE(type, value)
    );

    CREATE TABLE IF NOT EXISTS variants (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      product_id INTEGER NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      stock INTEGER DEFAULT 0,
      cost REAL,
      margin REAL,
      pvp REAL,
      stock_minimo INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clients (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      name TEXT NOT NULL,
      dni_tax_id TEXT UNIQUE NOT NULL,
      phone TEXT,
      debt_balance REAL DEFAULT 0,
      credit_limit REAL DEFAULT 20000
    );

    CREATE TABLE IF NOT EXISTS sales (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      client_id INTEGER,
      total REAL NOT NULL,
      discount REAL DEFAULT 0,
      payment_method TEXT NOT NULL,
      cash_amount REAL DEFAULT 0,
      credit_amount REAL DEFAULT 0,
      store_credit_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      void_reason TEXT,
      voided_at TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      sale_id INTEGER NOT NULL,
      variant_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_sale REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (variant_id) REFERENCES variants(id)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      variant_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      change_amount INTEGER NOT NULL,
      type TEXT,
      description TEXT,
      reason TEXT,
      evento_id TEXT,
      payload_json TEXT,
      is_annulled INTEGER DEFAULT 0,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (variant_id) REFERENCES variants(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS global_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `;

  // Verificar esquema de usuarios
  try {
    const tableInfo = await db.prepare("PRAGMA table_info(users)").all();
    const hasEmail = tableInfo.some((col: any) => col.name === 'email');
    if (tableInfo.length > 0 && !hasEmail) {
      console.log("Actualizando tabla de usuarios...");
      await db.prepare('DROP TABLE users').run();
    }
  } catch (e) {
    // Ignorar si la tabla no existe
  }

  await db.exec(schema);
  console.log(isSandbox ? "Base de datos en memoria lista" : "Base de datos lista y conectada");

  // Check for obsolete columns and reset if necessary
  try {
    let shouldReset = false; // Disabled forced reset to protect data persistence
    if (isPostgres) {
      const check = await db.prepare("SELECT column_name FROM information_schema.columns WHERE table_name='products' AND column_name='image_url'").all();
      if (check.length > 0) shouldReset = true;
    } else {
      const pragma = await db.prepare("PRAGMA table_info(products)").all();
      if (pragma.some((col: any) => col.name === 'image_url')) shouldReset = true;
    }

    // Migración para nuevas columnas en productos
    if (!isPostgres) {
      const pragma = await db.prepare("PRAGMA table_info(products)").all();
      const hasProviderInfo = pragma.some((col: any) => col.name === 'provider_info');
      const hasStatus = pragma.some((col: any) => col.name === 'status');
      
      if (!hasProviderInfo) {
        console.log("Añadiendo columna provider_info a productos...");
        await db.prepare('ALTER TABLE products ADD COLUMN provider_info TEXT').run();
      }
      if (!hasStatus) {
        console.log("Añadiendo columna status a productos...");
        await db.prepare("ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active'").run();
      }
    }

    if (shouldReset) {
      console.log("Detectada columna obsoleta 'image_url'. Realizando hard reset de tablas afectadas...");
      await db.exec('DROP TABLE IF EXISTS sale_items');
      await db.exec('DROP TABLE IF EXISTS stock_movements');
      await db.exec('DROP TABLE IF EXISTS variants');
      await db.exec('DROP TABLE IF EXISTS products');
      
      // Re-run the schema to recreate the tables without image_url
      await db.exec(schema);
      console.log("Hard reset completado con éxito.");
    }
  } catch (e) {
    console.error("Error durante el saneamiento de datos:", e);
  }

  // Migration for new columns
  const applyMigrations = async () => {
    // Products table migrations
    const productCols = [
      { name: 'brand', type: 'TEXT' },
      { name: 'season', type: 'TEXT' },
      { name: 'barcode', type: 'TEXT' },
      { name: 'iva_rate', type: 'REAL' }
    ];

    for (const col of productCols) {
      try {
        if (isPostgres) {
          await db.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        } else {
          await db.exec(`ALTER TABLE products ADD COLUMN ${col.name} ${col.type}`);
        }
      } catch (e) { /* Column might exist */ }
    }

    // Sales table migrations
    const salesCols = [
      { name: 'cash_amount', type: 'REAL DEFAULT 0' },
      { name: 'credit_amount', type: 'REAL DEFAULT 0' },
      { name: 'store_credit_amount', type: 'REAL DEFAULT 0' },
      { name: 'status', type: "TEXT DEFAULT 'active'" },
      { name: 'void_reason', type: 'TEXT' },
      { name: 'voided_at', type: 'TIMESTAMP' }
    ];

    for (const col of salesCols) {
      try {
        if (isPostgres) {
          await db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        } else {
          await db.exec(`ALTER TABLE sales ADD COLUMN ${col.name} ${col.type}`);
        }
      } catch (e) { /* Column might exist */ }
    }

    // Stock Movements table migrations
    const stockMovementsCols = [
      { name: 'evento_id', type: 'TEXT' },
      { name: 'payload_json', type: 'TEXT' },
      { name: 'is_annulled', type: 'INTEGER DEFAULT 0' }
    ];

    for (const col of stockMovementsCols) {
      try {
        if (isPostgres) {
          await db.exec(`ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        } else {
          await db.exec(`ALTER TABLE stock_movements ADD COLUMN ${col.name} ${col.type}`);
        }
      } catch (e) { /* Column might exist */ }
    }
  };
  await applyMigrations();

  // Seed initial data
  const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (Number(userCount.count) === 0) {
    await db.prepare('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)').run(['Gabi', 'gabi@arcadia.com', 'admin', 'admin123']);
    await db.prepare('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)').run(['Lucas', 'lucas@arcadia.com', 'seller', 'lucas123']);
    await db.prepare('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)').run(['Sofi', 'sofi@arcadia.com', 'seller', 'sofi123']);
  }

  // Seed Mock Data for Sandbox Mode
  if (isSandbox) {
    const productCount = await db.prepare('SELECT COUNT(*) as count FROM products').get();
    if (Number(productCount.count) === 0) {
      console.log("Sembrando datos de prueba para Modo Sandbox...");
      const p1 = await db.prepare('INSERT INTO products (name, category, brand, base_price, cost, base_margin) VALUES (?, ?, ?, ?, ?, ?)').run([
        'Remera Oversize Black', 'Remeras', 'Arcadia', 15000, 6000, 150
      ]);
      await db.prepare('INSERT INTO variants (product_id, sku, size, color, stock, pvp) VALUES (?, ?, ?, ?, ?, ?)').run([
        p1.lastInsertRowid, 'REM-OV-BK-M', 'M', 'Negro', 10, 15000
      ]);
      
      const p2 = await db.prepare('INSERT INTO products (name, category, brand, base_price, cost, base_margin) VALUES (?, ?, ?, ?, ?, ?)').run([
        'Pantalón Cargo Olive', 'Pantalones', 'Arcadia', 28000, 12000, 133
      ]);
      await db.prepare('INSERT INTO variants (product_id, sku, size, color, stock, pvp) VALUES (?, ?, ?, ?, ?, ?)').run([
        p2.lastInsertRowid, 'PAN-CR-OL-42', '42', 'Oliva', 5, 28000
      ]);
      
      await db.prepare('INSERT INTO clients (name, dni_tax_id, phone, debt_balance) VALUES (?, ?, ?, ?)').run([
        'Juan Pérez (Prueba)', '20-12345678-9', '11 2233-4455', 0
      ]);
    }
  }

  // --- API ENDPOINTS ---

  app.get('/api/config/sandbox', (req, res) => {
    res.json({ isSandbox });
  });

  app.get('/api/users', async (req, res) => {
    try {
      const users = await db.prepare('SELECT id, name, role, email FROM users ORDER BY name ASC').all();
      res.json(users);
    } catch (error) {
      console.error("[Get Users Error]:", error);
      res.status(500).json({ error: 'Error al obtener usuarios' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get([email, password]);
      if (user) {
        // En un entorno real, generaríamos un JWT
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } else {
        res.status(401).json({ error: 'Credenciales inválidas' });
      }
    } catch (error) {
      console.error("[Login Error]:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const totalSales = await db.prepare('SELECT SUM(total) as sum FROM sales').get();
      const totalCost = await db.prepare('SELECT SUM(si.quantity * p.cost) as sum FROM sale_items si JOIN variants v ON si.variant_id = v.id JOIN products p ON v.product_id = p.id').get();
      const totalAr = await db.prepare('SELECT SUM(debt_balance) as sum FROM clients').get();
      
      const topSeller = await db.prepare(`
        SELECT u.name, SUM(s.total) as revenue, COUNT(s.id) as sales
        FROM sales s 
        JOIN users u ON s.user_id = u.id 
        GROUP BY u.name 
        ORDER BY revenue DESC 
        LIMIT 1
      `).get();

      const criticalStock = await db.prepare(`
        SELECT v.id, p.name, v.sku, v.stock, v.stock_minimo as min
        FROM variants v
        JOIN products p ON v.product_id = p.id
        WHERE v.stock <= v.stock_minimo AND v.stock_minimo > 0
        LIMIT 5
      `).all();

      const agingDebtors = await db.prepare(`
        SELECT id, name, debt_balance as debt, 
               ${isPostgres ? "EXTRACT(DAY FROM NOW() - (SELECT MAX(timestamp) FROM sales WHERE client_id = clients.id))" : "CAST(julianday('now') - julianday((SELECT MAX(timestamp) FROM sales WHERE client_id = clients.id)) AS INTEGER)"} as days
        FROM clients
        WHERE debt_balance > 0
        ORDER BY debt DESC
        LIMIT 5
      `).all();

      const deadStock = await db.prepare(`
        SELECT v.id, p.name, v.sku, v.stock, (v.pvp * v.stock) as loss,
               COALESCE((SELECT MAX(timestamp) FROM sales s JOIN sale_items si ON s.id = si.sale_id WHERE si.variant_id = v.id), '2000-01-01') as last_sale_date
        FROM variants v
        JOIN products p ON v.product_id = p.id
        WHERE v.stock > 0
        ORDER BY last_sale_date ASC
        LIMIT 5
      `).all();

      res.json({
        revenue: Number(totalSales?.sum) || 0,
        cost: Number(totalCost?.sum) || 0,
        ar: Number(totalAr?.sum) || 0,
        topSeller: topSeller || { name: 'N/A', revenue: 0, sales: 0 },
        criticalStock: criticalStock || [],
        agingDebtors: agingDebtors || [],
        deadStock: deadStock || []
      });
    } catch (error) {
      console.error("[Dashboard Stats Error]:", error);
      res.status(500).json({ error: 'Stats failed' });
    }
  });

  app.get('/api/v1/catalog-attributes', async (req, res) => {
    try {
      const attributes = await db.prepare('SELECT * FROM catalog_attributes ORDER BY type, value').all();
      res.json(attributes);
    } catch (error) {
      console.error("[Catalog Attributes Error]:", error);
      res.status(500).json({ error: 'Attributes fetch failed' });
    }
  });

  app.post('/api/v1/catalog-attributes', async (req, res) => {
    const { type, value } = req.body;
    try {
      await db.prepare('INSERT INTO catalog_attributes (type, value) VALUES (?, ?)').run([type, value]);
      res.json({ success: true });
    } catch (error) {
      res.json({ success: true }); // Ignore duplicates
    }
  });

  app.delete('/api/v1/catalog-attributes', async (req, res) => {
    const { type, value } = req.body;
    try {
      await db.prepare('DELETE FROM catalog_attributes WHERE type = ? AND value = ?').run([type, value]);
      res.json({ success: true });
    } catch (error) {
      console.error("[Delete Attribute Error]:", error);
      res.status(500).json({ error: 'Error al eliminar atributo' });
    }
  });

  app.get('/api/v1/products', async (req, res) => {
    try {
      const skuConcat = isPostgres 
        ? "(SELECT STRING_AGG(sku, ', ') FROM variants WHERE product_id = p.id)"
        : "(SELECT GROUP_CONCAT(sku, ', ') FROM variants WHERE product_id = p.id)";

      const products = await db.prepare(`
        SELECT 
          p.*, 
          (SELECT COUNT(*) FROM variants WHERE product_id = p.id) as variant_count,
          (SELECT SUM(stock) FROM variants WHERE product_id = p.id) as total_stock,
          (SELECT SUM(stock_minimo) FROM variants WHERE product_id = p.id) as total_stock_minimo,
          ${skuConcat} as skus
        FROM products p 
        ORDER BY p.name ASC
      `).all();
      res.json(products);
    } catch (error) {
      console.error("[Products Fetch Error]:", error);
      res.json([]);
    }
  });

  app.get('/api/products/search', async (req, res) => {
    try {
      const { q, category } = req.query;
      const searchPattern = `%${q}%`;
      let sql = `
        SELECT p.*, v.sku, v.id as variant_id, v.stock, v.pvp
        FROM products p
        JOIN variants v ON p.id = v.product_id
        WHERE (p.name LIKE ? OR p.brand LIKE ? OR v.sku LIKE ? OR p.barcode LIKE ?)
        AND (p.status != 'deleted' OR p.status IS NULL)
      `;
      const params: any[] = [searchPattern, searchPattern, searchPattern, searchPattern];
      
      if (category && category !== 'Todas') {
        sql += ` AND p.category = ?`;
        params.push(category);
      }
      
      sql += ` ORDER BY p.name ASC LIMIT 100`;
      const products = await db.prepare(sql).all(params);
      res.json(products);
    } catch (error) {
      console.error("[Local Search Error]:", error);
      res.status(500).json({ error: 'Search failed' });
    }
  });


  app.get('/api/clients/search', async (req, res) => {
    try {
      const { q } = req.query;
      const clients = await db.prepare(`
        SELECT * FROM clients 
        WHERE name LIKE ? OR phone LIKE ? OR dni_tax_id LIKE ?
        ORDER BY name ASC
      `).all(`%${q}%`, `%${q}%`, `%${q}%`);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: 'Client search failed' });
    }
  });

  app.get('/api/products/barcode/:barcode', async (req, res) => {
    try {
      const { barcode } = req.params;
      let product = await db.prepare("SELECT * FROM products WHERE barcode = ? AND (status != 'deleted' OR status IS NULL)").get([barcode]);
      if (product) {
        const variants = await db.prepare('SELECT * FROM variants WHERE product_id = ?').all([product.id]);
        return res.json({ ...product, variants });
      }
      const variant = await db.prepare('SELECT * FROM variants WHERE sku = ?').get([barcode]);
      if (variant) {
        product = await db.prepare("SELECT * FROM products WHERE id = ? AND (status != 'deleted' OR status IS NULL)").get([variant.product_id]);
        return res.json({ ...product, selectedVariant: variant, variants: [variant] });
      }
      res.status(404).json({ error: 'Not found' });
    } catch (error) {
      console.error("[Barcode Lookup Error]:", error);
      res.status(500).json({ error: 'Barcode lookup failed' });
    }
  });
  
  app.get('/api/products/variant/sku/:sku', async (req, res) => {
    try {
      const { sku } = req.params;
      const variant = await db.prepare('SELECT * FROM variants WHERE sku = ?').get([sku]);
      if (variant) {
        res.json(variant);
      } else {
        res.status(404).json({ error: 'SKU no encontrado' });
      }
    } catch (error) {
      console.error("[SKU Lookup Error]:", error);
      res.status(500).json({ error: 'Error al buscar SKU' });
    }
  });

  app.post('/api/v1/products', async (req, res) => {
    console.log("Datos recibidos para guardar:", req.body);
    const { 
      name, category, brand, season, barcode, 
      iva_rate, ivaRate, 
      base_price, basePrice, 
      cost, 
      base_margin, baseMargin, 
      provider_info, providerInfo,
      variants, created_at 
    } = req.body;
    try {
      const productId = await db.transaction(async (trx: any) => {
        const pInfo = provider_info || providerInfo;
        const productRes = await trx.prepare(
          'INSERT INTO products (name, category, brand, season, barcode, iva_rate, base_price, cost, base_margin, provider_info, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run([
          name, category, brand, season, barcode, 
          iva_rate ?? ivaRate ?? 21, 
          base_price ?? basePrice ?? cost ?? null, 
          cost ?? null, 
          base_margin ?? baseMargin ?? 60, 
          pInfo ? (typeof pInfo === 'string' ? pInfo : JSON.stringify(pInfo)) : null,
          created_at || new Date().toISOString()
        ]);
        
        const pId = productRes.lastInsertRowid;
        if (variants && Array.isArray(variants)) {
          const eventoId = req.body.evento_id || crypto.randomUUID();
          for (const v of variants) {
            const variantRes = await trx.prepare(
              'INSERT INTO variants (product_id, sku, size, color, stock, cost, margin, pvp, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).run([pId, v.sku, v.size, v.color, v.stock || 0, v.cost, v.margin, v.pvp, v.stock_minimo || 0]);
            
            // Record initial stock movement if stock > 0
            if (v.stock > 0) {
              const vId = variantRes.lastInsertRowid;
              const userId = req.body.userId || 1;
              const payload = JSON.stringify({ 
                action: 'CREATE', 
                before: null, 
                after: { stock: v.stock, cost: v.cost, pvp: v.pvp } 
              });
              await trx.prepare(
                'INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
              ).run([vId, userId, v.stock, 'INGRESO', 'Carga inicial en creación de producto', `Stock inicial (Alta de producto)`, eventoId, payload]);
            }
          }
        }
        return pId;
      });
      console.log(`[Backend] Producto creado con éxito. ID: ${productId}`);
      res.status(201).json({ success: true, productId });
    } catch (error: any) {
      console.error("[Create Product Error]:", error);
      res.status(500).json({ error: error.message || 'Create failed' });
    }
  });

  // --- GET INVENTORY (VARIANTS + PRODUCTS) ---
  app.get('/api/v1/inventory', async (req, res) => {
    try {
      const query = `
        SELECT 
          v.id, v.product_id, v.sku, v.size, v.color, v.stock, v.stock_minimo, v.cost, v.margin, v.pvp,
          p.name, p.category, p.brand, p.season, p.barcode, p.provider_info, p.base_price, p.cost as base_cost, p.base_margin
        FROM variants v
        JOIN products p ON v.product_id = p.id
        WHERE p.status != 'deleted' OR p.status IS NULL
        ORDER BY v.id ASC
      `;
      const variants = await db.prepare(query).all();
      
      // Transform to match the structure the frontend expects
      const formatted = variants.map((v: any) => {
        let mEfectivo = v.pvp || 0;
        let mDebit = 0;
        let mCredit = 0;
        
        try {
          if (v.provider_info) {
            const info = JSON.parse(v.provider_info);
            if (info.manual_prices) {
              mEfectivo = Number(info.manual_prices.efectivo) || mEfectivo;
              mDebit = Number(info.manual_prices.debito || info.manual_prices.debit) || 0;
              mCredit = Number(info.manual_prices.credito || info.manual_prices.credit) || 0;
            }
          }
        } catch (e) {
          console.warn(`Error parsing provider_info for product ${v.product_id}:`, e);
        }

        return {
          ...v,
          price_cash: mEfectivo,
          price_debit: mDebit,
          price_credit: mCredit,
          products: {
            name: v.name,
            category: v.category,
            brand: v.brand,
            season: v.season,
            barcode: v.barcode,
            provider_info: v.provider_info,
            base_price: v.base_price,
            cost: v.base_cost,
            base_margin: v.base_margin
          }
        };
      });
      
      res.json(formatted);
    } catch (error) {
      console.error("[Get Inventory Error]:", error);
      res.status(500).json({ error: 'Error al obtener inventario' });
    }
  });

  app.get('/api/v1/inventory/history', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await db.prepare(`
        SELECT 
          sm.id,
          sm.variant_id,
          sm.user_id,
          sm.change_amount,
          COALESCE(sm.type, '') as type,
          COALESCE(sm.description, '') as description,
          COALESCE(sm.reason, '') as reason,
          sm.evento_id,
          sm.payload_json,
          sm.is_annulled,
          sm.timestamp,
          v.sku, 
          v.size,
          v.color,
          p.name as product_name,
          u.name as user_name
        FROM stock_movements sm
        LEFT JOIN variants v ON sm.variant_id = v.id
        LEFT JOIN products p ON v.product_id = p.id
        LEFT JOIN users u ON sm.user_id = u.id
        ORDER BY sm.timestamp DESC
        LIMIT ? OFFSET ?
      `).all([limit, offset]);
      res.json(history);
    } catch (error) {
      console.error("[History Fetch Error]:", error);
      res.status(500).json({ error: 'History fetch failed' });
    }
  });

  app.get('/api/v1/inventory/:id', async (req, res) => {
    const { id } = req.params;
    try {
      let product = await db.prepare("SELECT * FROM products WHERE id = ? AND (status != 'deleted' OR status IS NULL)").get([id]);
      let variants = [];

      if (!product) {
        console.log(`[API] Product ${id} not found in local SQLite. Falling back to Supabase...`);
        const { data: remoteProduct, error: pErr } = await supabase.from('products').select('*').eq('id', id).single();
        if (pErr || !remoteProduct) {
          return res.status(404).json({ error: 'Producto no encontrado' });
        }
        product = remoteProduct;
        
        const { data: remoteVariants, error: vErr } = await supabase.from('variants').select('*').eq('product_id', id);
        variants = remoteVariants || [];
        
        // Optionally sync to local SQLite for future requests
        try {
          db.prepare('INSERT OR IGNORE INTO products (id, name, category, brand, season, barcode, status, provider_info, base_price, cost, base_margin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run([product.id, product.name, product.category, product.brand, product.season, product.barcode, product.status, product.provider_info, product.base_price, product.cost, product.base_margin]);
          
          for (const v of variants) {
            db.prepare('INSERT OR IGNORE INTO variants (id, product_id, sku, size, color, stock, cost, margin, pvp, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run([v.id, v.product_id, v.sku, v.size, v.color, v.stock, v.cost, v.margin, v.pvp, v.stock_minimo]);
          }
        } catch (syncErr) {
          console.warn("[Sync Warning] Failed to cache product in local SQLite:", syncErr);
        }
      } else {
        variants = await db.prepare('SELECT * FROM variants WHERE product_id = ?').all([id]);
      }
      
      // Transform product with manual prices
      let mEfectivo = product.base_price || 0;
      let mDebit = 0;
      let mCredit = 0;
      
      try {
        if (product.provider_info) {
          const info = typeof product.provider_info === 'string' ? JSON.parse(product.provider_info) : product.provider_info;
          if (info.manual_prices) {
            mEfectivo = Number(info.manual_prices.efectivo) || mEfectivo;
            mDebit = Number(info.manual_prices.debito || info.manual_prices.debit) || 0;
            mCredit = Number(info.manual_prices.credito || info.manual_prices.credit) || 0;
          }
        }
      } catch (e) {}

      res.json({
        ...product,
        price_cash: mEfectivo,
        price_debit: mDebit,
        price_credit: mCredit,
        variants
      });
    } catch (error) {
      console.error("[Get Product Error]:", error);
      res.status(500).json({ error: 'Error al obtener producto' });
    }
  });

  // --- INVENTORY PATCH ENDPOINT ---
  app.patch('/api/v1/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { 
      price_cash, 
      price_debit, 
      price_credit,
      cost,
      margin,
      base_margin,
      name,
      category,
      brand,
      season,
      barcode,
      iva_rate,
      status,
      last_operator,
      variants // Should be an array of variant objects with stock/pvp updates
    } = req.body;

    const finalMargin = margin !== undefined ? margin : base_margin;

    console.log(`[API PATCH] Updating inventory item ${id}. Body:`, JSON.stringify(req.body, null, 2));

    try {
      const updatedItem = await db.transaction(async (trx: any) => {
        // Load existing product info to merge provider_info
        let existing = await trx.prepare('SELECT * FROM products WHERE id = ?').get([id]);
        if (!existing) {
          console.log(`[API PATCH] Product ${id} not found. Creating local record...`);
          await trx.prepare(`
            INSERT INTO products (id, name, category, brand, season, barcode, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run([
            id, 
            name || 'Producto Sincronizado', 
            category || 'General', 
            brand || 'Genérica', 
            season || 'N/A', 
            barcode || `SYNC-${id}`,
            'active'
          ]);
          existing = await trx.prepare('SELECT * FROM products WHERE id = ?').get([id]);
        }

        let providerInfoObj: any = {};
        try {
          providerInfoObj = existing.provider_info ? JSON.parse(existing.provider_info) : {};
        } catch (e) {}

        const incomingProviderInfo = req.body.provider_info || {};
        const incomingManual = incomingProviderInfo.manual_prices || {};

        // Debug incoming values
        console.log(`[API PATCH] Incoming Pricing - Cash: ${price_cash}, Debit: ${price_debit}, Credit: ${price_credit}`);
        console.log(`[API PATCH] Existing Provider Info:`, JSON.stringify(providerInfoObj?.manual_prices));

        const updatedProviderInfo = {
          ...providerInfoObj,
          ...incomingProviderInfo,
          manual_prices: {
            // Priority: Root Field > Incoming Object > Existing State > Database Base Price
            efectivo: Number(price_cash || incomingManual.efectivo || providerInfoObj?.manual_prices?.efectivo || existing.base_price || 0),
            debito: Number(price_debit !== undefined ? price_debit : (incomingManual.debito || incomingManual.debit || providerInfoObj?.manual_prices?.debito || 0)),
            credito: Number(price_credit !== undefined ? price_credit : (incomingManual.credito || incomingManual.credit || providerInfoObj?.manual_prices?.credito || 0))
          }
        };
        
        console.log(`[API PATCH] Final Resolved Prices:`, JSON.stringify(updatedProviderInfo.manual_prices));

        // Update product fields
        await trx.prepare(`
          UPDATE products 
          SET 
            name = COALESCE(?, name), 
            category = COALESCE(?, category), 
            brand = COALESCE(?, brand), 
            season = COALESCE(?, season), 
            barcode = COALESCE(?, barcode), 
            iva_rate = COALESCE(?, iva_rate),
            base_price = COALESCE(?, base_price),
            cost = COALESCE(?, cost),
            base_margin = COALESCE(?, base_margin),
            provider_info = ?,
            status = COALESCE(?, status)
          WHERE id = ?
        `).run([
          name || null, 
          category || null, 
          brand || null, 
          season || null, 
          barcode || null, 
          iva_rate ?? null, 
          price_cash ?? null, 
          cost ?? null, 
          finalMargin ?? null,
          JSON.stringify(updatedProviderInfo),
          req.body.status || null,
          id
        ]);

        // Upsert variants if provided (requested for full sync)
        if (variants && Array.isArray(variants)) {
          const eventoId = req.body.evento_id || crypto.randomUUID();
          const userId = req.body.userId || 1;

          for (const v of variants) {
            const existingVariant = await trx.prepare('SELECT * FROM variants WHERE id = ?').get([v.id]);
            
            if (existingVariant) {
              const oldStock = existingVariant.stock || 0;
              const newStock = v.stock !== undefined ? v.stock : oldStock;
              const oldCost = existingVariant.cost || 0;
              const newCost = v.cost !== undefined ? v.cost : oldCost;
              const oldPvp = existingVariant.pvp || 0;
              const newPvp = v.pvp !== undefined ? v.pvp : oldPvp;

              await trx.prepare(`
                UPDATE variants 
                SET 
                  stock = ?,
                  cost = ?,
                  margin = COALESCE(?, margin),
                  pvp = ?
                WHERE id = ? AND product_id = ?
              `).run([newStock, newCost, v.margin, newPvp, v.id, id]);

              // Record movement if there's a significant change
              if (newStock !== oldStock || newCost !== oldCost || newPvp !== oldPvp) {
                const diff = newStock - oldStock;
                const type = newStock !== oldStock ? (diff > 0 ? 'INGRESO' : 'EGRESO') : 'FINANCIERO';
                const payload = JSON.stringify({ 
                  action: 'PATCH_UPDATE',
                  before: { stock: oldStock, cost: oldCost, pvp: oldPvp }, 
                  after: { stock: newStock, cost: newCost, pvp: newPvp } 
                });
                await trx.prepare(`
                  INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run([v.id, userId, diff, type, 'Ajuste desde edición de producto', `Sincronización/Ajuste (Op: ${userId})`, eventoId, payload]);
              }
            } else {
              const variantRes = await trx.prepare(`
                INSERT INTO variants (id, product_id, sku, size, color, stock, cost, margin, pvp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run([
                v.id || null, 
                id, 
                v.sku || `SKU-${v.id || Date.now()}`, 
                v.size || 'N/A', 
                v.color || 'N/A', 
                v.stock || 0, 
                v.cost || 0, 
                v.margin || 0, 
                v.pvp || 0
              ]);

              if ((v.stock || 0) > 0) {
                const vId = v.id || variantRes.lastInsertRowid;
                const payload = JSON.stringify({ 
                  action: 'CREATE', 
                  before: null, 
                  after: { stock: v.stock, cost: v.cost, pvp: v.pvp } 
                });
                await trx.prepare(`
                  INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run([vId, userId, v.stock, 'INGRESO', 'Carga inicial via Sync', `Alta de variante (Op: ${userId})`, eventoId, payload]);
              }
            }
          }
        }

        // Return updated product with parsed prices
        const finalProduct = await trx.prepare('SELECT * FROM products WHERE id = ?').get([id]);
        const finalVariants = await trx.prepare('SELECT * FROM variants WHERE product_id = ?').all([id]);
        
        let mEfectivo = finalProduct.base_price || 0;
        let mDebit = 0;
        let mCredit = 0;
        try {
          if (finalProduct.provider_info) {
            const info = JSON.parse(finalProduct.provider_info);
            if (info.manual_prices) {
              mEfectivo = Number(info.manual_prices.efectivo) || mEfectivo;
              mDebit = Number(info.manual_prices.debito || info.manual_prices.debit) || 0;
              mCredit = Number(info.manual_prices.credito || info.manual_prices.credit) || 0;
            }
          }
        } catch (e) {}

        return { 
          ...finalProduct, 
          price_cash: mEfectivo,
          price_debit: mDebit,
          price_credit: mCredit,
          variants: finalVariants 
        };
      });

      res.json(updatedItem);
    } catch (error: any) {
      console.error("[Inventory Patch Error]:", error);
      if (error.message === 'Product not found') {
        res.status(404).json({ error: 'Producto no encontrado' });
      } else {
        res.status(500).json({ error: 'Error interno del servidor al actualizar inventario' });
      }
    }
  });

  app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { 
      name, category, brand, season, barcode, 
      iva_rate, ivaRate, 
      base_price, basePrice, 
      cost, 
      base_margin, baseMargin, 
      variants 
    } = req.body;
    try {
      await db.transaction(async (trx: any) => {
        await trx.prepare(
          'UPDATE products SET name = ?, category = ?, brand = ?, season = ?, barcode = ?, iva_rate = ?, base_price = ?, cost = ?, base_margin = ?, status = ? WHERE id = ?'
        ).run([
          name, category, brand, season, barcode, 
          iva_rate ?? ivaRate ?? 21, 
          base_price ?? basePrice ?? cost ?? null, 
          cost ?? null, 
          base_margin ?? baseMargin ?? 60, 
          req.body.status || 'active',
          id
        ]);

        if (variants) {
          const existing = await trx.prepare('SELECT id FROM variants WHERE product_id = ?').all([id]);
          const existingIds = existing.map((v: any) => v.id.toString());
          const incomingIds = variants.filter((v: any) => v.id).map((v: any) => v.id.toString());
          
          for (const oldId of existingIds) {
            if (!incomingIds.includes(oldId)) await trx.prepare('DELETE FROM variants WHERE id = ?').run([oldId]);
          }

          const eventoId = req.body.evento_id || crypto.randomUUID();

          for (const v of variants) {
            const userId = req.body.userId || 1; // Fallback to admin if not provided
            if (v.id) {
              // Check for stock changes
              const currentVariant = await trx.prepare('SELECT * FROM variants WHERE id = ?').get([v.id]);
              const oldStock = currentVariant?.stock || 0;
              const newStock = v.stock ?? 0;
              const oldCost = currentVariant?.cost || 0;
              const oldPvp = currentVariant?.pvp || 0;

              await trx.prepare(
                'UPDATE variants SET sku = ?, size = ?, color = ?, stock = ?, cost = ?, margin = ?, pvp = ?, stock_minimo = ? WHERE id = ?'
              ).run([v.sku, v.size, v.color, newStock, v.cost, v.margin, v.pvp, v.stock_minimo || 0, v.id]);

              if (newStock !== oldStock || oldCost !== v.cost || oldPvp !== v.pvp) {
                const diff = newStock - oldStock;
                const type = newStock !== oldStock ? (diff > 0 ? 'INGRESO' : 'EGRESO') : 'FINANCIERO';
                const payload = JSON.stringify({ 
                  before: { stock: oldStock, cost: oldCost, pvp: oldPvp }, 
                  after: { stock: newStock, cost: v.cost, pvp: v.pvp } 
                });
                await trx.prepare(
                  'INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                ).run([v.id, userId, diff, type, 'Ajuste manual desde edición de producto', `Ajuste en edición de producto`, eventoId, payload]);
              }
            } else {
              const variantRes = await trx.prepare(
                'INSERT INTO variants (product_id, sku, size, color, stock, cost, margin, pvp, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
              ).run([id, v.sku, v.size, v.color, v.stock || 0, v.cost, v.margin, v.pvp, v.stock_minimo || 0]);

              if ((v.stock || 0) > 0) {
                const vId = variantRes.lastInsertRowid;
                const payload = JSON.stringify({ 
                  action: 'CREATE', 
                  before: null, 
                  after: { stock: v.stock, cost: v.cost, pvp: v.pvp } 
                });
                await trx.prepare(
                  'INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                ).run([vId, userId, v.stock, 'INGRESO', 'Ajuste manual desde edición de producto', `Stock inicial (Alta de variante)`, eventoId, payload]);
              }
            }
          }
        }
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: 'Update failed' });
    }
  });

  app.delete('/api/products/:id', async (req, res) => {
    try {
      await db.prepare('DELETE FROM products WHERE id = ?').run([req.params.id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  app.post('/api/v1/inventory/stock', async (req, res) => {
    const { variant_id, quantity, type, description, reason, user_id, user_email, evento_id } = req.body;
    try {
      await db.transaction(async (trx: any) => {
        // Resolve local user ID
        let localUserId = 1; // Default to Admin
        if (user_id && !isNaN(Number(user_id)) && Number(user_id) > 0) {
          localUserId = Number(user_id);
        } else if (user_email) {
          const user = await trx.prepare('SELECT id FROM users WHERE email = ?').get([user_email]);
          if (user) localUserId = user.id;
        }

        const variant = await trx.prepare('SELECT stock FROM variants WHERE id = ?').get([variant_id]);
        if (!variant) throw new Error('Variant not found');

        const newStock = variant.stock + (Number(quantity) || 0);
        await trx.prepare('UPDATE variants SET stock = ? WHERE id = ?').run([newStock, variant_id]);

        const eId = evento_id || crypto.randomUUID();
        await trx.prepare(`
          INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run([variant_id, localUserId, quantity, type, description, reason, eId]);
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Local Stock Update Error]:", error);
      res.status(500).json({ error: error.message || 'Stock update failed' });
    }
  });
  app.get('/api/products/:id/variants', async (req, res) => {
    try {
      const variants = await db.prepare('SELECT * FROM variants WHERE product_id = ?').all([req.params.id]);
      res.json(variants);
    } catch (error) {
      res.status(500).json({ error: 'Fetch variants failed' });
    }
  });
  app.get('/api/v1/sales', async (req, res) => {
    try {
      const sales = await db.prepare(`
        SELECT 
          s.*, 
          u.name as seller, 
          c.name as customer, 
          c.dni_tax_id as dni,
          (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count
        FROM sales s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN clients c ON s.client_id = c.id
        ORDER BY s.timestamp DESC
        LIMIT 200
      `).all();
      
      const salesWithItems = await Promise.all(sales.map(async (sale: any) => {
        const items = await db.prepare(`
          SELECT 
            si.*, 
            p.name, 
            v.color, 
            v.size,
            si.price_at_sale as price,
            si.quantity as qty
          FROM sale_items si
          JOIN variants v ON si.variant_id = v.id
          JOIN products p ON v.product_id = p.id
          WHERE si.sale_id = ?
        `).all([sale.id]);

        return { 
          ...sale, 
          items,
          customer: sale.customer || 'Consumidor Final',
          dni: sale.dni || '00-00000000-0',
          paymentMethod: sale.payment_method // Mapping for frontend
        };
      }));

      res.json(salesWithItems);
    } catch (error) {
      console.error("[Sales Fetch Error]:", error);
      res.status(500).json({ error: 'Fetch sales failed' });
    }
  });

  app.post('/api/sales/:id/void', async (req, res) => {
    const { id } = req.params;
    const { userId, reason } = req.body;
    try {
      await db.transaction(async (trx: any) => {
        const sale = await trx.prepare('SELECT * FROM sales WHERE id = ?').get([id]);
        if (!sale) throw new Error('Venta no encontrada');
        if (sale.status === 'voided') throw new Error('La venta ya ha sido anulada');

        const items = await trx.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all([id]);
        const eventoId = crypto.randomUUID();

        for (const item of items) {
          // Revert stock
          await trx.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?').run([item.quantity, item.variant_id]);
          
          // Log stock movement
          const payload = JSON.stringify({ 
            action: 'ANNUL_SALE', 
            sale_id: id,
            reverted_quantity: item.quantity 
          });
          await trx.prepare(`
            INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run([item.variant_id, userId || 1, item.quantity, 'INGRESO', 'Anulación de venta', reason || 'Anulación manual', eventoId, payload]);
        }

        // Mark sale as voided with details
        await trx.prepare('UPDATE sales SET status = ?, void_reason = ?, voided_at = CURRENT_TIMESTAMP WHERE id = ?').run(['voided', reason || 'Anulación manual', id]);
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Void Sale Error]:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/sales', async (req, res) => {
    const { clientId, userId, cart, total, discount, paymentMethod, payments } = req.body;
    try {
      const saleId = await db.transaction(async (trx: any) => {
        // Normalizar montos (si no vienen en 'payments', usar el total según el 'paymentMethod' legacy)
        const cash = payments?.cash || (paymentMethod === 'cash' ? total : 0);
        const credit = payments?.credit || (paymentMethod === 'credit' ? total : 0);
        const storeCredit = payments?.storeCredit || (paymentMethod === 'storeCredit' ? total : 0);

        // Si hay uso de Crédito de Tienda, validar contra el límite del cliente
        if (storeCredit > 0 && clientId) {
          const client = await trx.prepare('SELECT * FROM clients WHERE id = ?').get([clientId]);
          if (!client) throw new Error('Cliente no encontrado');
          if (client.debt_balance + storeCredit > client.credit_limit) {
            throw new Error(`Límite excedido. Saldo actual: $${client.debt_balance}. Límite: $${client.credit_limit}`);
          }
          await trx.prepare('UPDATE clients SET debt_balance = debt_balance + ? WHERE id = ?').run([storeCredit, clientId]);
        }

        const saleRes = await trx.prepare(`
          INSERT INTO sales (user_id, client_id, total, discount, payment_method, cash_amount, credit_amount, store_credit_amount) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run([
          userId, 
          clientId, 
          total, 
          discount, 
          paymentMethod, 
          cash, 
          credit, 
          storeCredit
        ]);

        const sId = saleRes.lastInsertRowid;
        const eventoId = req.body.evento_id || crypto.randomUUID();
        
        for (const item of cart) {
          await trx.prepare('INSERT INTO sale_items (sale_id, variant_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)').run([sId, item.id, item.quantity, item.pvp]);
          
          const currentVariant = await trx.prepare('SELECT * FROM variants WHERE id = ?').get([item.id]);
          await trx.prepare('UPDATE variants SET stock = stock - ? WHERE id = ?').run([item.quantity, item.id]);
          
          const payload = JSON.stringify({ 
            action: 'SALE', 
            sale_id: sId,
            before: { stock: currentVariant?.stock || 0, pvp: currentVariant?.pvp || 0 }, 
            after: { stock: (currentVariant?.stock || 0) - item.quantity, pvp: currentVariant?.pvp || 0 } 
          });
          await trx.prepare('INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run([item.id, userId, -item.quantity, 'EGRESO', 'Venta al público', `Sale #${sId}`, eventoId, payload]);
        }
        return sId;
      });
      res.json({ success: true, saleId });
    } catch (error: any) {
      console.error("[Sale Error]:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/inventory/bulk-entry', async (req, res) => {
    const { items, userId } = req.body;
    try {
      const eventoId = req.body.evento_id || crypto.randomUUID();
      await db.transaction(async (trx: any) => {
        for (const item of items) {
          const currentVariant = await trx.prepare('SELECT * FROM variants WHERE id = ?').get([item.variantId]);
          const payload = JSON.stringify({ 
            action: 'BULK_ENTRY', 
            before: { stock: currentVariant?.stock || 0, cost: currentVariant?.cost || 0 }, 
            after: { stock: (currentVariant?.stock || 0) + item.quantity, cost: item.cost || currentVariant?.cost || 0 } 
          });
          await trx.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?').run([item.quantity, item.variantId]);
          await trx.prepare('INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run([item.variantId, userId, item.quantity, 'INGRESO', 'Ingreso manual masivo', 'Manual Entry', eventoId, payload]);
        }
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Bulk entry failed' });
    }
  });

  app.get('/api/inventory/items', async (req, res) => {
    try {
      const items = await db.prepare(`
        SELECT 
          v.*, 
          p.name, 
          p.brand, 
          p.category, 
          p.barcode as product_barcode
        FROM variants v 
        JOIN products p ON v.product_id = p.id
        ORDER BY p.name ASC, v.sku ASC
      `).all();
      res.json(items || []);
    } catch (error) {
      console.error("[Inventory Fetch Error]:", error);
      res.json([]); // Return empty array on error as a safety measure
    }
  });


  app.post('/api/v1/inventory/annul/:evento_id', async (req, res) => {
    const { evento_id } = req.params;
    const { userId } = req.body;
    try {
      await db.transaction(async (trx: any) => {
        // Buscamos solo los movimientos originales que NO son de anulación y NO están anulados
        const movements = await trx.prepare('SELECT * FROM stock_movements WHERE evento_id = ? AND is_annulled = 0 AND type != ?').all([evento_id, 'ANULACION']);
        
        if (movements.length === 0) {
          throw new Error('No se encontraron movimientos activos para anular.');
        }

        for (const m of movements) {
          // Revertir el stock en la variante
          if (m.change_amount !== 0) {
            await trx.prepare('UPDATE variants SET stock = stock - ? WHERE id = ?').run([m.change_amount, m.variant_id]);
          }
          
          // Marcar el movimiento original como anulado
          await trx.prepare('UPDATE stock_movements SET is_annulled = 1 WHERE id = ?').run([m.id]);
          
          // Crear un movimiento de compensación (Audit Log)
          const payload = JSON.stringify({
            action: 'ANNULMENT',
            original_movement_id: m.id,
            reverted_amount: -m.change_amount,
            original_payload: m.payload_json ? JSON.parse(m.payload_json) : null
          });

          await trx.prepare(`
            INSERT INTO stock_movements 
            (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json, is_annulled) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run([
            m.variant_id, 
            userId || 1, 
            -m.change_amount, 
            'ANULACION', 
            `Anulación de ${m.type}: ${m.description}`, 
            `Ref: Sesión ${evento_id}`, 
            evento_id, 
            payload,
            1 // Los movimientos de anulación nacen "anulados" (o marcados como parte de una anulación)
          ]);
        }
      });
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Annul Error]:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/inventory/update', async (req, res) => {
    const { id, quantity, type, description, reason, userId, evento_id, payload_json } = req.body;
    try {
      const delta = type === 'INGRESO' ? quantity : (type === 'FINANCIERO' ? 0 : -quantity);
      await db.transaction(async (trx: any) => {
        const currentVariant = await trx.prepare('SELECT * FROM variants WHERE id = ?').get([id]);
        
        if (delta !== 0) {
          await trx.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?').run([delta, id]);
        }
        
        const updatedVariant = await trx.prepare('SELECT * FROM variants WHERE id = ?').get([id]);
        
        let payload = payload_json;
        if (!payload) {
          payload = JSON.stringify({ 
            action: 'MANUAL_UPDATE', 
            before: { stock: currentVariant?.stock, cost: currentVariant?.cost, pvp: currentVariant?.pvp }, 
            after: { stock: updatedVariant?.stock, cost: updatedVariant?.cost, pvp: updatedVariant?.pvp } 
          });
        }
        
        const finalEventoId = evento_id || crypto.randomUUID();

        await trx.prepare('INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run([
          id, userId || 1, delta, type, description || 'Ajuste manual', reason || 'Ajuste de inventario', finalEventoId, payload
        ]);
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[Inventory Update Error]:", error);
      res.status(500).json({ error: 'Update failed' });
    }
  });

  app.post('/api/inventory/mass-price-adjust', async (req, res) => {
    const { percentage, scope, userId } = req.body;
    try {
      const factor = 1 + (percentage / 100);
      const eventoId = crypto.randomUUID();
      await db.transaction(async (trx: any) => {
        await trx.prepare('UPDATE products SET base_price = base_price * ?').run([factor]);
        const variants = await trx.prepare('SELECT id, pvp FROM variants').all();
        await trx.prepare('UPDATE variants SET pvp = pvp * ?').run([factor]);
        
        for (const v of variants) {
          const payload = JSON.stringify({ 
            action: 'MASS_PRICE_ADJUST', 
            percentage,
            before: { pvp: v.pvp }, 
            after: { pvp: v.pvp * factor } 
          });
          await trx.prepare('INSERT INTO stock_movements (variant_id, user_id, change_amount, type, description, reason, evento_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run([v.id, userId || 1, 0, 'FINANCIERO', 'Ajuste masivo de precios', `Ajuste del ${percentage}%`, eventoId, payload]);
        }
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Mass adjust failed' });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist/index.html')));
  }

  app.listen(5000, '0.0.0.0', () => console.log(`Server at http://localhost:5000`));
}

startServer();
