import { Pool } from 'pg';
import type { Config } from '../config/env';

/** Contratos mínimos que usan los servicios; el Pool de `pg` los satisface y permite probar con dobles. */
export interface ClientLike {
  query(texto: string, parametros?: unknown[]): Promise<{ rows: any[] }>;
  release(): void;
}
export interface PoolLike {
  query(texto: string, parametros?: unknown[]): Promise<{ rows: any[] }>;
  connect(): Promise<ClientLike>;
}

export function crearPool(db: Config['db']): Pool {
  const pool = new Pool({
    host: db.host,
    port: db.port,
    database: db.database,
    user: db.user,
    password: db.password,
    max: 10,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err: Error) => console.error('[PostgreSQL] Error en una conexión inactiva:', err.message));
  return pool;
}
