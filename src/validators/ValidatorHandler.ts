import type { SesionUsuario } from '../types';

/** Información que viaja por la cadena. `traza` registra el orden real de ejecución de los eslabones. */
export interface ContextoValidacion {
  sesion: SesionUsuario | null | undefined;
  entrada: unknown;
  traza: string[];
}

export type ResultadoValidacion =
  | { valido: true }
  | {
      valido: false;
      estado: number;
      codigo: string;
      mensaje: string;
      campos?: Record<string, string>;
    };

export const VALIDO: ResultadoValidacion = { valido: true };

/**
 * CHAIN OF RESPONSIBILITY — rol: MANEJADOR ABSTRACTO (Handler).
 *
 * - setNext(): encadena el siguiente eslabón (devuelve el manejador recibido para poder encadenar).
 * - handle(): MÉTODO PLANTILLA. Ejecuta la validación propia (`validar`); si falla, la cadena SE
 *   DETIENE y no se invoca al siguiente; si pasa, delega en el siguiente eslabón.
 */
export abstract class ValidatorHandler {
  private siguiente: ValidatorHandler | null = null;

  setNext(manejador: ValidatorHandler): ValidatorHandler {
    this.siguiente = manejador;
    return manejador;
  }

  handle(contexto: ContextoValidacion): ResultadoValidacion {
    contexto.traza.push(this.constructor.name);
    const resultado = this.validar(contexto);
    if (!resultado.valido) return resultado;
    return this.siguiente ? this.siguiente.handle(contexto) : resultado;
  }

  /** Cada manejador concreto implementa SOLO su regla. */
  protected abstract validar(contexto: ContextoValidacion): ResultadoValidacion;
}
