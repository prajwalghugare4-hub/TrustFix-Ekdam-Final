import express from 'express';
import cors from 'cors';
import { PORT, CLIENT_ORIGIN } from './config/env.js';
import { checkDatabase, dbInfo } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import providerRoutes from './routes/providers.routes.js';
import servicesRoutes from './routes/services.routes.js';
import bookingRoutes from './routes/bookings.routes.js';
import reviewsRoutes from './routes/reviews.routes.js';
import profileRoutes from './routes/profile.routes.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

const app = express();

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/profile', profileRoutes);

/**
 * Health check: reports both the API and the MySQL connection/schema.
 * 200 = API and database ready; 503 = API up but database needs attention.
 */
async function healthHandler(req, res) {
  const database = await checkDatabase();
  const healthy = database.connected && database.schemaReady;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    api: 'ok',
    database: {
      connected: database.connected,
      name: database.name,
      host: `${dbInfo.host}:${dbInfo.port}`,
      schemaReady: database.schemaReady,
      missingTables: database.missingTables,
      ...(database.connected ? {} : { error: database.error }),
    },
  });
}

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`TrustFix API on port ${PORT}`);
  console.log(`Allowed frontend origin: ${CLIENT_ORIGIN}`);
  console.log(`MySQL target: ${dbInfo.user}@${dbInfo.host}:${dbInfo.port}/${dbInfo.name}`);

  const database = await checkDatabase();

  if (!database.connected) {
    const { code, message, address, port } = database.error;
    const where = address && port ? ` (${address}:${port})` : '';
    console.error(
      `[TrustFix API] MySQL connection FAILED [${code}]${where}: ${message}`,
    );
    console.error(
      '[TrustFix API] Start MySQL, then import database/trustfix.sql. /api/health will report when it is ready.',
    );
    return;
  }

  console.log(
    `[TrustFix API] MySQL connected to ${database.name} at ${dbInfo.host}:${dbInfo.port}`,
  );

  if (!database.schemaReady) {
    console.error(
      `[TrustFix API] Schema incomplete — missing tables: ${database.missingTables.join(', ')}. Import database/trustfix.sql.`,
    );
  }
});
