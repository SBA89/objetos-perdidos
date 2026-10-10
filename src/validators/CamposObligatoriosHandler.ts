import { VALIDO, ValidatorHandler, type ContextoValidacion, type ResultadoValidacion } from './ValidatorHandler';
import { normalizarEntrada } from './normalizarEntrada';

/**
 * CHAIN OF RESPONSIBILITY — MANEJADOR CONCRETO 2.
 * RF-03 / RF-04: exige los campos obligatorios; teléfono y descripción pueden ir vacíos.
 * Reporta TODOS los campos faltantes a la vez para que el usuario los corrija en un solo intento.
 */
export class CamposObligatoriosHandler extends ValidatorHandler {
  protected validar(contexto: ContextoValidacion): ResultadoValidacion {
    const e = normalizarEntrada(contexto.entrada);
    const campos: Record<string, string> = {};

    const requeridos: Array<[string, string, string]> = [
      ['nombre', e.nombre, 'El nombre es obligatorio.'],
      ['apellido', e.apellido, 'El apellido es obligatorio.'],
      ['tipoPersona', e.tipoPersona, 'Seleccione el tipo de persona.'],
      ['categoria', e.categoria, 'Seleccione la categoría del objeto.'],
      ['tipoObjeto', e.tipoObjeto, 'Indique el tipo o nombre del objeto.'],
      ['lugarEncuentro', e.lugarEncuentro, 'Indique dónde fue encontrado.'],
      ['fechaHallazgo', e.fechaHallazgo, 'Indique la fecha del hallazgo.'],
    ];
    for (const [campo, valor, mensaje] of requeridos) {
      if (valor === '') campos[campo] = mensaje;
    }
    // Regla de negocio 5 / RF-08: todo objeto queda asociado a un funcionario responsable.
    if (e.funcionarioResponsableId === null) {
      campos.funcionarioResponsableId = 'Seleccione el funcionario responsable.';
    }

    if (Object.keys(campos).length > 0) {
      return {
        valido: false,
        estado: 400,
        codigo: 'CAMPOS_OBLIGATORIOS',
        mensaje: 'Faltan campos obligatorios. Revise los campos marcados.',
        campos,
      };
    }
    return VALIDO;
  }
}
