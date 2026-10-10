import type { DatosNuevoObjeto, IObjetoPerdido } from './IObjetoPerdido';
import { ObjetoPerdidoBase } from './ObjetoPerdidoBase';

/** FACTORY METHOD — rol: PRODUCTO CONCRETO 2. Documentos de identidad o carnés; IDs con prefijo DOC-. */
export class DocumentoPersonal extends ObjetoPerdidoBase implements IObjetoPerdido {
  static readonly PREFIJO = 'DOC';

  constructor(datos: DatosNuevoObjeto) {
    super('DOCUMENTO', DocumentoPersonal.PREFIJO, datos);
  }

  instruccionCustodia(): string {
    return 'Guardar en la caja de documentos bajo llave; no fotografiar ni divulgar los datos personales.';
  }
}
