import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { AuditoriaService } from '../../src/services/AuditoriaService';

const ruta = path.join(os.tmpdir(), `auditoria-test-${process.pid}.txt`);

afterEach(async () => {
  AuditoriaService.reiniciarParaPruebas();
  await fsp.rm(ruta, { force: true });
});

describe('Singleton — AuditoriaService', () => {
  it('getInstance() devuelve siempre la misma instancia', () => {
    const a = AuditoriaService.getInstance(ruta);
    const b = AuditoriaService.getInstance();
    assert.equal(a, b);
  });

  it('registra usuario, acción, fecha/hora, resultado y objeto', async () => {
    const aud = AuditoriaService.getInstance(ruta);
    await aud.registrar({ usuario: 'funcionario:3', accion: 'REGISTRAR_OBJETO', resultado: 'EXITO', objetoId: 'ELEC-000001' });
    const lineas = (await fsp.readFile(ruta, 'utf8')).trim().split('\n');
    assert.equal(lineas.length, 1);
    const ev = JSON.parse(lineas[0]);
    assert.equal(ev.usuario, 'funcionario:3');
    assert.equal(ev.accion, 'REGISTRAR_OBJETO');
    assert.equal(ev.resultado, 'EXITO');
    assert.equal(ev.objetoId, 'ELEC-000001');
    assert.ok(!Number.isNaN(Date.parse(ev.fechaHora)));
  });

  it('con 200 escrituras concurrentes no se corrompe ninguna línea', async () => {
    const aud = AuditoriaService.getInstance(ruta);
    await Promise.all(
      Array.from({ length: 200 }, (_, i) => aud.registrar({ usuario: `u${i}`, accion: 'PRUEBA', resultado: 'EXITO', detalle: 'x'.repeat(200) })),
    );
    const lineas = (await fsp.readFile(ruta, 'utf8')).trim().split('\n');
    assert.equal(lineas.length, 200);
    for (const l of lineas) JSON.parse(l); // lanzaría si alguna línea estuviera dañada
    const usuarios = new Set(lineas.map((l) => JSON.parse(l).usuario));
    assert.equal(usuarios.size, 200);
  });

  it('un salto de línea en el detalle no puede forjar una entrada falsa', async () => {
    const aud = AuditoriaService.getInstance(ruta);
    await aud.registrar({ usuario: 'u', accion: 'A', resultado: 'ERROR', detalle: 'linea1\n{"usuario":"admin"}' });
    const lineas = (await fsp.readFile(ruta, 'utf8')).trim().split('\n');
    assert.equal(lineas.length, 1);
  });

  it('si el archivo no se puede escribir, registrar() no lanza error', async () => {
    const aud = AuditoriaService.getInstance(path.join(os.tmpdir(), 'carpeta-inexistente-xyz', 'a.txt'));
    await assert.doesNotReject(aud.registrar({ usuario: 'u', accion: 'A', resultado: 'EXITO' }));
  });
});
