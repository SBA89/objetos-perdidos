import { CategoriaNoPermitidaError } from '../types/errores';
import { CATEGORIAS, ESTADO_INICIAL, type CategoriaCodigo } from '../types';
import type { DatosNuevoObjeto, IObjetoPerdido } from '../models/IObjetoPerdido';
import { ObjetoElectronico } from '../models/ObjetoElectronico';
import { DocumentoPersonal } from '../models/DocumentoPersonal';
import { ObjetoGeneral } from '../models/ObjetoGeneral';

/**
 * FACTORY METHOD — rol: CREADOR (Creator).
 *
 * Variante usada: Factory Method clásico (GoF). `crearProducto()` es el *factory method* abstracto
 * que cada creador concreto sobrescribe para devolver su producto. `crear()` es la operación
 * plantilla del creador y trabaja únicamente con la interfaz IObjetoPerdido.
 *
 * Además se conserva el método estático `ObjetoFactory.crearObjeto(categoria, datos)` descrito en el
 * documento académico: es una fachada de selección (elige el creador concreto según la categoría).
 * Por sí sola esa fachada sería una "Simple/Static Factory"; el patrón formal lo aportan las
 * subclases que sobrescriben `crearProducto()`.
 */
export abstract class ObjetoFactory {
  /** El Factory Method: las subclases deciden QUÉ producto concreto se instancia. */
  protected abstract crearProducto(datos: DatosNuevoObjeto): IObjetoPerdido;

  /** Operación plantilla: crea el producto y verifica el invariante del estado inicial (RF-05). */
  crear(datos: DatosNuevoObjeto): IObjetoPerdido {
    const producto = this.crearProducto(datos);
    if (producto.estado !== ESTADO_INICIAL) {
      throw new Error(`Invariante violado: un objeto nuevo debe nacer en estado "${ESTADO_INICIAL}".`);
    }
    return producto;
  }

  /** Fachada estática: selecciona el creador concreto según la categoría de la petición. */
  static crearObjeto(categoria: string, datos: DatosNuevoObjeto): IObjetoPerdido {
    return ObjetoFactory.creadorPara(categoria).crear(datos);
  }

  static creadorPara(categoria: string): ObjetoFactory {
    if (!(CATEGORIAS as readonly string[]).includes(categoria)) {
      throw new CategoriaNoPermitidaError(categoria);
    }
    return CREADORES[categoria as CategoriaCodigo];
  }
}

/** FACTORY METHOD — rol: CREADOR CONCRETO 1. */
export class ObjetoElectronicoFactory extends ObjetoFactory {
  protected crearProducto(datos: DatosNuevoObjeto): IObjetoPerdido {
    return new ObjetoElectronico(datos);
  }
}

/** FACTORY METHOD — rol: CREADOR CONCRETO 2. */
export class DocumentoPersonalFactory extends ObjetoFactory {
  protected crearProducto(datos: DatosNuevoObjeto): IObjetoPerdido {
    return new DocumentoPersonal(datos);
  }
}

/** FACTORY METHOD — rol: CREADOR CONCRETO 3. */
export class ObjetoGeneralFactory extends ObjetoFactory {
  protected crearProducto(datos: DatosNuevoObjeto): IObjetoPerdido {
    return new ObjetoGeneral(datos);
  }
}

const CREADORES: Record<CategoriaCodigo, ObjetoFactory> = {
  ELECTRONICO: new ObjetoElectronicoFactory(),
  DOCUMENTO: new DocumentoPersonalFactory(),
  GENERAL: new ObjetoGeneralFactory(),
};
