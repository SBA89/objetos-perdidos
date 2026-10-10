/** Error de regla de negocio con un código HTTP y un mensaje seguro para mostrar al usuario. */
export class ErrorNegocio extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorNegocio';
  }
}

export class CategoriaNoPermitidaError extends ErrorNegocio {
  constructor(categoria: string) {
    super(400, 'CATEGORIA_INVALIDA', `La categoría "${categoria}" no está permitida.`);
    this.name = 'CategoriaNoPermitidaError';
  }
}
