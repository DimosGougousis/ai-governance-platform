#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
until node -e "
  const pg = require('postgres');
  const sql = pg(process.env.DATABASE_URL, { max: 1, connect_timeout: 3 });
  sql\`SELECT 1\`.then(() => { sql.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "  PostgreSQL not ready, retrying in 2s..."
  sleep 2
done
echo "PostgreSQL is ready."

echo "Running migrations..."
node dist/db/migrate.js
echo "Migrations complete."

echo "Starting API server..."
exec node dist/server.js
