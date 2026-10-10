import path from 'path';

export interface Config {
  puerto: number;
  sessionSecret: string;
  cookieSecure: boolean;
  auditoriaRuta: string;
  db: { host: string; port: number; database: string; user: string; password: string };
}

/** Carga el archivo .env (si existe) sin dependencias externas: process.loadEnvFile() de Node >= 20.12. */
export function cargarEnv(): void {
  try {
    process.loadEnvFile(path.resolve(process.cwd(), '.env'));
  } catch {
    /* sin .env: se usan las variables ya definidas en el entorno */
  }
}

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor || valor.trim() === '') {
    throw new Error(`Falta la variable de entorno ${nombre}. Revise su archivo .env (vea .env.example).`);
  }
  return valor;
}

export function cargarConfig(opciones: { baseDeDatos?: string } = {}): Config {
  cargarEnv();
  const sessionSecret = requerida('SESSION_SECRET');
  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET debe tener al menos 32 caracteres.');
  }
  return {
    puerto: Number(process.env.PORT ?? 3000),
    sessionSecret,
    cookieSecure: (process.env.COOKIE_SECURE ?? 'false').toLowerCase() === 'true',
    auditoriaRuta: process.env.AUDITORIA_RUTA ?? './auditoria_logs.txt',
    db: configuracionBd(opciones.baseDeDatos),
  };
}

export function configuracionBd(baseDeDatos?: string): Config['db'] {
  cargarEnv();
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: baseDeDatos ?? requerida('DB_NAME'),
    user: requerida('DB_USER'),
    password: requerida('DB_PASSWORD'),
  };
}
