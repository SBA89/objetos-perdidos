import { crearApp } from './app';
import { cargarConfig } from './config/env';
import { crearPool } from './database/pool';
import { AuditoriaService } from './services/AuditoriaService';

async function main(): Promise<void> {
  const config = cargarConfig();
  const pool = crearPool(config.db);
  // Falla rápido y con un mensaje claro si la base de datos no está disponible.
  await pool.query('SELECT 1');

  const auditoria = AuditoriaService.getInstance(config.auditoriaRuta);
  const app = crearApp({
    pool,
    auditoria,
    sessionSecret: config.sessionSecret,
    cookieSecure: config.cookieSecure,
  });

  const servidor = app.listen(config.puerto, () => {
    console.log(`Servidor listo en http://localhost:${config.puerto}`);
    console.log(`Auditoría: ${auditoria.rutaArchivo}`);
  });

  const cerrar = (): void => {
    console.log('\nCerrando servidor...');
    servidor.close(async () => {
      await auditoria.esperarPendientes();
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

main().catch((err: unknown) => {
  console.error('No se pudo iniciar la aplicación:', err instanceof Error ? err.message : err);
  process.exit(1);
});
