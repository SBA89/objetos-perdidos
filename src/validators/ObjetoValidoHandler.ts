import { CATEGORIAS } from '../types';
import { VALIDO, ValidatorHandler, type ContextoValidacion, type ResultadoValidacion } from './ValidatorHandler';
import { esFechaISOValida, hoyISO, normalizarEntrada } from './normalizarEntrada';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CHAIN OF RESPONSIBILITY — MANEJADOR CONCRETO 4 (ampliación respecto al documento académico).
 * El documento define 3 eslabones y ninguno valida la categoría (RF-06) ni el formato de la fecha.
 * Añadir un eslabón sin tocar los demás es justamente la ventaja Abierto/Cerrado del patrón.
 */
export class ObjetoValidoHandler extends ValidatorHandler {
  constructor(private readonly reloj: () => Date = () => new Date()) {
    super();
  }

  protected validar(contexto: ContextoValidacion): ResultadoValidacion {
    const e = normalizarEntrada(contexto.entrada);

    if (!(CATEGORIAS as readonly string[]).includes(e.categoria)) {
      return {
        valido: false,
        estado: 400,
        codigo: 'CATEGORIA_INVALIDA',
        mensaje: `La categoría no está permitida. Use: ${CATEGORIAS.join(', ')}.`,
        campos: { categoria: 'Categoría no permitida.' },
      };
    }

    const campos: Record<string, string> = {};
    if (!esFechaISOValida(e.fechaHallazgo)) {
      campos.fechaHallazgo = 'La fecha no es válida (formato AAAA-MM-DD).';
    } else if (e.fechaHallazgo > hoyISO(this.reloj())) {
      campos.fechaHallazgo = 'La fecha del hallazgo no puede ser futura.';
    }
    if (e.tipoObjeto.length > 150) campos.tipoObjeto = 'Máximo 150 caracteres.';
    if (e.lugarEncuentro.length > 200) campos.lugarEncuentro = 'Máximo 200 caracteres.';
    if (e.descripcion.length > 1000) campos.descripcion = 'Máximo 1000 caracteres.';
    if (e.claveIdempotencia !== '' && !REGEX_UUID.test(e.claveIdempotencia)) {
      campos.claveIdempotencia = 'La clave de idempotencia debe ser un UUID.';
    }

    if (Object.keys(campos).length > 0) {
      return {
        valido: false,
        estado: 400,
        codigo: 'OBJETO_INVALIDO',
        mensaje: 'Los datos del objeto no son válidos. Revise los campos marcados.',
        campos,
      };
    }
    return VALIDO;
  }
}
