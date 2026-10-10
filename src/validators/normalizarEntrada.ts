import type { EntradaNormalizada } from '../types';

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function entero(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isInteger(valor) && valor > 0) return valor;
  if (typeof valor === 'string' && /^\d{1,9}$/.test(valor.trim())) {
    const n = Number(valor.trim());
    return n > 0 ? n : null;
  }
  return null;
}

/** Convierte el cuerpo HTTP (desconocido) en una entrada tipada y recortada. No valida reglas de negocio. */
export function normalizarEntrada(entrada: unknown): EntradaNormalizada {
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
  return {
    nombre: texto(e.nombre),
    apellido: texto(e.apellido),
    correo: texto(e.correo),
    telefono: texto(e.telefono),
    tipoPersona: texto(e.tipoPersona).toLowerCase(),
    categoria: texto(e.categoria).toUpperCase(),
    tipoObjeto: texto(e.tipoObjeto),
    lugarEncuentro: texto(e.lugarEncuentro),
    descripcion: texto(e.descripcion),
    fechaHallazgo: texto(e.fechaHallazgo),
    funcionarioResponsableId: entero(e.funcionarioResponsableId),
    claveIdempotencia: texto(e.claveIdempotencia),
  };
}

/** Verifica formato AAAA-MM-DD y que la fecha exista realmente (rechaza 2026-02-31). */
export function esFechaISOValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

/** Fecha local de hoy en AAAA-MM-DD. */
export function hoyISO(ahora: Date = new Date()): string {
  const mm = String(ahora.getMonth() + 1).padStart(2, '0');
  const dd = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mm}-${dd}`;
}
