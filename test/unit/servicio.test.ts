import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RegistroObjetoService } from '../../src/services/RegistroObjetoService';
import { ErrorNegocio } from '../../src/types/errores';
import { entradaValida } from '../helpers/datos';
import { crearPoolFalso } from '../helpers/fakePool';

describe('RegistroObjetoService (con base de datos simulada)', () => {
  it('registra en una transacción: BEGIN → inserts → COMMIT, y asigna estado Pendiente', async () => {
    const { pool, consultas, estado } = crearPoolFalso();
    const r = await new RegistroObjetoService(pool).registrar(entradaValida(), 1);
    assert.equal(r.id, 'ELEC-000001');
    assert.equal(r.estado, 'Pendiente');
    assert.equal(consultas[0], 'BEGIN');
    assert.equal(consultas.at(-1), 'COMMIT');
    assert.equal(estado.commit, 1);
    assert.equal(estado.rollback, 0);
    assert.equal(estado.liberados, 1);
    const orden = consultas.findIndex((c) => c.startsWith('INSERT INTO reportantes')) < consultas.findIndex((c) => c.startsWith('INSERT INTO objetos_encontrados'));
    assert.ok(orden, 'primero el reportante, luego el objeto que lo referencia');
  });

  it('teléfono y descripción vacíos se guardan como NULL', async () => {
    const { pool } = crearPoolFalso();
    const capturadas: unknown[][] = [];
    const original = pool.connect.bind(pool);
    pool.connect = async () => {
      const c = await original();
      const q = c.query.bind(c);
      c.query = async (t, p) => { if (t.includes('INSERT INTO')) capturadas.push(p ?? []); return q(t, p); };
      return c;
    };
    await new RegistroObjetoService(pool).registrar(entradaValida({ telefono: '', descripcion: '' }), 1);
    const reportante = capturadas[0];
    const objeto = capturadas[1];
    assert.equal(reportante[3], null);
    assert.equal(objeto[4], null);
    assert.equal(objeto[6], 'Pendiente');
  });

  it('usa el prefijo y la secuencia de cada categoría', async () => {
    const { pool } = crearPoolFalso();
    const s = new RegistroObjetoService(pool);
    assert.match((await s.registrar(entradaValida({ categoria: 'ELECTRONICO' }), 1)).id, /^ELEC-\d{6}$/);
    assert.match((await s.registrar(entradaValida({ categoria: 'DOCUMENTO' }), 1)).id, /^DOC-\d{6}$/);
    assert.match((await s.registrar(entradaValida({ categoria: 'GENERAL' }), 1)).id, /^OBJ-\d{6}$/);
  });

  it('dos registros seguidos producen IDs diferentes', async () => {
    const { pool } = crearPoolFalso();
    const s = new RegistroObjetoService(pool);
    const a = await s.registrar(entradaValida(), 1);
    const b = await s.registrar(entradaValida(), 1);
    assert.notEqual(a.id, b.id);
  });

  it('error de BD al insertar el objeto: ROLLBACK, sin COMMIT y conexión liberada (sin datos parciales)', async () => {
    const { pool, estado, consultas } = crearPoolFalso({ fallarEn: 'INSERT INTO objetos_encontrados' });
    await assert.rejects(new RegistroObjetoService(pool).registrar(entradaValida(), 1), /fallo simulado/);
    assert.equal(estado.commit, 0);
    assert.equal(estado.rollback, 1);
    assert.equal(estado.liberados, 1);
    assert.ok(consultas.some((c) => c.startsWith('INSERT INTO reportantes')), 'el reportante sí se había insertado dentro de la transacción…');
    assert.equal(consultas.at(-1), 'ROLLBACK', '…y se revirtió');
  });

  it('funcionario inexistente: ErrorNegocio 400 y ROLLBACK', async () => {
    const { pool, estado } = crearPoolFalso();
    const sinFuncionario = { ...pool, connect: async () => {
      const c = await pool.connect();
      const q = c.query.bind(c);
      c.query = async (t, p) => (t.includes('FROM funcionarios') ? { rows: [] } : q(t, p));
      return c;
    } };
    await assert.rejects(
      new RegistroObjetoService(sinFuncionario).registrar(entradaValida(), 1),
      (e: unknown) => e instanceof ErrorNegocio && e.codigo === 'FUNCIONARIO_INVALIDO' && e.estado === 400,
    );
    assert.equal(estado.commit, 0);
    assert.equal(estado.rollback, 1);
  });

  it('clave de idempotencia ya usada: devuelve el registro existente sin abrir transacción', async () => {
    const { pool, estado } = crearPoolFalso();
    const existente = { id: 'DOC-000009', categoria: 'DOCUMENTO', estado: 'Pendiente', tipo_objeto: 'Carné', lugar_encuentro: 'Aula', fecha_hallazgo: '2026-10-01', reportante_id: 4, funcionario_id: 1 };
    const conClave = { ...pool, query: async (t: string, p?: unknown[]) => (t.includes('clave_idempotencia') ? { rows: [existente] } : pool.query(t, p)) };
    const r = await new RegistroObjetoService(conClave).registrar(entradaValida({ claveIdempotencia: '2f6d1c0e-6a4b-4c7a-9c1d-3b8f5e2a7d10' }), 1);
    assert.equal(r.id, 'DOC-000009');
    assert.equal(r.repetido, true);
    assert.equal(estado.conexiones, 0);
  });
});
