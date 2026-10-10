import type { NextFunction, Request, Response } from 'express';
import { AutenticacionHandler } from '../validators/AutenticacionHandler';

/** Cabeceras de seguridad básicas (sin dependencias extra). El front no usa scripts ni estilos en línea. */
export function cabecerasSeguridad(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/** Protege endpoints de lectura reutilizando el MISMO manejador de la cadena (una sola regla de autenticación). */
export function requerirSesion() {
  const autenticacion = new AutenticacionHandler();
  return (req: Request, res: Response, next: NextFunction): void => {
    const r = autenticacion.handle({ sesion: req.session?.usuario ?? null, entrada: null, traza: [] });
    if (!r.valido) {
      res.status(r.estado).json({ ok: false, codigo: r.codigo, mensaje: r.mensaje });
      return;
    }
    next();
  };
}
