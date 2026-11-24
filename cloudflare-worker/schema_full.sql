-- ============================================================================
-- PTG PPJK Outstanding — Cloudflare D1 Full Database Schema (SQLite)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Main Shipments Table (Offline-first sync ready: updated_at, deleted_at, version)
CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  os_code TEXT NOT NULL UNIQUE,
  doc_os TEXT NOT NULL DEFAULT '',
  importer_code TEXT NOT NULL DEFAULT '',
  importer_name TEXT NOT NULL DEFAULT '',
  customer_code TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  bl_number TEXT NOT NULL DEFAULT '',
  packing_list TEXT NOT NULL DEFAULT '',
  aju_number TEXT NOT NULL DEFAULT '',
  nopen TEXT NOT NULL DEFAULT '',
  container_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Dokumen Diterima',
  doc_status TEXT NOT NULL DEFAULT 'Draft',
  jalur TEXT NOT NULL DEFAULT '',
  checker_name TEXT NOT NULL DEFAULT '',
  eta_date TEXT NOT NULL DEFAULT '',
  etd_date TEXT NOT NULL DEFAULT '',
  received_date TEXT NOT NULL DEFAULT '',
  sppb_date TEXT NOT NULL DEFAULT '',
  gate_out_date TEXT NOT NULL DEFAULT '',
  bm_pdri_amount REAL NOT NULL DEFAULT 0,
  is_urgent INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  deleted_at TEXT DEFAULT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_shipments_os_code ON shipments(os_code);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_importer_code ON shipments(importer_code);
CREATE INDEX IF NOT EXISTS idx_shipments_customer_code ON shipments(customer_code);
CREATE INDEX IF NOT EXISTS idx_shipments_checker_name ON shipments(checker_name);
CREATE INDEX IF NOT EXISTS idx_shipments_eta_date ON shipments(eta_date);
CREATE INDEX IF NOT EXISTS idx_shipments_bl_number ON shipments(bl_number);
CREATE INDEX IF NOT EXISTS idx_shipments_nopen ON shipments(nopen);
CREATE INDEX IF NOT EXISTS idx_shipments_updated_at ON shipments(updated_at);
CREATE INDEX IF NOT EXISTS idx_shipments_deleted_at ON shipments(deleted_at);

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  customer_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  deleted_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at);

-- 3. Importers Table
CREATE TABLE IF NOT EXISTS importers (
  id TEXT PRIMARY KEY,
  importer_code TEXT NOT NULL UNIQUE,
  importer_name TEXT NOT NULL,
  npwp TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  deleted_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_importers_code ON importers(importer_code);
CREATE INDEX IF NOT EXISTS idx_importers_updated_at ON importers(updated_at);

-- 4. Surat Jalan Table
CREATE TABLE IF NOT EXISTS surat_jalan (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  os_code TEXT NOT NULL,
  surat_jalan_number TEXT NOT NULL UNIQUE,
  issued_date TEXT NOT NULL DEFAULT '',
  driver_name TEXT NOT NULL DEFAULT '',
  truck_plate TEXT NOT NULL DEFAULT '',
  destination TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  delivery_status TEXT NOT NULL DEFAULT 'Belum',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  deleted_at TEXT DEFAULT NULL,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_surat_jalan_os_code ON surat_jalan(os_code);
CREATE INDEX IF NOT EXISTS idx_surat_jalan_status ON surat_jalan(delivery_status);
CREATE INDEX IF NOT EXISTS idx_surat_jalan_updated_at ON surat_jalan(updated_at);

-- 5. Billings Table
CREATE TABLE IF NOT EXISTS billings (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  os_code TEXT NOT NULL,
  billing_number TEXT NOT NULL UNIQUE,
  billing_date TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  total_amount REAL NOT NULL DEFAULT 0,
  billing_status TEXT NOT NULL DEFAULT 'Belum',
  owner_notified_at TEXT DEFAULT NULL,
  customer_sent_at TEXT DEFAULT NULL,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  deleted_at TEXT DEFAULT NULL,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_billings_os_code ON billings(os_code);
CREATE INDEX IF NOT EXISTS idx_billings_status ON billings(billing_status);
CREATE INDEX IF NOT EXISTS idx_billings_updated_at ON billings(updated_at);

-- 6. Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  shipment_id TEXT DEFAULT NULL,
  os_code TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT NOT NULL DEFAULT '',
  old_value TEXT NOT NULL DEFAULT '',
  new_value TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_os_code ON activity_logs(os_code);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
