import { promises as fsp } from 'fs';
import path from 'path';

export type ResultadoAuditoria = 'EXITO' | 'RECHAZADO' | 'ERROR';

export interface EventoAuditoria {
  /** Identificador del responsable (p. ej. "funcionario:3" o "anonimo"). Nunca contraseñas ni IDs de sesión. */
  usuario: string;
  accion: string;
  resultado: ResultadoAuditoria;
  objetoId?: string | null;
  /** Texto breve y SIN datos personales (códigos de error, nombres de campos). */
  detalle?: string;
}

/**
 * SINGLETON — AuditoriaService.
 *
 * Alcance real: garantiza UNA instancia por PROCESO de Node.js (constructor privado + getInstance()).
 * Si la aplicación se ejecutara en varios procesos o servidores, cada uno tendría su propia
 * instancia y escribiría en el archivo; para eso habría que usar una base de datos/servicio de logs.
 *
 * Evitar entradas intercaladas NO lo logra el Singleton por sí solo: se logra serializando las
 * escrituras con una cola de promesas (una línea completa por appendFile, una tras otra).
 * Formato: una línea JSON por evento (JSON escapa saltos de línea, evitando inyección de logs).
 */
export class AuditoriaService {
  private static instancia: AuditoriaService | null = null;
  private cola: Promise<void> = Promise.resolve();

  private constructor(readonly rutaArchivo: string) {}

  /** La ruta solo se usa al crear la instancia; llamadas posteriores reutilizan la existente. */
  static getInstance(ruta?: string): AuditoriaService {
    if (!AuditoriaService.instancia) {
      const destino = ruta ?? process.env.AUDITORIA_RUTA ?? path.resolve(process.cwd(), 'auditoria_logs.txt');
      AuditoriaService.instancia = new AuditoriaService(path.resolve(destino));
    }
    return AuditoriaService.instancia;
  }

  /** Solo para pruebas: permite crear una instancia nueva apuntando a otro archivo. */
  static reiniciarParaPruebas(): void {
    AuditoriaService.instancia = null;
  }

  /** Nunca rechaza: un fallo de auditoría se reporta por consola y no tumba la petición del usuario. */
  registrar(evento: EventoAuditoria): Promise<void> {
    const linea =
      JSON.stringify({
        fechaHora: new Date().toISOString(),
        usuario: evento.usuario,
        accion: evento.accion,
        resultado: evento.resultado,
        objetoId: evento.objetoId ?? null,
        detalle: (evento.detalle ?? '').slice(0, 300),
      }) + '\n';

    this.cola = this.cola
      .then(() => fsp.appendFile(this.rutaArchivo, linea, { encoding: 'utf8' }))
      .catch((err: unknown) => {
        console.error('[Auditoría] No se pudo escribir el evento:', err instanceof Error ? err.message : err);
      });
    return this.cola;
  }

  /** Espera a que se escriban los eventos pendientes (pruebas y cierre ordenado del servidor). */
  esperarPendientes(): Promise<void> {
    return this.cola;
  }
}
