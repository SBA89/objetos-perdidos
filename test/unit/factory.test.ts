import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DocumentoPersonalFactory, ObjetoElectronicoFactory, ObjetoFactory, ObjetoGeneralFactory } from '../../src/factories/ObjetoFactory';
import type { DatosNuevoObjeto, IObjetoPerdido } from '../../src/models/IObjetoPerdido';
import { DocumentoPersonal } from '../../src/models/DocumentoPersonal';
import { ObjetoElectronico } from '../../src/models/ObjetoElectronico';
import { ObjetoGeneral } from '../../src/models/ObjetoGeneral';
import { CategoriaNoPermitidaError } from '../../src/types/errores';

const datos = (consecutivo: number): DatosNuevoObjeto => ({
  consecutivo, tipoObjeto: 'X', lugarEncuentro: 'Y', descripcion: null,
  fechaHallazgo: '2026-10-01', reportanteId: 1, funcionarioResponsableId: 1,
});

describe('Factory Method — ObjetoFactory', () => {
  it('crea el producto concreto que corresponde a cada categoría', () => {
    assert.ok(ObjetoFactory.crearObjeto('ELECTRONICO', datos(1)) instanceof ObjetoElectronico);
    assert.ok(ObjetoFactory.crearObjeto('DOCUMENTO', datos(1)) instanceof DocumentoPersonal);
    assert.ok(ObjetoFactory.crearObjeto('GENERAL', datos(1)) instanceof ObjetoGeneral);
  });

  it('genera IDs con el prefijo de su categoría (ELEC-, DOC-, OBJ-)', () => {
    assert.equal(ObjetoFactory.crearObjeto('ELECTRONICO', datos(7)).id, 'ELEC-000007');
    assert.equal(ObjetoFactory.crearObjeto('DOCUMENTO', datos(7)).id, 'DOC-000007');
    assert.equal(ObjetoFactory.crearObjeto('GENERAL', datos(7)).id, 'OBJ-000007');
  });

  it('todo producto nace en estado "Pendiente" (RF-05)', () => {
    for (const c of ['ELECTRONICO', 'DOCUMENTO', 'GENERAL']) {
      assert.equal(ObjetoFactory.crearObjeto(c, datos(1)).estado, 'Pendiente');
    }
  });

  it('cada producto cumple el contrato IObjetoPerdido y tiene comportamiento propio', () => {
    const productos: IObjetoPerdido[] = ['ELECTRONICO', 'DOCUMENTO', 'GENERAL'].map((c) => ObjetoFactory.crearObjeto(c, datos(1)));
    const instrucciones = new Set(productos.map((p) => p.instruccionCustodia()));
    assert.equal(instrucciones.size, 3, 'cada clase concreta define su propia custodia');
    for (const p of productos) {
      assert.equal(typeof p.id, 'string');
      assert.equal(p.reportanteId, 1);
      assert.equal(p.funcionarioResponsableId, 1);
    }
  });

  it('los creadores concretos sobrescriben el factory method', () => {
    assert.ok(new ObjetoElectronicoFactory().crear(datos(1)) instanceof ObjetoElectronico);
    assert.ok(new DocumentoPersonalFactory().crear(datos(1)) instanceof DocumentoPersonal);
    assert.ok(new ObjetoGeneralFactory().crear(datos(1)) instanceof ObjetoGeneral);
  });

  it('rechaza categorías no permitidas', () => {
    assert.throws(() => ObjetoFactory.crearObjeto('MASCOTA', datos(1)), CategoriaNoPermitidaError);
  });

  it('IDs distintos para consecutivos distintos', () => {
    const ids = new Set([1, 2, 3, 4, 5].map((n) => ObjetoFactory.crearObjeto('GENERAL', datos(n)).id));
    assert.equal(ids.size, 5);
  });

  it('rechaza consecutivos inválidos', () => {
    assert.throws(() => ObjetoFactory.crearObjeto('GENERAL', datos(0)));
    assert.throws(() => ObjetoFactory.crearObjeto('GENERAL', datos(1.5)));
  });
});
