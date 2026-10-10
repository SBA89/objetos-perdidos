import type { PoolLike } from '../database/pool';
import { TIPOS_PERSONA } from '../types';

export interface Catalogos {
  categorias: Array<{ codigo: string; nombre: string }>;
  tiposPersona: readonly string[];
  funcionarios: Array<{ id: number; nombre: string }>;
}

/** Datos para llenar el formulario. No expone correos ni hashes de los funcionarios. */
export class CatalogoService {
  constructor(private readonly pool: PoolLike) {}

  async obtener(): Promise<Catalogos> {
    const [cats, funcs] = await Promise.all([
      this.pool.query('SELECT codigo, nombre FROM categorias ORDER BY id'),
      this.pool.query("SELECT id, nombre || ' ' || apellido AS nombre FROM funcionarios WHERE activo = TRUE ORDER BY nombre, apellido"),
    ]);
    return {
      categorias: cats.rows.map((c) => ({ codigo: c.codigo as string, nombre: c.nombre as string })),
      tiposPersona: TIPOS_PERSONA,
      funcionarios: funcs.rows.map((f) => ({ id: Number(f.id), nombre: f.nombre as string })),
    };
  }
}
