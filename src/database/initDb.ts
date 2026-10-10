import { promises as fsp } from 'fs';
import path from 'path';
import { Client } from 'pg';
import { cargarEnv, configuracionBd } from '../config/env';

/**
 * Ejecuta sql/schema.sql y sql/seed.sql sobre la base indicada en .env (o sobre TEST_DB_NAME con --test).
 * La base de datos debe existir (CREATE DATABASE objetos_perdidos;). Equivale a usar psql, sin necesitar psql en el PATH.
 */
async function main(): Promise<void> {
  cargarEnv();
  const esPrueba = process.argv.includes('--test');
  const nombreBd = esPrueba ? process.env.TEST_DB_NAME : undefined;
  if (esPrueba && !nombreBd) throw new Error('Falta TEST_DB_NAME en el .env.');
  const cfg = configuracionBd(nombreBd);

  const cliente = new Client(cfg);
  await cliente.connect();
  try {
    for (const archivo of ['schema.sql', 'seed.sql']) {
      const sql = await fsp.readFile(path.resolve(process.cwd(), 'sql', archivo), 'utf8');
      await cliente.query(sql);
      console.log(`✔ ${archivo} aplicado en la base "${cfg.database}"`);
    }
  } finally {
    await cliente.end();
  }
}

main().catch((err: unknown) => {
  console.error('Error al inicializar la base de datos:', err instanceof Error ? err.message : err);
  process.exit(1);
});
