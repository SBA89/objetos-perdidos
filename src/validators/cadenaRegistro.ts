import { AutenticacionHandler } from './AutenticacionHandler';
import { CamposObligatoriosHandler } from './CamposObligatoriosHandler';
import { ReportanteValidoHandler } from './ReportanteValidoHandler';
import { ObjetoValidoHandler } from './ObjetoValidoHandler';
import type { ValidatorHandler } from './ValidatorHandler';

/** Construye la cadena: autenticación → campos → reportante → objeto. Devuelve el primer eslabón. */
export function construirCadenaRegistro(reloj?: () => Date): ValidatorHandler {
  const autenticacion = new AutenticacionHandler();
  autenticacion
    .setNext(new CamposObligatoriosHandler())
    .setNext(new ReportanteValidoHandler())
    .setNext(new ObjetoValidoHandler(reloj));
  return autenticacion;
}
