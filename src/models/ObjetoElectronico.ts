import type { DatosNuevoObjeto, IObjetoPerdido } from './IObjetoPerdido';
import { ObjetoPerdidoBase } from './ObjetoPerdidoBase';

/** FACTORY METHOD — rol: PRODUCTO CONCRETO 1. Bienes tecnológicos; IDs con prefijo ELEC-. */
export class ObjetoElectronico extends ObjetoPerdidoBase implements IObjetoPerdido {
  static readonly PREFIJO = 'ELEC';

  constructor(datos: DatosNuevoObjeto) {
    super('ELECTRONICO', ObjetoElectronico.PREFIJO, datos);
  }

  instruccionCustodia(): string {
    return 'Apagar el dispositivo, anotar marca/serial si es visible y guardarlo en el casillero con llave.';
  }
}
