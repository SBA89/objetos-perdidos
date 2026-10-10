import type { CategoriaCodigo, EstadoObjeto } from '../types';

/**
 * FACTORY METHOD — rol: PRODUCTO ABSTRACTO (Product).
 * Contrato común de todo objeto encontrado, sin importar su categoría.
 */
export interface IObjetoPerdido {
  readonly id: string;
  readonly estado: EstadoObjeto;
  readonly categoria: CategoriaCodigo;
  readonly tipoObjeto: string;
  readonly lugarEncuentro: string;
  readonly descripcion: string | null;
  /** Fecha en formato YYYY-MM-DD. */
  readonly fechaHallazgo: string;
  readonly reportanteId: number;
  readonly funcionarioResponsableId: number;
  /** Regla propia de cada categoría: cómo debe custodiarse físicamente el objeto. */
  instruccionCustodia(): string;
}

/** Datos necesarios para construir cualquier producto. `consecutivo` proviene de una secuencia de PostgreSQL. */
export interface DatosNuevoObjeto {
  consecutivo: number;
  tipoObjeto: string;
  lugarEncuentro: string;
  descripcion: string | null;
  fechaHallazgo: string;
  reportanteId: number;
  funcionarioResponsableId: number;
}
