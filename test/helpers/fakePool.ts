import type { ClientLike, PoolLike } from '../../src/database/pool';

export interface PoolFalso {
  pool: PoolLike;
  /** Todas las consultas ejecutadas, normalizadas (espacios simples). */
  consultas: string[];
  estado: { commit: number; rollback: number; liberados: number; conexiones: number };
}

/**
 * Doble de PostgreSQL en memoria para pruebas unitarias.
 * `fallarEn`: fragmento de SQL que debe lanzar un error (simula caída/violación de restricción).
 */
export function crearPoolFalso(opciones: { fallarEn?: string; errorPersonalizado?: Error } = {}): PoolFalso {
  const consultas: string[] = [];
  const estado = { commit: 0, rollback: 0, liberados: 0, conexiones: 0 };
  const contadores: Record<string, number> = {};

  const responder = async (textoOriginal: string, params: unknown[] = []): Promise<{ rows: any[] }> => {
    const texto = textoOriginal.replace(/\s+/g, ' ').trim();
    consultas.push(texto);
    if (opciones.fallarEn && texto.includes(opciones.fallarEn)) {
      throw opciones.errorPersonalizado ?? new Error('fallo simulado de base de datos');
    }
    if (texto === 'COMMIT') { estado.commit++; return { rows: [] }; }
    if (texto === 'ROLLBACK') { estado.rollback++; return { rows: [] }; }
    if (texto === 'BEGIN') return { rows: [] };
    if (texto.startsWith('SELECT id FROM funcionarios')) return { rows: [{ id: params[0] }] };
    if (texto.startsWith('SELECT id FROM categorias')) return { rows: [{ id: 1 }] };
    if (texto.startsWith('INSERT INTO reportantes')) return { rows: [{ id: 501 }] };
    if (texto.startsWith('SELECT nextval')) {
      const secuencia = String(params[0]);
      contadores[secuencia] = (contadores[secuencia] ?? 0) + 1;
      return { rows: [{ consecutivo: String(contadores[secuencia]) }] };
    }
    return { rows: [] };
  };

  const cliente: ClientLike = {
    query: responder,
    release: () => { estado.liberados++; },
  };
  const pool: PoolLike = {
    query: responder,
    connect: async () => { estado.conexiones++; return cliente; },
  };
  return { pool, consultas, estado };
}
