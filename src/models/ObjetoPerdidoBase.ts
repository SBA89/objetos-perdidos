import { ESTADO_INICIAL, type CategoriaCodigo, type EstadoObjeto } from '../types';
import type { DatosNuevoObjeto, IObjetoPerdido } from './IObjetoPerdido';

/**
 * Comportamiento común de los productos concretos (no es un rol del patrón; evita repetir código).
 * Aquí se fija el estado inicial "Pendiente" (RF-05) y se construye el identificador (RF-09).
 */
export abstract class ObjetoPerdidoBase implements IObjetoPerdido {
  readonly id: string;
  readonly estado: EstadoObjeto = ESTADO_INICIAL;
  readonly tipoObjeto: string;
  readonly lugarEncuentro: string;
  readonly descripcion: string | null;
  readonly fechaHallazgo: string;
  readonly reportanteId: number;
  readonly funcionarioResponsableId: number;

  protected constructor(
    readonly categoria: CategoriaCodigo,
    prefijo: string,
    datos: DatosNuevoObjeto,
  ) {
    if (!Number.isInteger(datos.consecutivo) || datos.consecutivo < 1) {
      throw new Error('El consecutivo del objeto debe ser un entero positivo.');
    }
    this.id = `${prefijo}-${String(datos.consecutivo).padStart(6, '0')}`;
    this.tipoObjeto = datos.tipoObjeto;
    this.lugarEncuentro = datos.lugarEncuentro;
    this.descripcion = datos.descripcion;
    this.fechaHallazgo = datos.fechaHallazgo;
    this.reportanteId = datos.reportanteId;
    this.funcionarioResponsableId = datos.funcionarioResponsableId;
  }

  abstract instruccionCustodia(): string;
}
