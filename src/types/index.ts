/** Tipos y constantes compartidos por todo el módulo. */

export const CATEGORIAS = ['ELECTRONICO', 'DOCUMENTO', 'GENERAL'] as const;
export type CategoriaCodigo = (typeof CATEGORIAS)[number];

export const TIPOS_PERSONA = ['estudiante', 'funcionario', 'docente', 'visitante'] as const;
export type TipoPersona = (typeof TIPOS_PERSONA)[number];

/**
 * Estado con el que nace TODO objeto (RF-05). Otros estados (Entregado, Cerrado) pertenecen a
 * módulos fuera de alcance; la base de datos los admite, pero este módulo nunca los asigna.
 */
export const ESTADO_INICIAL = 'Pendiente' as const;
export type EstadoObjeto = typeof ESTADO_INICIAL;

/** Datos de la sesión autenticada (funcionario que opera el sistema). */
export interface SesionUsuario {
  id: number;
  nombre: string;
  correo: string;
}

/**
 * Entrada ya "limpia" (strings recortados). Los campos opcionales ausentes son cadena vacía y
 * se guardan como NULL. funcionarioResponsableId es null si falta o no es un entero válido.
 */
export interface EntradaNormalizada {
  nombre: string;
  apellido: string;
  correo: string;
  telefono: string;
  tipoPersona: string;
  categoria: string;
  tipoObjeto: string;
  lugarEncuentro: string;
  descripcion: string;
  fechaHallazgo: string;
  funcionarioResponsableId: number | null;
  claveIdempotencia: string;
}

export interface ResultadoRegistro {
  id: string;
  categoria: CategoriaCodigo;
  estado: EstadoObjeto;
  tipoObjeto: string;
  lugarEncuentro: string;
  fechaHallazgo: string;
  instruccionCustodia: string;
  reportanteId: number;
  funcionarioResponsableId: number;
  /** true si la petición repetía una clave de idempotencia y se devolvió el registro ya existente. */
  repetido: boolean;
}
