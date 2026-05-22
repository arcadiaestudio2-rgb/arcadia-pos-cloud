import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import 'dotenv/config';
import pkg from 'pg';
import crypto from 'crypto';
const { Pool } = pkg;
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { normalizeAttributeValue } from './src/utils/validation';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const supabaseUrl = process.env.SUPABASE_URL || 'https://pzlkzoemyfefwgaywegn.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bGt6b2VteWZlZndnYXl3ZWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDUwNDQsImV4cCI6MjA5MTkyMTA0NH0.Xf5uKEQ0ztv1xWbt5ZwFraMMRQXMOsI3pE6jYYWCGz4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("[STARTUP] startServer() called");
  const app = express();
  const PORT = 5000;
  
  app.set('trust proxy', 1);

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true
  }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/debug-stats', async (req, res) => {
    const storeId = req.query.storeId as string;
    const { data } = await supabase.from('sales').select('id,total').eq('store_id', storeId).limit(3);
    res.json({ sales: data, count: data?.length || 0, supabaseUrl });
  });
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
        try {
          sqlite.prepare('BEGIN').run();
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      store_id TEXT,
      user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS catalog_attributes (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      store_id TEXT,
      UNIQUE(type, value, store_id)
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
      store_id TEXT,
      user_id INTEGER,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS clients (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      name TEXT NOT NULL,
      dni_tax_id TEXT UNIQUE NOT NULL,
      phone TEXT,
      debt_balance REAL DEFAULT 0,
      credit_limit REAL DEFAULT 20000,
      store_id TEXT,
      user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
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
      store_id TEXT,
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
      store_id TEXT,
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
      { name: 'voided_at', type: 'TIMESTAMP' },
      { name: 'ticket_url', type: 'TEXT' }
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

    const multiTenantTables = [
      'products', 'variants', 'clients', 'sales', 
      'stock_movements', 'catalog_attributes'
    ];

    for (const table of multiTenantTables) {
      try {
        if (isPostgres) {
          await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS store_id TEXT`);
        } else {
          await db.exec(`ALTER TABLE ${table} ADD COLUMN store_id TEXT`);
        }
        console.log(`✅ [Migration] Columna store_id añadida a ${table}`);
      } catch (e) { /* Column might exist */ }
    }

    // Generic user_id migration for critical tables
    const userTrackedTables = ['products', 'variants', 'clients'];
    for (const table of userTrackedTables) {
      try {
        if (isPostgres) {
          await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_id INTEGER`);
        } else {
          await db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`);
        }
      } catch (e) {}
    }
  };
  await applyMigrations();

  // Seed initial data
  const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (Number(userCount.count) === 0) {
    const hash = (pw: string) => bcrypt.hashSync(pw, 10);
    await db.prepare('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)').run(['Gabi', 'gabi@arcadia.com', 'admin', hash('admin123')]);
    await db.prepare('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)').run(['Lucas', 'lucas@arcadia.com', 'seller', hash('lucas123')]);
    await db.prepare('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)').run(['Sofi', 'sofi@arcadia.com', 'seller', hash('sofi123')]);
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
      const user = await db.prepare('SELECT * FROM users WHERE email = ?').get([email]);
      if (user && (await bcrypt.compare(password, user.password))) {
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

  const querySupabaseStats = async (storeId: string, timeFilter: string) => {
    try {
      const now = new Date();
      const dateStart = (() => {
        switch (timeFilter) {
          case 'Ayer': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          case 'Mes': return new Date(now.getFullYear(), now.getMonth(), 1);
          case 'Custom': return new Date(now.getTime() - 30 * 86400000);
          default: return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
      })();

      const { data: sales, error } = await supabase
        .from('sales')
        .select('id, total, payment_method, created_at, user_id')
        .eq('store_id', storeId)
        .gte('created_at', dateStart.toISOString());

      if (error) {
        console.error('[Supabase Stats Error]', error);
        return null;
      }

      const saleList = (Array.isArray(sales) ? sales : []).filter((r: any) => r.created_at);
      const revenue = saleList.reduce((s: number, r: any) => s + Number(r.total || 0), 0);
      const saleCount = saleList.length;

      // ── Weekly revenue ──────────────────────────────────────────────
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      const weeklyRevenue = new Array(7).fill(0);
      for (const r of saleList) {
        const d = new Date(r.created_at);
        if (isNaN(d.getTime())) continue;
        const offset = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - weekStart.getTime()) / 86400000);
        if (offset >= 0 && offset < 7) weeklyRevenue[offset] += Number(r.total || 0);
      }

      // ── Payment mix ─────────────────────────────────────────────────
      const paymentMix: Record<string, number> = { Efectivo: 0, Débito: 0, Crédito: 0, Transferencia: 0, CuentaCorriente: 0 };
      const pmtMap: Record<string, string> = {
        cash: 'Efectivo', efectivo: 'Efectivo',
        debit: 'Débito', debito: 'Débito',
        credit: 'Crédito', credito: 'Crédito',
        qr: 'Transferencia', transferencia: 'Transferencia',
        storecredit: 'CuentaCorriente', 'cuenta corriente': 'CuentaCorriente',
      };
      for (const r of saleList) {
        const raw = String(r.payment_method || '').trim().toLowerCase();
        const key = pmtMap[raw] || 'Efectivo';
        paymentMix[key] = (paymentMix[key] || 0) + Number(r.total || 0);
      }

      // ── Peak hours ──────────────────────────────────────────────────
      const peakHours = new Array(24).fill(0);
      for (const r of saleList) {
        const d = new Date(r.created_at);
        if (isNaN(d.getTime())) continue;
        const h = d.getHours();
        if (h >= 0 && h < 24) peakHours[h]++;
      }

      // ── Critical stock from Supabase ──────────────────────────────────
      let criticalStock: any[] = [];
      try {
        const { data: supabaseVariants, error: svErr } = await supabase
          .from('variants')
          .select('id, product_id, sku, stock, stock_minimo')
          .eq('store_id', storeId)
          .gt('stock_minimo', 0);
        if (!svErr && supabaseVariants) {
          const lowStock = supabaseVariants
            .filter((v: any) => Number(v.stock) <= Number(v.stock_minimo))
            .slice(0, 5);
          if (lowStock.length > 0) {
            const pIds = [...new Set(lowStock.map((v: any) => v.product_id))];
            const { data: supabaseProducts } = await supabase
              .from('products')
              .select('id, name')
              .in('id', pIds);
            const pMap = Object.fromEntries((supabaseProducts || []).map((p: any) => [p.id, p.name]));
            criticalStock = lowStock.map((v: any) => ({
              id: v.id, name: pMap[v.product_id] || 'Unknown', sku: v.sku, stock: v.stock, min: v.stock_minimo
            }));
          }
        }
      } catch (e) { /* RLS or table missing */ }

      // ── Aging debtors from Supabase ───────────────────────────────────
      let agingDebtors: any[] = [];
      try {
        const { data: supabaseClients, error: scErr } = await supabase
          .from('clients')
          .select('id, name, debt_balance')
          .eq('store_id', storeId)
          .gt('debt_balance', 0)
          .order('debt_balance', { ascending: false })
          .limit(5);
        if (!scErr && supabaseClients) {
          agingDebtors = supabaseClients.map((c: any) => ({ id: c.id, name: c.name, debt: c.debt_balance, days: 0 }));
        }
      } catch (e) { /* RLS or table missing */ }

      // ── Dead stock from Supabase ──────────────────────────────────────
      let deadStock: any[] = [];
      try {
        const { data: supabaseVariants, error: dsvErr } = await supabase
          .from('variants')
          .select('id, product_id, sku, stock, pvp')
          .eq('store_id', storeId)
          .gt('stock', 0);
        if (!dsvErr && supabaseVariants) {
          const pIds = [...new Set(supabaseVariants.map((v: any) => v.product_id))];
          const { data: supabaseProducts } = await supabase
            .from('products')
            .select('id, name')
            .in('id', pIds);
          const pMap = Object.fromEntries((supabaseProducts || []).map((p: any) => [p.id, p.name]));
          const variantIds = supabaseVariants.map((v: any) => v.id);
          let lastSaleMap: Record<number, string> = {};
          try {
            const { data: saleItems } = await supabase
              .from('sale_items')
              .select('variant_id, sale_id')
              .in('variant_id', variantIds);
            if (saleItems) {
              const saleIds = [...new Set(saleItems.map((si: any) => si.sale_id))];
              const { data: recentSales } = await supabase
                .from('sales')
                .select('id, timestamp')
                .in('id', saleIds);
              const saleTimeMap = Object.fromEntries((recentSales || []).map((s: any) => [s.id, s.timestamp]));
              for (const si of saleItems) {
                const ts = saleTimeMap[si.sale_id];
                if (ts && (!lastSaleMap[si.variant_id] || ts > lastSaleMap[si.variant_id])) {
                  lastSaleMap[si.variant_id] = ts;
                }
              }
            }
          } catch (e) { /* sale_items may not be accessible */ }
          deadStock = supabaseVariants
            .map((v: any) => ({
              uuid: v.id, name: pMap[v.product_id] || 'Unknown', sku: v.sku,
              stock: v.stock, loss: (v.pvp || 0) * v.stock,
              last_sale_date: lastSaleMap[v.id] || '2000-01-01'
            }))
            .sort((a: any, b: any) => a.last_sale_date.localeCompare(b.last_sale_date))
            .slice(0, 5);
        }
      } catch (e) { /* RLS or table missing */ }

      console.log('[Dashboard] Supabase fallback OK', { sales: saleCount, revenue, criticalStock: criticalStock.length });

      return {
        revenue,
        cost: 0,
        ar: 0,
        topSeller: { name: 'N/A', revenue: 0, sales: 0 },
        criticalStock, agingDebtors, deadStock,
        weeklyRevenue,
        weeklyCost: new Array(7).fill(0),
        paymentMix,
        peakHours,
        avgTicket: saleCount > 0 ? Math.round(revenue / saleCount) : 0,
        discountImpact: 0,
        periodTotalSales: saleCount,
      };
    } catch (e) {
      console.error('[Supabase Fallback Error]', e);
      return null;
    }
  };

  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const timeFilter = (req.query.timeFilter as string) || 'Hoy';
      const storeId = req.query.storeId as string;

      // ── Check if local DB has sales → fallback to Supabase ──────────
      const localCount = await db.prepare('SELECT COUNT(*) as n FROM sales').get();
      if (localCount?.n === 0 && storeId) {
        const supabaseData = await querySupabaseStats(storeId, timeFilter);
        if (supabaseData !== null) {
          console.log('[Dashboard] Supabase + Supabase inventory merge');
          return res.json(supabaseData);
        }
        console.log('[Dashboard] Supabase fallback null — usando SQLite local');
      }

      // ── Date window from timeFilter ──────────────────────────────────
      const dateStart = (() => {
        switch (timeFilter) {
          case 'Ayer': return isPostgres ? "CURRENT_DATE - INTERVAL '1 day'" : "date('now', '-1 day')";
          case 'Mes': return isPostgres ? "date_trunc('month', CURRENT_DATE)::date" : "date('now', 'start of month')";
          case 'Custom': return isPostgres ? "CURRENT_DATE - INTERVAL '30 days'" : "date('now', '-30 days')";
          default: return isPostgres ? "CURRENT_DATE" : "date('now')";
        }
      })();

      const sanitizedStoreId = storeId ? storeId.replace(/'/g, "''") : null;
      const storeFilter = sanitizedStoreId ? `AND store_id = '${sanitizedStoreId}'` : '';
      const storeFilterS = sanitizedStoreId ? `AND s.store_id = '${sanitizedStoreId}'` : '';

      // ── Helper: zero-filled arrays ───────────────────────────────────
      const weeklyRevenue = new Array(7).fill(0);
      const weeklyCost = new Array(7).fill(0);

      // ── 1. Weekly revenue trend (last 7 days, always) ────────────────
      const weeklyLimit = isPostgres ? "CURRENT_DATE - INTERVAL '6 days'" : "date('now', '-6 days')";
      const dateFn = isPostgres ? (col: string) => `${col}::date` : (col: string) => `DATE(${col})`;

      const weeklyRevenueRows = await db.prepare(`
        SELECT ${dateFn('timestamp')} as day, SUM(total) as revenue
        FROM sales
        WHERE timestamp >= ${weeklyLimit} ${storeFilter}
        GROUP BY ${dateFn('timestamp')}
        ORDER BY day ASC
      `).all();

      const weeklyCostRows = await db.prepare(`
        SELECT ${dateFn('s.timestamp')} as day, SUM(si.quantity * p.cost) as cost
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        JOIN variants v ON si.variant_id = v.id
        JOIN products p ON v.product_id = p.id
        WHERE s.timestamp >= ${weeklyLimit} ${storeFilterS}
        GROUP BY ${dateFn('s.timestamp')}
        ORDER BY day ASC
      `).all();

      // Map results into zero-filled arrays by day offset
      const today = new Date();
      for (const row of weeklyRevenueRows) {
        const dayOffset = Math.round((new Date(row.day + 'T00:00:00').getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime()) / 86400000);
        if (dayOffset >= 0 && dayOffset < 7) weeklyRevenue[dayOffset] = Number(row.revenue) || 0;
      }
      for (const row of weeklyCostRows) {
        const dayOffset = Math.round((new Date(row.day + 'T00:00:00').getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime()) / 86400000);
        if (dayOffset >= 0 && dayOffset < 7) weeklyCost[dayOffset] = Number(row.cost) || 0;
      }

      // ── 2. Period summary numbers ────────────────────────────────────
      const periodSales = await db.prepare(`
        SELECT COALESCE(SUM(total), 0) as revenue, COALESCE(SUM(discount), 0) as discount, COUNT(*) as count
        FROM sales WHERE timestamp >= ${dateStart} ${storeFilter}
      `).get();

      const periodCost = await db.prepare(`
        SELECT COALESCE(SUM(si.quantity * p.cost), 0) as cost
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        JOIN variants v ON si.variant_id = v.id
        JOIN products p ON v.product_id = p.id
        WHERE s.timestamp >= ${dateStart} ${storeFilterS}
      `).get();

      const totalAr = await db.prepare('SELECT COALESCE(SUM(debt_balance), 0) as sum FROM clients').get();

      // ── 3. Payment mix (within period) ───────────────────────────────
      const paymentRows = await db.prepare(`
        SELECT payment_method, SUM(total) as amount
        FROM sales WHERE timestamp >= ${dateStart} ${storeFilter}
        GROUP BY payment_method
      `).all();

      const paymentMix: Record<string, number> = { Efectivo: 0, Débito: 0, Crédito: 0, Transferencia: 0, CuentaCorriente: 0 };
      const paymentMap: Record<string, string> = {
        cash: 'Efectivo', efectivo: 'Efectivo', Efectivo: 'Efectivo',
        debit: 'Débito', debito: 'Débito', Débito: 'Débito', débito: 'Débito',
        credit: 'Crédito', credito: 'Crédito', Crédito: 'Crédito', crédito: 'Crédito',
        qr: 'Transferencia', transferencia: 'Transferencia',
        storeCredit: 'CuentaCorriente', 'Cuenta Corriente': 'CuentaCorriente',
      };
      for (const row of paymentRows) {
        const key = paymentMap[row.payment_method] || row.payment_method;
        if (key in paymentMix) paymentMix[key] += Number(row.amount) || 0;
        else paymentMix[key] = Number(row.amount) || 0;
      }

      // ── 4. Peak hours (within period) ────────────────────────────────
      const peakHours = new Array(24).fill(0);
      const hourFn = isPostgres ? "EXTRACT(HOUR FROM timestamp)::int" : "CAST(strftime('%H', timestamp) AS INTEGER)";
      const hourRows = await db.prepare(`
        SELECT ${hourFn} as hour, COUNT(*) as count
        FROM sales WHERE timestamp >= ${dateStart} ${storeFilter}
        GROUP BY ${hourFn}
        ORDER BY hour ASC
      `).all();
      for (const row of hourRows) {
        const h = Number(row.hour);
        if (h >= 0 && h < 24) peakHours[h] = Number(row.count) || 0;
      }

      // ── 5. Top seller (within period) ────────────────────────────────
      const topSeller = await db.prepare(`
        SELECT u.name, SUM(s.total) as revenue, COUNT(s.id) as sales
        FROM sales s
        JOIN users u ON s.user_id = u.id
        WHERE s.timestamp >= ${dateStart} ${storeFilter}
        GROUP BY u.name
        ORDER BY revenue DESC
        LIMIT 1
      `).get();

      // ── 6. Critical stock (all time, state-based) ────────────────────
      const criticalStock = await db.prepare(`
        SELECT v.id, p.name, v.sku, v.stock, v.stock_minimo as min
        FROM variants v
        JOIN products p ON v.product_id = p.id
        WHERE v.stock <= v.stock_minimo AND v.stock_minimo > 0
        LIMIT 5
      `).all();

      // ── 7. Aging debtors ─────────────────────────────────────────────
      const agingDebtors = await db.prepare(`
        SELECT id, name, debt_balance as debt,
               ${isPostgres ? "COALESCE(EXTRACT(DAY FROM NOW() - (SELECT MAX(timestamp) FROM sales WHERE client_id = clients.id)), 0)" : "COALESCE(CAST(julianday('now') - julianday((SELECT MAX(timestamp) FROM sales WHERE client_id = clients.id)) AS INTEGER), 0)"} as days
        FROM clients
        WHERE debt_balance > 0
        ORDER BY debt DESC
        LIMIT 5
      `).all() as any[];

      // ── 8. Dead stock ────────────────────────────────────────────────
      const deadStock = await db.prepare(`
        SELECT v.id as uuid, p.name, v.sku, v.stock,
               (v.pvp * v.stock) as loss,
               COALESCE((SELECT MAX(timestamp) FROM sales s JOIN sale_items si ON s.id = si.sale_id WHERE si.variant_id = v.id), '2000-01-01') as last_sale_date
        FROM variants v
        JOIN products p ON v.product_id = p.id
        WHERE v.stock > 0
        ORDER BY last_sale_date ASC
        LIMIT 5
      `).all();

      const revenue = Number(periodSales?.revenue) || 0;
      const cost = Number(periodCost?.cost) || 0;
      const discount = Number(periodSales?.discount) || 0;
      const saleCount = Number(periodSales?.count) || 0;

      res.json({
        revenue,
        cost,
        ar: Number(totalAr?.sum) || 0,
        topSeller: topSeller || { name: 'N/A', revenue: 0, sales: 0 },
        criticalStock,
        agingDebtors,
        deadStock,
        weeklyRevenue,
        weeklyCost,
        paymentMix,
        peakHours,
        avgTicket: saleCount > 0 ? Math.round(revenue / saleCount) : 0,
        discountImpact: revenue > 0 ? Math.round((discount / revenue) * 100) : 0,
        periodTotalSales: saleCount
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
    const rawValue = (req.body.value || '').trim();
    const type = (req.body.type || '').trim().toLowerCase();
    const normalizedValue = normalizeAttributeValue(rawValue);

    if (!type || !rawValue) {
      return res.status(400).json({ error: 'type y value son requeridos' });
    }

    try {
      const existing = await db.prepare(
        'SELECT id FROM catalog_attributes WHERE type = ? AND value = ?'
      ).get([type, normalizedValue]);

      if (existing) {
        return res.status(409).json({ exists: true, message: `"${rawValue}" ya existe` });
      }

      await db.prepare(
        'INSERT INTO catalog_attributes (type, value) VALUES (?, ?)'
      ).run([type, rawValue]);

      res.status(201).json({ success: true, value: rawValue });
    } catch (error: any) {
      if (error?.code === 'SQLITE_CONSTRAINT' || error?.code === '23505') {
        return res.status(409).json({ exists: true, message: `"${rawValue}" ya existe` });
      }
      console.error('[Create Attribute Error]:', error);
      res.status(500).json({ error: 'Error al crear atributo' });
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

  // ─── PDF TICKET GENERATION ──────────────────────────────────────
  app.post('/api/sales/:id/generate-pdf', async (req, res) => {
    const { id } = req.params;
    try {
      // 1. Get items and sale data — prefer body, fallback to DB lookup
      let sale: any;
      let items: any[];
      const { items: bodyItems, sale: bodySale } = req.body || {};

      if (bodyItems && bodySale) {
        // Client passed items directly (no DB needed)
        sale = bodySale;
        items = bodyItems.map((i: any) => ({
          product_name: i.name || i.product_name || 'Producto',
          price_at_sale: Number(i.price_at_sale || i.price || 0),
          quantity: Number(i.quantity || i.qty || 1),
          size: i.size || '',
          color: i.color || '',
        }));
      } else {
        // Fallback: try local SQLite
        sale = await db.prepare('SELECT * FROM sales WHERE id = ?').get([id]);
        if (sale) {
          items = await db.prepare(`
            SELECT si.*, p.name as product_name, v.color, v.size, v.sku
            FROM sale_items si
            JOIN variants v ON si.variant_id = v.id
            JOIN products p ON v.product_id = p.id
            WHERE si.sale_id = ?
          `).all([id]);
        } else {
          // Fallback: try Supabase cloud
          const { data: cloudSale, error: saleErr } = await supabase
            .from('sales')
            .select('*, clients(name, dni_tax_id)')
            .eq('id', id)
            .single();

          if (saleErr || !cloudSale) {
            return res.status(404).json({ error: 'Venta no encontrada' });
          }
          sale = cloudSale;

          const { data: cloudItems } = await supabase
            .from('sale_items')
            .select('*, variants(sku, product:products(name), size, color)')
            .eq('sale_id', id);

          items = (cloudItems || []).map((ci: any) => ({
            price_at_sale: ci.price_at_sale,
            quantity: ci.quantity,
            product_name: ci.variants?.product?.name || 'Producto',
            sku: ci.variants?.sku || '',
            size: ci.variants?.size || '',
            color: ci.variants?.color || '',
          }));
        }
      }

      // 2. Generate PDF in memory
      const doc = new PDFDocument({
        size: [227, 1000],
        margin: 12,
        bufferPages: false
      });

      const buffers: Buffer[] = [];
      const stream = doc.pipe(new PassThrough());
      stream.on('data', (chunk: Buffer) => buffers.push(chunk));

      const fmt = (val: number) =>
        `$${Number(val || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

      doc.font('Courier').fontSize(8);

      // Header
      doc.fontSize(11).text('ARCADIA', { align: 'center', lineGap: 2 });
      doc.fontSize(7).text('Ticket de Venta', { align: 'center', lineGap: 4 });
      doc.fontSize(6).text(`ID: ${id}`, { align: 'center', lineGap: 2 });
      doc.fontSize(6).text(
        format(new Date(sale.timestamp || sale.created_at), "dd/MM/yyyy HH:mm", { locale: es }),
        { align: 'center' }
      );
      doc.moveDown(1);

      // Separator
      const sep = () => { doc.fontSize(6).text('─'.repeat(30), { align: 'center' }); };
      sep();
      doc.moveDown(0.3);

      // Items table header
      doc.fontSize(6);
      doc.text('Producto', { continued: true });
      doc.text('Cant', { width: 30, align: 'right', continued: true });
      doc.text('Total', { width: 55, align: 'right' });
      sep();
      doc.moveDown(0.2);

      // Items
      for (const item of items) {
        const total = Number(item.price_at_sale) * Number(item.quantity);
        const name = (item.product_name || 'Producto').substring(0, 22);
        const variant = [item.size, item.color].filter(Boolean).join('/');

        doc.fontSize(6).text(name, { lineGap: 0.5 });
        if (variant) {
          doc.fontSize(5).text(variant, { lineGap: 0.5 });
        }
        doc.text('', { continued: true });
        doc.text(`x${item.quantity}`, { width: 30, align: 'right', continued: true });
        doc.text(fmt(total), { width: 55, align: 'right' });
        doc.moveDown(0.2);
      }

      // Totals
      doc.moveDown(0.2);
      sep();
      doc.moveDown(0.3);

      const bruto = items.reduce((s, i) => s + Number(i.price_at_sale) * Number(i.quantity), 0);
      const bonificaciones = Number(sale.discount || 0);

      doc.fontSize(6);
      doc.text('Bruto', { continued: true });
      doc.text(fmt(bruto), { width: 55, align: 'right' });
      doc.moveDown(0.3);
      doc.text('Bonificaciones', { continued: true });
      doc.text(`-${fmt(bonificaciones)}`, { width: 55, align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(8).font('Courier-Bold');
      doc.text('Total Cobrado', { continued: true });
      doc.text(fmt(Number(sale.total)), { width: 55, align: 'right' });
      doc.font('Courier');
      doc.moveDown(1);

      // Payment methods
      sep();
      doc.moveDown(0.3);
      doc.fontSize(6).text('Instrumentos de Pago', { align: 'center', lineGap: 3 });

      const payments = [
        { label: 'Efectivo', amount: Number(sale.cash_amount || 0) },
        { label: 'Tarjeta/Deb', amount: Number(sale.credit_amount || 0) },
        { label: 'Cta Cte', amount: Number(sale.store_credit_amount || 0) },
      ];
      for (const p of payments) {
        if (p.amount > 0) {
          doc.text(p.label, { continued: true });
          doc.text(fmt(p.amount), { width: 55, align: 'right' });
          doc.moveDown(0.2);
        }
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(7).text('¡Gracias por tu compra!', { align: 'center' });
      doc.fontSize(5).text('arcadia-pos.app', { align: 'center' });

      doc.end();

      // Wait for the PDF to be fully generated
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        stream.on('finish', () => resolve(Buffer.concat(buffers)));
        stream.on('error', reject);
      });

      // 3. Upload to Supabase Storage (auto-create bucket if needed)
      const BUCKET_NAME = 'tickets-pdf';
      let publicUrl: string;
      const filePath = `${id}.pdf`;

      // Try upload, create bucket on "not found", then retry
      const uploadToSupabase = async (): Promise<string> => {
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadError) {
          if (uploadError.message?.includes('Bucket not found')) {
            const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, { public: true });
            if (createError) {
              throw new Error(`No se pudo crear el bucket '${BUCKET_NAME}'. Créalo manualmente en Supabase Dashboard > Storage.`);
            }
            // Retry upload
            const { error: retryError } = await supabase.storage
              .from(BUCKET_NAME)
              .upload(filePath, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true
              });
            if (retryError) throw new Error(`Error al subir el PDF: ${retryError.message}`);
          } else {
            throw new Error(`Error al subir el PDF: ${uploadError.message}`);
          }
        }

        const { data: { publicUrl: url } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);
        return url;
      };

      try {
        publicUrl = await uploadToSupabase();
      } catch (storageErr: any) {
        // Fallback: serve PDF locally
        console.warn('[PDF Storage Fallback]', storageErr.message);
        const ticketsDir = path.join(process.cwd(), 'tickets');
        fs.mkdirSync(ticketsDir, { recursive: true });
        fs.writeFileSync(path.join(ticketsDir, filePath), pdfBuffer);
        publicUrl = `/tickets/${filePath}`;
      }

      // 3b. Serve local tickets directory if not already
      if (!app._router?.stack?.some?.((m: any) => m.route === '/tickets')) {
        app.use('/tickets', express.static(path.join(process.cwd(), 'tickets')));
      }

      // 4. Update DB with ticket_url (best-effort: try local + cloud)
      try { await db.prepare('UPDATE sales SET ticket_url = ? WHERE id = ?').run([publicUrl, id]); } catch {}
      try { await supabase.from('sales').update({ ticket_url: publicUrl }).eq('id', id); } catch {}

      // 5. Response
      res.json({ success: true, ticketUrl: publicUrl });

    } catch (error: any) {
      console.error('[PDF Generation Error]:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al generar el ticket PDF'
      });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true, proxy: {} }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist/index.html')));
  }

  app.listen(5000, '0.0.0.0', () => console.log(`Server at http://localhost:5000`));
}

startServer();
