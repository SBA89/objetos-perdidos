import { Router } from 'express';
import type { AuthController } from '../controllers/AuthController';
import type { ObjetoController } from '../controllers/ObjetoController';
import type { PoolLike } from '../database/pool';
import { asyncHandler } from '../middleware/asyncHandler';
import { requerirSesion } from '../middleware/seguridad';

export function crearRouter(deps: {
  auth: AuthController;
  objetos: ObjetoController;
  pool: PoolLike;
}): Router {
  const router = Router();
  const sesionRequerida = requerirSesion();

  router.get(
    '/salud',
    asyncHandler(async (_req, res) => {
      await deps.pool.query('SELECT 1');
      res.json({ ok: true });
    }),
  );

  router.post('/auth/login', asyncHandler(deps.auth.login));
  router.post('/auth/logout', asyncHandler(deps.auth.logout));
  router.get('/auth/sesion', asyncHandler(deps.auth.sesion));

  router.get('/catalogos', sesionRequerida, asyncHandler(deps.objetos.obtenerCatalogos));
  // La autenticación de este endpoint la hace el primer eslabón de la cadena (AutenticacionHandler).
  router.post('/objetos', asyncHandler(deps.objetos.registrar));

  return router;
}
