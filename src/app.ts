import express, { type ErrorRequestHandler, type Express } from 'express';
import session from 'express-session';
import path from 'path';
import { AuthController } from './controllers/AuthController';
import { ObjetoController } from './controllers/ObjetoController';
import type { PoolLike } from './database/pool';
import { cabecerasSeguridad } from './middleware/seguridad';
import { crearRouter } from './routes';
import { AuditoriaService } from './services/AuditoriaService';
import { AuthService } from './services/AuthService';
import { CatalogoService } from './services/CatalogoService';
import { RegistroObjetoService } from './services/RegistroObjetoService';
import { construirCadenaRegistro } from './validators/cadenaRegistro';

export interface DependenciasApp {
  pool: PoolLike;
  auditoria: AuditoriaService;
  sessionSecret: string;
  cookieSecure: boolean;
}

/** Fábrica de la aplicación Express (se usa en server.ts y en las pruebas de integración). */
export function crearApp(deps: DependenciasApp): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cabecerasSeguridad);
  app.use(express.json({ limit: '20kb' }));
  app.use(
    session({
      name: 'objetos.sid',
      secret: deps.sessionSecret,
      resave: false,
      saveUninitialized: false,
      // MemoryStore: suficiente para la demo (un proceso). En producción usar un almacén persistente.
      cookie: { httpOnly: true, sameSite: 'lax', secure: deps.cookieSecure, maxAge: 8 * 60 * 60 * 1000 },
    }),
  );

  const cadena = construirCadenaRegistro();
  const objetos = new ObjetoController(
    cadena,
    new RegistroObjetoService(deps.pool),
    new CatalogoService(deps.pool),
    deps.auditoria,
  );
  const auth = new AuthController(new AuthService(deps.pool), deps.auditoria);

  app.use('/api', crearRouter({ auth, objetos, pool: deps.pool }));
  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, codigo: 'NO_ENCONTRADO', mensaje: 'Ruta no encontrada.' });
  });
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const manejadorErrores: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ ok: false, codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es JSON válido.' });
      return;
    }
    console.error('[Error no controlado]', err instanceof Error ? err.message : err);
    res.status(500).json({ ok: false, codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error interno. Intente de nuevo.' });
  };
  app.use(manejadorErrores);

  return app;
}
