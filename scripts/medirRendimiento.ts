import { cargarEnv } from '../src/config/env';

/**
 * Mide el tiempo REAL de respuesta del registro (extremo a extremo y del lado del servidor).
 * Requiere el servidor en marcha y un funcionario con contraseña:
 *   PowerShell:  $env:PERF_CORREO="recepcion@example.com"; $env:PERF_CLAVE="su-clave"; npm run medir
 * Crea N registros marcados con "[PRUEBA-RENDIMIENTO]" (vea el README para borrarlos).
 */
async function main(): Promise<void> {
  cargarEnv();
  const base = process.env.PERF_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  const correo = process.env.PERF_CORREO;
  const clave = process.env.PERF_CLAVE;
  const n = Number(process.env.PERF_N ?? 50);
  if (!correo || !clave) throw new Error('Defina PERF_CORREO y PERF_CLAVE.');

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, clave }),
  });
  if (!login.ok) throw new Error(`Login fallido (${login.status}).`);
  const cookie = (login.headers.getSetCookie()[0] ?? '').split(';')[0];

  const cat = await fetch(`${base}/api/catalogos`, { headers: { Cookie: cookie } });
  const catalogos = (await cat.json()) as { funcionarios: Array<{ id: number }> };
  const funcionarioId = catalogos.funcionarios[0]?.id;
  if (!funcionarioId) throw new Error('No hay funcionarios en el catálogo.');

  const categorias = ['ELECTRONICO', 'DOCUMENTO', 'GENERAL'];
  const extremo: number[] = [];
  const servidor: number[] = [];
  for (let i = 0; i < n; i++) {
    const cuerpo = {
      nombre: 'Prueba', apellido: 'Rendimiento', tipoPersona: 'visitante',
      categoria: categorias[i % 3], tipoObjeto: 'Objeto de prueba', lugarEncuentro: 'Laboratorio',
      descripcion: '[PRUEBA-RENDIMIENTO]', fechaHallazgo: new Date().toISOString().slice(0, 10),
      funcionarioResponsableId: funcionarioId, claveIdempotencia: crypto.randomUUID(),
    };
    const t0 = performance.now();
    const r = await fetch(`${base}/api/objetos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(cuerpo),
    });
    const ms = performance.now() - t0;
    if (r.status !== 201) throw new Error(`Respuesta inesperada ${r.status}: ${await r.text()}`);
    extremo.push(ms);
    servidor.push(Number(r.headers.get('x-tiempo-servidor-ms')));
  }

  const resumen = (nombre: string, v: number[]): void => {
    const o = [...v].sort((a, b) => a - b);
    const pct = (p: number): number => o[Math.min(o.length - 1, Math.ceil(p * o.length) - 1)];
    const prom = v.reduce((a, b) => a + b, 0) / v.length;
    console.log(`${nombre.padEnd(22)} min ${o[0].toFixed(1)} | prom ${prom.toFixed(1)} | p50 ${pct(0.5).toFixed(1)} | p95 ${pct(0.95).toFixed(1)} | máx ${o[o.length - 1].toFixed(1)}  (ms)`);
  };
  console.log(`\n${n} registros en ${base}`);
  resumen('Extremo a extremo', extremo);
  resumen('Servidor (X-Tiempo...)', servidor);
  console.log('\nObjetivo recomendado: p95 del servidor ≤ 200 ms y máximo extremo a extremo ≤ 2000 ms.');
  console.log('Referencia del documento: < 50 ms (se informa el resultado real; no se asume).');
}

main().catch((err: unknown) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
