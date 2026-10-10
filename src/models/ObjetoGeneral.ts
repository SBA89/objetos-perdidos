import type { DatosNuevoObjeto, IObjetoPerdido } from './IObjetoPerdido';
import { ObjetoPerdidoBase } from './ObjetoPerdidoBase';

/** FACTORY METHOD — rol: PRODUCTO CONCRETO 3. Cualquier otro bien; IDs con prefijo OBJ-. */
export class ObjetoGeneral extends ObjetoPerdidoBase implements IObjetoPerdido {
  static readonly PREFIJO = 'OBJ';

  constructor(datos: DatosNuevoObjeto) {
    super('GENERAL', ObjetoGeneral.PREFIJO, datos);
  }

  instruccionCustodia(): string {
    return 'Etiquetar con el ID y almacenar en el estante de objetos generales.';
  }
}
