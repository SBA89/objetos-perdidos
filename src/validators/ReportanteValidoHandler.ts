import { TIPOS_PERSONA } from '../types';
import { VALIDO, ValidatorHandler, type ContextoValidacion, type ResultadoValidacion } from './ValidatorHandler';
import { normalizarEntrada } from './normalizarEntrada';

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGEX_TELEFONO = /^[0-9+()\-\s.]{5,30}$/;

/**
 * CHAIN OF RESPONSIBILITY — MANEJADOR CONCRETO 3.
 * RF-01 / RF-07: valida que el reportante sea una persona válida (tipo permitido, correo y teléfono
 * con formato correcto, longitudes de la BD). La vinculación objeto→reportante NO la "garantiza"
 * este manejador: la garantiza la BD (reportante_id NOT NULL + clave foránea) y la transacción
 * que inserta primero al reportante.
 */
export class ReportanteValidoHandler extends ValidatorHandler {
  protected validar(contexto: ContextoValidacion): ResultadoValidacion {
    const e = normalizarEntrada(contexto.entrada);
    const campos: Record<string, string> = {};

    if (!(TIPOS_PERSONA as readonly string[]).includes(e.tipoPersona)) {
      return {
        valido: false,
        estado: 400,
        codigo: 'TIPO_PERSONA_INVALIDO',
        mensaje: `El tipo de persona debe ser uno de: ${TIPOS_PERSONA.join(', ')}.`,
        campos: { tipoPersona: 'Tipo de persona no permitido.' },
      };
    }
    if (e.nombre.length > 100) campos.nombre = 'El nombre no puede superar 100 caracteres.';
    if (e.apellido.length > 100) campos.apellido = 'El apellido no puede superar 100 caracteres.';
    if (e.correo !== '' && (e.correo.length > 100 || !REGEX_CORREO.test(e.correo))) {
      campos.correo = 'Ingrese un correo electrónico válido (máximo 100 caracteres).';
    }
    if (e.telefono !== '' && !REGEX_TELEFONO.test(e.telefono)) {
      campos.telefono = 'Ingrese un teléfono válido (solo números, espacios, +, -, paréntesis).';
    }

    if (Object.keys(campos).length > 0) {
      return {
        valido: false,
        estado: 400,
        codigo: 'REPORTANTE_INVALIDO',
        mensaje: 'Los datos del reportante no son válidos. Revise los campos marcados.',
        campos,
      };
    }
    return VALIDO;
  }
}
