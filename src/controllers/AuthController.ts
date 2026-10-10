import type { Request, Response } from 'express';
import type { AuditoriaService } from '../services/AuditoriaService';
import type { AuthService } from '../services/AuthService';

const COOKIE = 'objetos.sid';

function regenerar(req: Request): Promise<void> {
  return new Promise((ok, fallo) => req.session.regenerate((e: unknown) => (e ? fallo(e) : ok())));
}
function guardar(req: Request): Promise<void> {
  return new Promise((ok, fallo) => req.session.save((e: unknown) => (e ? fallo(e) : ok())));
}
function destruir(req: Request): Promise<void> {
  return new Promise((ok, fallo) => req.session.destroy((e: unknown) => (e ? fallo(e) : ok())));
}

export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly auditoria: AuditoriaService,
  ) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim() : '';
    const clave = typeof req.body?.clave === 'string' ? req.body.clave : '';
    if (!correo || !clave || clave.length > 200) {
      res.status(400).json({ ok: false, codigo: 'CREDENCIALES_INCOMPLETAS', mensaje: 'Ingrese correo y contraseña.' });
      return;
    }
    const usuario = await this.auth.autenticar(correo, clave);
    if (!usuario) {
      void this.auditoria.registrar({ usuario: 'desconocido', accion: 'LOGIN', resultado: 'RECHAZADO', detalle: 'CREDENCIALES_INVALIDAS' });
      res.status(401).json({ ok: false, codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Correo o contraseña incorrectos.' });
      return;
    }
    await regenerar(req); // nueva sesión al autenticar: evita fijación de sesión
    req.session.usuario = usuario;
    await guardar(req);
    void this.auditoria.registrar({ usuario: `funcionario:${usuario.id}`, accion: 'LOGIN', resultado: 'EXITO' });
    res.json({ ok: true, usuario: { id: usuario.id, nombre: usuario.nombre } });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const sesion = req.session?.usuario;
    if (sesion) {
      void this.auditoria.registrar({ usuario: `funcionario:${sesion.id}`, accion: 'LOGOUT', resultado: 'EXITO' });
    }
    await destruir(req);
    res.clearCookie(COOKIE);
    res.json({ ok: true });
  };

  sesion = async (req: Request, res: Response): Promise<void> => {
    const s = req.session?.usuario;
    if (!s) {
      res.status(401).json({ ok: false, codigo: 'NO_AUTENTICADO', mensaje: 'No hay sesión activa.' });
      return;
    }
    res.json({ ok: true, usuario: { id: s.id, nombre: s.nombre } });
  };
}
