import type { SesionUsuario } from './index';

declare module 'express-session' {
  interface SessionData {
    usuario?: SesionUsuario;
  }
}
