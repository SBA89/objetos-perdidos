import type { Request, Response } from 'express';
import type { AuditoriaService } from '../services/AuditoriaService';
import type { CatalogoService } from '../services/CatalogoService';
import type { RegistroObjetoService } from '../services/RegistroObjetoService';
import { ErrorNegocio } from '../types/errores';
import { normalizarEntrada } from '../validators/normalizarEntrada';
import type { ContextoValidacion, ValidatorHandler } from '../validators/ValidatorHandler';

const ACCION = 'REGISTRAR_OBJETO';

/**
 * CHAIN OF RESPONSIBILITY — rol: CLIENTE. Recibe la cadena ya construida, la ejecuta ANTES de
 * invocar al servicio (que a su vez usa la fábrica) y traduce el resultado a HTTP.
 */
export class ObjetoController {
  constructor(
    private readonly cadena: ValidatorHandler,
    private readonly servicio: RegistroObjetoService,
    private readonly catalogos: CatalogoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  registrar = async (req: Request, res: Response): Promise<void> => {
    const inicio = process.hrtime.bigint();
    const sesion = req.session?.usuario ?? null;
    const usuario = sesion ? `funcionario:${sesion.id}` : 'anonimo';
    const tiempoMs = (): number => Math.round((Number(process.hrtime.bigint() - inicio) / 1e6) * 100) / 100;

    const contexto: ContextoValidacion = { sesion, entrada: req.body, traza: [] };
    const validacion = this.cadena.handle(contexto);
    if (!validacion.valido) {
      const campos = validacion.campos ? Object.keys(validacion.campos).join(', ') : '';
      void this.auditoria.registrar({
        usuario,
        accion: ACCION,
        resultado: 'RECHAZADO',
        detalle: `${validacion.codigo}${campos ? ': ' + campos : ''}`,
      });
      res.setHeader('X-Tiempo-Servidor-Ms', String(tiempoMs()));
      res.status(validacion.estado).json({
        ok: false,
        codigo: validacion.codigo,
        mensaje: validacion.mensaje,
        campos: validacion.campos ?? {},
      });
      return;
    }

    try {
      if (!sesion) throw new ErrorNegocio(401, 'NO_AUTENTICADO', 'Debe iniciar sesión para registrar objetos.');
      const resultado = await this.servicio.registrar(normalizarEntrada(req.body), sesion.id);
      const ms = tiempoMs();
      void this.auditoria.registrar({
        usuario,
        accion: ACCION,
        resultado: 'EXITO',
        objetoId: resultado.id,
        detalle: resultado.repetido ? `REPETIDO (idempotencia), ${ms} ms` : `${ms} ms`,
      });
      res.setHeader('X-Tiempo-Servidor-Ms', String(ms));
      res.status(resultado.repetido ? 200 : 201).json({
        ok: true,
        mensaje: resultado.repetido
          ? 'Este registro ya había sido guardado; se muestra el ID existente.'
          : 'Objeto registrado correctamente.',
        objeto: resultado,
        tiempoServidorMs: ms,
      });
    } catch (err) {
      if (err instanceof ErrorNegocio) {
        void this.auditoria.registrar({ usuario, accion: ACCION, resultado: 'RECHAZADO', detalle: err.codigo });
        res.status(err.estado).json({ ok: false, codigo: err.codigo, mensaje: err.message, campos: {} });
        return;
      }
      // Error inesperado (p. ej. base de datos caída): la transacción ya fue revertida en el servicio.
      console.error('[Registro] Error de almacenamiento:', err instanceof Error ? err.message : err);
      void this.auditoria.registrar({ usuario, accion: ACCION, resultado: 'ERROR', detalle: 'ERROR_ALMACENAMIENTO' });
      res.status(500).json({
        ok: false,
        codigo: 'ERROR_ALMACENAMIENTO',
        mensaje: 'No se pudo guardar el registro y no se almacenó ningún dato. Intente de nuevo en unos segundos.',
        campos: {},
      });
    }
  };

  obtenerCatalogos = async (_req: Request, res: Response): Promise<void> => {
    res.json({ ok: true, ...(await this.catalogos.obtener()) });
  };
}
