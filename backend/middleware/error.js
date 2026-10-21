import { isProduction } from '../config/env.js';
import { dbInfo, describeDatabaseError } from '../config/db.js';

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
  'ER_CON_COUNT_ERROR',
]);

const isDatabaseError = (error) => {
  const code = typeof error?.code === 'string' ? error.code : '';
  return (
    CONNECTION_ERROR_CODES.has(code) ||
    code.startsWith('ER_') ||
    code.startsWith('PROTOCOL_')
  );
};

/** User-facing message that names the actual failure without leaking secrets. */
function databaseFailure(error) {
  const endpoint = `${dbInfo.host}:${dbInfo.port}`;
  const { code } = describeDatabaseError(error);

  if (CONNECTION_ERROR_CODES.has(code)) {
    return {
      status: 503,
      message: `Cannot connect to MySQL at ${endpoint} (${code}). Make sure the MySQL server is running on that port.`,
    };
  }

  if (code === 'ER_ACCESS_DENIED_ERROR') {
    return {
      status: 503,
      message: `MySQL rejected the login for user "${dbInfo.user}". Check DB_USER and DB_PASSWORD in .env.`,
    };
  }

  if (code === 'ER_BAD_DB_ERROR') {
    return {
      status: 503,
      message: `The database "${dbInfo.name}" does not exist. Create it and import database/trustfix.sql.`,
    };
  }

  if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') {
    const match = /Table '([^']+)' doesn't exist/i.exec(
      error.sqlMessage || error.message || '',
    );
    const table = match ? ` ("${match[1]}")` : '';
    return {
      status: 503,
      message: `The database schema is incomplete or out of date${table}. Import database/trustfix.sql into "${dbInfo.name}".`,
    };
  }

  if (code === 'ER_TABLEACCESS_DENIED_ERROR' || code === 'ER_DBACCESS_DENIED_ERROR') {
    return {
      status: 503,
      message: `The MySQL user "${dbInfo.user}" is not allowed to read the "${dbInfo.name}" database. Grant it access or use another DB_USER.`,
    };
  }

  return {
    status: 500,
    message: 'The database query failed. Check the server console for the MySQL error code.',
  };
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: 'API route not found.' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  let status = error.status || 500;
  let message = error.message || 'Something went wrong. Please try again.';
  const databaseError = isDatabaseError(error);

  if (error.code === 'ER_DUP_ENTRY') {
    status = 409;
    const detail = (error.sqlMessage || '').toLowerCase();
    message = detail.includes('phone')
      ? 'An account with this phone number already exists.'
      : detail.includes('email')
        ? 'An account with this email already exists.'
        : 'That record already exists.';
  } else if (databaseError) {
    ({ status, message } = databaseFailure(error));
  }

  // Always surface the real MySQL code/message on the server console.
  // `describeDatabaseError` deliberately excludes the password and config.
  if (databaseError) {
    console.error(
      `[TrustFix API] ${req.method} ${req.originalUrl} -> ${status}`,
      describeDatabaseError(error),
    );
  } else if (status >= 500 && !isProduction) {
    console.error(`${req.method} ${req.originalUrl} -> ${status}`, error);
  }

  res.status(status).json({ message });
}
