import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import type { PoolLike } from '../database/pool';
import type { SesionUsuario } from '../types';

const RONDAS_BCRYPT = 10;
let hashFicticio: Promise<string> | undefined;

/** Hash de una clave aleatoria: se compara cuando el correo no existe para no revelar (por tiempo) qué correos son válidos. */
function obtenerHashFicticio(): Promise<string> {
  const existente = hashFicticio ?? bcrypt.hash(randomUUID(), RONDAS_BCRYPT);
  hashFicticio = existente;
  return existente;
}

export class AuthService {
  constructor(private readonly pool: PoolLike) {}

  /** Devuelve la sesión si las credenciales son correctas; si no, null (sin indicar cuál dato falló). */
  async autenticar(correo: string, clave: string): Promise<SesionUsuario | null> {
    const r = await this.pool.query(
      'SELECT id, nombre, apellido, correo, password_hash FROM funcionarios WHERE lower(correo) = lower($1) AND activo = TRUE',
      [correo],
    );
    const fila = r.rows[0];
    const hash: string = fila?.password_hash ?? (await obtenerHashFicticio());
    const coincide = await bcrypt.compare(clave, hash);
    if (!fila || !fila.password_hash || !coincide) return null;
    return { id: Number(fila.id), nombre: `${fila.nombre} ${fila.apellido}`, correo: fila.correo };
  }
}
