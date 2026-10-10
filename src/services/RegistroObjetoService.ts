import { ObjetoFactory } from '../factories/ObjetoFactory';
import type { PoolLike } from '../database/pool';
import { ErrorNegocio } from '../types/errores';
import type { CategoriaCodigo, EntradaNormalizada, ResultadoRegistro } from '../types';

/** Lista blanca de secuencias (el nombre nunca viene del usuario). */
export const SECUENCIAS: Record<CategoriaCodigo, string> = {
  ELECTRONICO: 'seq_objeto_electronico',
  DOCUMENTO: 'seq_objeto_documento',
  GENERAL: 'seq_objeto_general',
};

const Q_FUNCIONARIO = 'SELECT id FROM funcionarios WHERE id = $1 AND activo = TRUE';
const Q_CATEGORIA = 'SELECT id FROM categorias WHERE codigo = $1';
const Q_REPORTANTE =
  'INSERT INTO reportantes (nombre, apellido, correo, telefono, tipo_persona) VALUES ($1, $2, $3, $4, $5) RETURNING id';
const Q_SECUENCIA = 'SELECT nextval($1::regclass) AS consecutivo';
const Q_OBJETO =
  'INSERT INTO objetos_encontrados (id, categoria_id, tipo_objeto, lugar_encuentro, descripcion, fecha_hallazgo, estado, reportante_id, funcionario_id, registrado_por, clave_idempotencia) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)';
const Q_BUSCAR_POR_CLAVE =
  "SELECT o.id, c.codigo AS categoria, o.estado, o.tipo_objeto, o.lugar_encuentro, to_char(o.fecha_hallazgo, 'YYYY-MM-DD') AS fecha_hallazgo, o.reportante_id, o.funcionario_id FROM objetos_encontrados o JOIN categorias c ON c.id = o.categoria_id WHERE o.clave_idempotencia = $1";

/**
 * Orquesta el registro dentro de UNA transacción (reportante + objeto): o se guarda todo o nada.
 * No valida formato (eso lo hace la cadena de responsabilidad); sí comprueba lo que solo la BD sabe
 * (funcionario activo, categoría existente) y usa la fábrica para crear el producto.
 */
export class RegistroObjetoService {
  constructor(private readonly pool: PoolLike) {}

  async registrar(entrada: EntradaNormalizada, registradoPor: number): Promise<ResultadoRegistro> {
    const clave = entrada.claveIdempotencia || null;

    // Doble clic / reintento: si la clave ya generó un registro, se devuelve ese mismo (sin duplicar).
    if (clave) {
      const previo = await this.buscarPorClave(clave);
      if (previo) return previo;
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const funcionarioId = entrada.funcionarioResponsableId as number;
      const funcionario = await cliente.query(Q_FUNCIONARIO, [funcionarioId]);
      if (funcionario.rows.length === 0) {
        throw new ErrorNegocio(400, 'FUNCIONARIO_INVALIDO', 'El funcionario responsable no existe o está inactivo.');
      }
      const categoria = await cliente.query(Q_CATEGORIA, [entrada.categoria]);
      if (categoria.rows.length === 0) {
        throw new ErrorNegocio(400, 'CATEGORIA_INVALIDA', 'La categoría no existe en el sistema.');
      }

      const reportante = await cliente.query(Q_REPORTANTE, [
        entrada.nombre,
        entrada.apellido,
        entrada.correo || null,
        entrada.telefono || null,
        entrada.tipoPersona,
      ]);
      const reportanteId = Number(reportante.rows[0].id);

      const secuencia = await cliente.query(Q_SECUENCIA, [SECUENCIAS[entrada.categoria as CategoriaCodigo]]);

      // PATRÓN FACTORY METHOD: la categoría decide la clase concreta, el prefijo del ID y el estado inicial.
      const objeto = ObjetoFactory.crearObjeto(entrada.categoria, {
        consecutivo: Number(secuencia.rows[0].consecutivo),
        tipoObjeto: entrada.tipoObjeto,
        lugarEncuentro: entrada.lugarEncuentro,
        descripcion: entrada.descripcion || null,
        fechaHallazgo: entrada.fechaHallazgo,
        reportanteId,
        funcionarioResponsableId: funcionarioId,
      });

      await cliente.query(Q_OBJETO, [
        objeto.id,
        categoria.rows[0].id,
        objeto.tipoObjeto,
        objeto.lugarEncuentro,
        objeto.descripcion,
        objeto.fechaHallazgo,
        objeto.estado,
        objeto.reportanteId,
        objeto.funcionarioResponsableId,
        registradoPor,
        clave,
      ]);

      await cliente.query('COMMIT');

      return {
        id: objeto.id,
        categoria: objeto.categoria,
        estado: objeto.estado,
        tipoObjeto: objeto.tipoObjeto,
        lugarEncuentro: objeto.lugarEncuentro,
        fechaHallazgo: objeto.fechaHallazgo,
        instruccionCustodia: objeto.instruccionCustodia(),
        reportanteId,
        funcionarioResponsableId: funcionarioId,
        repetido: false,
      };
    } catch (err) {
      try {
        await cliente.query('ROLLBACK');
      } catch {
        /* si ROLLBACK falla la conexión ya está rota; el pool la descartará */
      }
      // Dos peticiones simultáneas con la misma clave: la segunda choca con UNIQUE → se revierte y se devuelve la primera.
      if (clave && esViolacionUnica(err, 'objetos_clave_idempotencia_uq')) {
        const previo = await this.buscarPorClave(clave);
        if (previo) return previo;
      }
      throw err;
    } finally {
      cliente.release();
    }
  }

  private async buscarPorClave(clave: string): Promise<ResultadoRegistro | null> {
    const r = await this.pool.query(Q_BUSCAR_POR_CLAVE, [clave]);
    if (r.rows.length === 0) return null;
    const f = r.rows[0];
    // Se reconstruye el producto con la fábrica a partir del número del ID para recuperar su instrucción de custodia.
    const producto = ObjetoFactory.crearObjeto(f.categoria, {
      consecutivo: Number(String(f.id).split('-')[1]),
      tipoObjeto: f.tipo_objeto,
      lugarEncuentro: f.lugar_encuentro,
      descripcion: null,
      fechaHallazgo: f.fecha_hallazgo,
      reportanteId: Number(f.reportante_id),
      funcionarioResponsableId: Number(f.funcionario_id),
    });
    return {
      id: f.id,
      categoria: f.categoria,
      estado: f.estado,
      tipoObjeto: f.tipo_objeto,
      lugarEncuentro: f.lugar_encuentro,
      fechaHallazgo: f.fecha_hallazgo,
      instruccionCustodia: producto.instruccionCustodia(),
      reportanteId: Number(f.reportante_id),
      funcionarioResponsableId: Number(f.funcionario_id),
      repetido: true,
    };
  }
}

function esViolacionUnica(err: unknown, restriccion: string): boolean {
  const e = err as { code?: string; constraint?: string };
  return e?.code === '23505' && e?.constraint === restriccion;
}
