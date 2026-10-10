import type { NextFunction, Request, Response } from 'express';

/** Express 4 no captura rechazos de funciones async: este envoltorio los envía al manejador de errores. */
export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}
