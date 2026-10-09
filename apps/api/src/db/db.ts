import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

export const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

/**
 * node-postgres documents this explicitly: a pool emits `error` when an *idle* client fails, and an
 * unhandled one takes the process down. The client is already removed from the pool by the time we
 * hear about it, so the only correct response is to note it and let the next query open a new one.
 */
pool.on('error', (err) => console.warn(`[db] idle client error: ${err?.message ?? err}`));
export const db: Db = drizzle(pool, { schema });
export { schema };
