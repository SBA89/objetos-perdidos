import { VALIDO, ValidatorHandler, type ContextoValidacion, type ResultadoValidacion } from './ValidatorHandler';

/**
 * CHAIN OF RESPONSIBILITY — MANEJADOR CONCRETO 1.
 * Exige una sesión autenticada (creada por el login real contra la tabla funcionarios).
 */
export class AutenticacionHandler extends ValidatorHandler {
  protected validar(contexto: ContextoValidacion): ResultadoValidacion {
    const sesion = contexto.sesion;
    if (!sesion || !Number.isInteger(sesion.id)) {
      return {
        valido: false,
        estado: 401,
        codigo: 'NO_AUTENTICADO',
        mensaje: 'Debe iniciar sesión para registrar objetos.',
      };
    }
    return VALIDO;
  }
}
