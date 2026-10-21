import './env.js';
import mysql from 'mysql2/promise';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_NAME = process.env.DB_NAME || 'trustfix';

/** Safe connection details for logs and the health endpoint (never the password). */
export const dbInfo = {
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  name: DB_NAME,
};

/** Tables the API relies on. Signup touches users + customers (or providers). */
const REQUIRED_TABLES = [
  'users',
  'customers',
  'categories',
  'service_providers',
  'services',
  'bookings',
  'reviews',
];

/**
 * Shared MySQL pool. `dateStrings` keeps DATE/DATETIME values as strings so
 * the API never shifts a preferred booking date across timezones.
 */
export const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4',
});

/** Reduced, password-free view of a MySQL error for server logs. */
export function describeDatabaseError(error) {
  return {
    code: error?.code || 'UNKNOWN',
    errno: error?.errno,
    sqlState: error?.sqlState,
    message:
      error?.sqlMessage ||
      error?.message ||
      `MySQL reported ${error?.code || 'an unknown error'} without a message.`,
    address: error?.address,
    port: error?.port,
    syscall: error?.syscall,
  };
}

/**
 * Verifies that MySQL answers and that every table the API needs exists.
 * Never throws: the server should boot and let /api/health report the problem.
 */
export async function checkDatabase() {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS name');
    const [tables] = await pool.query(
      `SELECT table_name AS name
         FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN (?)`,
      [REQUIRED_TABLES],
    );

    const found = new Set(tables.map((row) => row.name));
    const missingTables = REQUIRED_TABLES.filter((table) => !found.has(table));

    return {
      connected: true,
      name: rows[0]?.name || DB_NAME,
      schemaReady: missingTables.length === 0,
      missingTables,
    };
  } catch (error) {
    return {
      connected: false,
      name: DB_NAME,
      schemaReady: false,
      missingTables: [],
      error: describeDatabaseError(error),
    };
  }
}
