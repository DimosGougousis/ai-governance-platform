import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://governance:governance@localhost:5433/governance';

const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
export { schema };
