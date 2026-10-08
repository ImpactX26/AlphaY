import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

export const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
export const db: Db = drizzle(pool, { schema });
export { schema };
