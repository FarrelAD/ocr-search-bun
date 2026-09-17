import mysql from "mysql2/promise";

export interface MySQLConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

export interface ImageInsert {
  path: string;
  hash: string;
  file_size: number;
  mtime: number;
  width?: number | null;
  height?: number | null;
  ocr_text: string;
  confidence: number;
}

export interface ImageRecord {
  id: number;
  path: string;
  hash: string;
  file_size: number;
  mtime: number;
  width: number | null;
  height: number | null;
  ocr_text: string;
  confidence: number;
  created_at: number;
  updated_at: number;
}

export interface SearchResult extends ImageRecord {
  score: number;
}

export interface DatabaseStats {
  totalImages: number;
  totalTextBytes: number;
  avgConfidence: number;
  lastScannedAt: number | null;
}

let activePool: mysql.Pool | null = null;

export function getDefaultConfig(config?: MySQLConfig): Required<MySQLConfig> {
  return {
    host: config?.host || process.env.MYSQL_HOST || "127.0.0.1",
    port: config?.port || Number(process.env.MYSQL_PORT) || 3306,
    user: config?.user || process.env.MYSQL_USER || "root",
    password: config?.password ?? process.env.MYSQL_PASSWORD ?? "",
    database: config?.database || process.env.MYSQL_DATABASE || "ocr_search",
  };
}

export async function initDb(config?: MySQLConfig): Promise<mysql.Pool> {
  const cfg = getDefaultConfig(config);

  // First connect to MySQL server without database specified to create database if missing
  const adminConn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
  });

  await adminConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await adminConn.end();

  // Now create connection pool with database selected
  activePool = mysql.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Verify / Create `images` table with FULLTEXT index
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      path VARCHAR(512) UNIQUE NOT NULL,
      hash VARCHAR(64) NOT NULL,
      file_size BIGINT NOT NULL,
      mtime BIGINT NOT NULL,
      width INT NULL,
      height INT NULL,
      ocr_text LONGTEXT NOT NULL,
      confidence FLOAT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      FULLTEXT INDEX idx_ocr_text (ocr_text)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await activePool.query(createTableQuery);

  return activePool;
}

export function getPool(dbPool?: mysql.Pool): mysql.Pool {
  const pool = dbPool || activePool;
  if (!pool) {
    throw new Error("Database pool not initialized. Call initDb() first.");
  }
  return pool;
}

export async function closeDb(dbPool?: mysql.Pool): Promise<void> {
  const pool = dbPool || activePool;
  if (pool) {
    await pool.end();
    if (pool === activePool) {
      activePool = null;
    }
  }
}

export async function upsertImage(
  data: ImageInsert,
  dbPool?: mysql.Pool
): Promise<ImageRecord> {
  const pool = getPool(dbPool);
  const now = Date.now();

  const query = `
    INSERT INTO images (
      path, hash, file_size, mtime, width, height, ocr_text, confidence, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      hash = VALUES(hash),
      file_size = VALUES(file_size),
      ocr_text = VALUES(ocr_text),
      confidence = VALUES(confidence),
      width = VALUES(width),
      height = VALUES(height),
      mtime = VALUES(mtime),
      updated_at = VALUES(updated_at);
  `;

  const params = [
    data.path,
    data.hash,
    data.file_size,
    data.mtime,
    data.width ?? null,
    data.height ?? null,
    data.ocr_text,
    data.confidence,
    now,
    now,
  ];

  await pool.query(query, params);

  const record = await getImageByPath(data.path, pool);
  if (!record) {
    throw new Error(`Failed to retrieve upserted image record for path: ${data.path}`);
  }
  return record;
}

export async function getImageByPath(
  path: string,
  dbPool?: mysql.Pool
): Promise<ImageRecord | null> {
  const pool = getPool(dbPool);
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT * FROM images WHERE path = ?",
    [path]
  );
  if (rows.length === 0) return null;
  return rows[0] as ImageRecord;
}

export async function getImageByHash(
  hash: string,
  dbPool?: mysql.Pool
): Promise<ImageRecord | null> {
  const pool = getPool(dbPool);
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT * FROM images WHERE hash = ?",
    [hash]
  );
  if (rows.length === 0) return null;
  return rows[0] as ImageRecord;
}

export async function getAllImages(
  options?: { limit?: number; offset?: number },
  dbPool?: mysql.Pool
): Promise<{ images: ImageRecord[]; total: number }> {
  const pool = getPool(dbPool);
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const [countRows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM images"
  );
  const total = Number(countRows[0]?.total || 0);

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT * FROM images ORDER BY updated_at DESC LIMIT ? OFFSET ?",
    [limit, offset]
  );

  return { images: rows as ImageRecord[], total };
}

export async function searchImages(
  query: string,
  options?: { limit?: number; offset?: number },
  dbPool?: mysql.Pool
): Promise<SearchResult[]> {
  const pool = getPool(dbPool);
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const sql = `
    SELECT id, path, hash, file_size, mtime, width, height, ocr_text, confidence, created_at, updated_at,
           MATCH(ocr_text) AGAINST(? IN BOOLEAN MODE) AS score
    FROM images
    WHERE MATCH(ocr_text) AGAINST(? IN BOOLEAN MODE)
    ORDER BY score DESC, updated_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, [
    trimmed,
    trimmed,
    limit,
    offset,
  ]);

  return rows as SearchResult[];
}

export async function deleteImage(
  path: string,
  dbPool?: mysql.Pool
): Promise<boolean> {
  const pool = getPool(dbPool);
  const [result] = await pool.query<mysql.ResultSetHeader>(
    "DELETE FROM images WHERE path = ?",
    [path]
  );
  return result.affectedRows > 0;
}

export async function getStats(dbPool?: mysql.Pool): Promise<DatabaseStats> {
  const pool = getPool(dbPool);
  const sql = `
    SELECT 
      COUNT(*) AS totalImages,
      COALESCE(SUM(LENGTH(ocr_text)), 0) AS totalTextBytes,
      COALESCE(AVG(confidence), 0) AS avgConfidence,
      MAX(updated_at) AS lastScannedAt
    FROM images
  `;
  const [rows] = await pool.query<mysql.RowDataPacket[]>(sql);
  const r = rows[0] || {};
  return {
    totalImages: Number(r.totalImages || 0),
    totalTextBytes: Number(r.totalTextBytes || 0),
    avgConfidence: Number(r.avgConfidence || 0),
    lastScannedAt: r.lastScannedAt ? Number(r.lastScannedAt) : null,
  };
}
