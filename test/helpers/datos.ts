import type { EntradaNormalizada } from '../../src/types';

/** Cuerpo HTTP válido (tal como lo enviaría el navegador). */
export function cuerpoValido(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nombre: 'Ana',
    apellido: 'Gómez',
    correo: 'ana@example.com',
    telefono: '3001234567',
    tipoPersona: 'estudiante',
    categoria: 'ELECTRONICO',
    tipoObjeto: 'Celular',
    lugarEncuentro: 'Biblioteca',
    descripcion: 'Funda azul',
    fechaHallazgo: '2026-10-01',
    funcionarioResponsableId: 1,
    ...extra,
  };
}

export function entradaValida(extra: Partial<EntradaNormalizada> = {}): EntradaNormalizada {
  return {
    nombre: 'Ana', apellido: 'Gómez', correo: 'ana@example.com', telefono: '3001234567',
    tipoPersona: 'estudiante', categoria: 'ELECTRONICO', tipoObjeto: 'Celular', lugarEncuentro: 'Biblioteca',
    descripcion: 'Funda azul', fechaHallazgo: '2026-10-01', funcionarioResponsableId: 1, claveIdempotencia: '',
    ...extra,
  };
}
