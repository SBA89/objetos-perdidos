/**
 * Pruebas de INTEGRACIÓN: Express real + PostgreSQL real (base de datos de PRUEBA).
 * Requisitos: PostgreSQL en marcha, base TEST_DB_NAME creada y credenciales en .env.
 * ¡Vacía las tablas de objetos y reportantes de esa base en cada ejecución! Nunca apunte TEST_DB_NAME a la base real.
 */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { crearApp } from '../../src/app';
import { cargarEnv, configuracionBd } from '../../src/config/env';
import type { ClientLike, PoolLike } from '../../src/database/pool';
import { AuditoriaService } from '../../src/services/AuditoriaService';
import { cuerpoValido } from '../helpers/datos';

cargarEnv();
const BD_PRUEBA = process.env.TEST_DB_NAME;
const omitir = BD_PRUEBA ? false : 'Defina TEST_DB_NAME (y credenciales) en .env para ejecutar las pruebas de integración.';

const CORREO = 'pruebas.integracion@example.com';
const CLAVE = randomBytes(12).toString('hex'); // credencial efímera, solo existe durante la ejecución

describe('Integración — Registrar objeto (Express + PostgreSQL)', { skip: omitir }, () => {
  let pool: Pool;
  let servidor: Server;
  let base: string;
  let cookie: string;
  let funcionarioId: number;
  let rutaAuditoria: string;
  let auditoria: AuditoriaService;
  const extra: Server[] = [];

  const post = (cuerpo: unknown, cookieUsada: string | null = cookie) =>
    fetch(`${base}/api/objetos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookieUsada ? { Cookie: cookieUsada } : {}) },
      body: JSON.stringify(cuerpo),
    });
  const contar = async (tabla: string): Promise<number> =>
    Number((await pool.query(`SELECT count(*) AS n FROM ${tabla}`)).rows[0].n);
  const iniciarSesion = async (url: string): Promise<string> => {
    const r = await fetch(`${url}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: CORREO, clave: CLAVE }),
    });
    assert.equal(r.status, 200);
    return (r.headers.getSetCookie()[0] ?? '').split(';')[0];
  };
  const levantar = async (poolApp: PoolLike): Promise<{ url: string; srv: Server }> => {
    const app = crearApp({ pool: poolApp, auditoria, sessionSecret: randomBytes(32).toString('hex'), cookieSecure: false });
    const srv = await new Promise<Server>((ok) => { const s = app.listen(0, () => ok(s)); });
    extra.push(srv);
    return { url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}`, srv };
  };

  before(async () => {
    pool = new Pool(configuracionBd(BD_PRUEBA));
    for (const archivo of ['schema.sql', 'seed.sql']) {
      await pool.query(await fsp.readFile(path.resolve(process.cwd(), 'sql', archivo), 'utf8'));
    }
    await pool.query('TRUNCATE objetos_encontrados, reportantes RESTART IDENTITY CASCADE');
    const hash = await bcrypt.hash(CLAVE, 4);
    const f = await pool.query(
      `INSERT INTO funcionarios (nombre, apellido, correo, password_hash) VALUES ('Prueba', 'Integración', $1, $2)
       ON CONFLICT (lower(correo)) DO UPDATE SET password_hash = EXCLUDED.password_hash, activo = TRUE RETURNING id`,
      [CORREO, hash],
    );
    funcionarioId = Number(f.rows[0].id);

    rutaAuditoria = path.join(os.tmpdir(), `auditoria-int-${process.pid}-${randomUUID()}.txt`);
    AuditoriaService.reiniciarParaPruebas();
    auditoria = AuditoriaService.getInstance(rutaAuditoria);

    const { url, srv } = await levantar(pool);
    base = url;
    servidor = srv;
    cookie = await iniciarSesion(base);
  });

  after(async () => {
    await new Promise((ok) => servidor?.close(ok));
    for (const s of extra) s.close();
    await auditoria?.esperarPendientes();
    await fsp.rm(rutaAuditoria, { force: true });
    await pool?.end();
    AuditoriaService.reiniciarParaPruebas();
  });

  const consultarObjeto = async (id: string) =>
    (await pool.query(
      `SELECT o.*, c.codigo AS categoria, r.nombre, r.telefono FROM objetos_encontrados o
       JOIN categorias c ON c.id = o.categoria_id JOIN reportantes r ON r.id = o.reportante_id WHERE o.id = $1`, [id])).rows[0];

  it('1. registra un objeto electrónico y lo guarda realmente en PostgreSQL', async () => {
    const r = await post(cuerpoValido({ categoria: 'ELECTRONICO' }));
    assert.equal(r.status, 201);
    const j = await r.json();
    assert.match(j.objeto.id, /^ELEC-\d{6}$/);
    const fila = await consultarObjeto(j.objeto.id);
    assert.ok(fila, 'la fila existe en la BD');
    assert.equal(fila.categoria, 'ELECTRONICO');
    assert.equal(fila.nombre, 'Ana');
    assert.equal(fila.funcionario_id, 1);
    assert.equal(fila.registrado_por, funcionarioId);
  });

  it('2. registra un documento personal', async () => {
    const r = await post(cuerpoValido({ categoria: 'DOCUMENTO', tipoObjeto: 'Cédula' }));
    assert.equal(r.status, 201);
    assert.match((await r.json()).objeto.id, /^DOC-\d{6}$/);
  });

  it('3. registra un objeto general', async () => {
    const r = await post(cuerpoValido({ categoria: 'GENERAL', tipoObjeto: 'Termo' }));
    assert.equal(r.status, 201);
    assert.match((await r.json()).objeto.id, /^OBJ-\d{6}$/);
  });

  it('4. rechaza un nombre vacío y no crea registros', async () => {
    const antes = [await contar('objetos_encontrados'), await contar('reportantes')];
    const r = await post(cuerpoValido({ nombre: '' }));
    assert.equal(r.status, 400);
    const j = await r.json();
    assert.equal(j.codigo, 'CAMPOS_OBLIGATORIOS');
    assert.ok(j.campos.nombre);
    assert.deepEqual([await contar('objetos_encontrados'), await contar('reportantes')], antes);
  });

  it('5. rechaza una categoría no permitida', async () => {
    const r = await post(cuerpoValido({ categoria: 'MASCOTA' }));
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, 'CATEGORIA_INVALIDA');
  });

  it('5b. rechaza un tipo de persona no permitido', async () => {
    const r = await post(cuerpoValido({ tipoPersona: 'egresado' }));
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, 'TIPO_PERSONA_INVALIDO');
  });

  it('6. acepta teléfono vacío (se guarda NULL)', async () => {
    const r = await post(cuerpoValido({ telefono: '' }));
    assert.equal(r.status, 201);
    const fila = await consultarObjeto((await r.json()).objeto.id);
    assert.equal(fila.telefono, null);
  });

  it('7. acepta descripción vacía (se guarda NULL)', async () => {
    const r = await post(cuerpoValido({ descripcion: '' }));
    assert.equal(r.status, 201);
    const fila = await consultarObjeto((await r.json()).objeto.id);
    assert.equal(fila.descripcion, null);
  });

  it('8. asigna automáticamente el estado "Pendiente" aunque el cliente intente enviar otro', async () => {
    const r = await post(cuerpoValido({ estado: 'Cerrado' }));
    const j = await r.json();
    assert.equal(j.objeto.estado, 'Pendiente');
    assert.equal((await consultarObjeto(j.objeto.id)).estado, 'Pendiente');
  });

  it('9. genera identificadores distintos, incluso con 25 registros simultáneos', async () => {
    const respuestas = await Promise.all(Array.from({ length: 25 }, () => post(cuerpoValido({ categoria: 'GENERAL' }))));
    const ids = await Promise.all(respuestas.map(async (r) => { assert.equal(r.status, 201); return (await r.json()).objeto.id as string; }));
    assert.equal(new Set(ids).size, 25);
  });

  it('9b. la misma clave de idempotencia no duplica el registro (doble clic)', async () => {
    const clave = randomUUID();
    const antes = await contar('objetos_encontrados');
    const [a, b] = await Promise.all([post(cuerpoValido({ claveIdempotencia: clave })), post(cuerpoValido({ claveIdempotencia: clave }))]);
    const ja = await a.json(); const jb = await b.json();
    assert.equal(ja.objeto.id, jb.objeto.id);
    assert.equal(await contar('objetos_encontrados'), antes + 1);
  });

  it('11. rechaza una petición no autenticada (401) sin guardar nada', async () => {
    const antes = await contar('objetos_encontrados');
    const r = await post(cuerpoValido(), null);
    assert.equal(r.status, 401);
    assert.equal((await r.json()).codigo, 'NO_AUTENTICADO');
    assert.equal(await contar('objetos_encontrados'), antes);
  });

  it('11b. el login rechaza credenciales incorrectas', async () => {
    const r = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: CORREO, clave: 'incorrecta-123' }),
    });
    assert.equal(r.status, 401);
  });

  it('13. genera eventos de auditoría (éxito, rechazo y no autenticado) sin datos personales', async () => {
    const r = await post(cuerpoValido({ nombre: 'NombreSecreto', categoria: 'DOCUMENTO' }));
    const id = (await r.json()).objeto.id as string;
    await post(cuerpoValido({ categoria: 'MASCOTA' }));
    await post(cuerpoValido(), null);
    await auditoria.esperarPendientes();
    const texto = await fsp.readFile(rutaAuditoria, 'utf8');
    const eventos = texto.trim().split('\n').map((l) => JSON.parse(l));
    const exito = eventos.find((e) => e.objetoId === id);
    assert.ok(exito);
    assert.equal(exito.accion, 'REGISTRAR_OBJETO');
    assert.equal(exito.resultado, 'EXITO');
    assert.equal(exito.usuario, `funcionario:${funcionarioId}`);
    assert.ok(eventos.some((e) => e.resultado === 'RECHAZADO' && e.detalle.startsWith('CATEGORIA_INVALIDA')));
    assert.ok(eventos.some((e) => e.usuario === 'anonimo' && e.detalle === 'NO_AUTENTICADO'));
    assert.ok(eventos.some((e) => e.accion === 'LOGIN' && e.resultado === 'EXITO'));
    assert.ok(!texto.includes('NombreSecreto'), 'la auditoría no guarda datos personales');
    assert.ok(!texto.includes(CLAVE), 'la auditoría no guarda contraseñas');
  });

  it('14. un error de BD a mitad de la transacción deja 0 datos parciales (ROLLBACK real)', async () => {
    // Pool "saboteado": falla justo al insertar el objeto, DESPUÉS de haber insertado al reportante.
    const saboteado: PoolLike = {
      query: (t, p) => pool.query(t, p),
      connect: async (): Promise<ClientLike> => {
        const c = await pool.connect();
        return {
          query: (t, p) => (t.includes('INSERT INTO objetos_encontrados') ? Promise.reject(new Error('fallo inyectado')) : c.query(t, p)),
          release: () => c.release(),
        };
      },
    };
    const { url } = await levantar(saboteado);
    const cookieSab = await iniciarSesion(url);
    const antes = [await contar('objetos_encontrados'), await contar('reportantes')];

    const res = await fetch(`${url}/api/objetos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieSab }, body: JSON.stringify(cuerpoValido({ nombre: 'NoDebeQuedar' })),
    });
    assert.equal(res.status, 500);
    const j = await res.json();
    assert.equal(j.codigo, 'ERROR_ALMACENAMIENTO');
    assert.ok(!JSON.stringify(j).includes('fallo inyectado'), 'no se filtran detalles internos al usuario');
    assert.deepEqual([await contar('objetos_encontrados'), await contar('reportantes')], antes);
    const huerfano = await pool.query("SELECT 1 FROM reportantes WHERE nombre = 'NoDebeQuedar'");
    assert.equal(huerfano.rowCount, 0);
  });

  it('funcionario inexistente: 400 y sin registros', async () => {
    const antes = await contar('reportantes');
    const r = await post(cuerpoValido({ funcionarioResponsableId: 999999 }));
    assert.equal(r.status, 400);
    assert.equal((await r.json()).codigo, 'FUNCIONARIO_INVALIDO');
    assert.equal(await contar('reportantes'), antes);
  });
});
