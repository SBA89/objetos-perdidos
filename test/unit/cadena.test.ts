import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { construirCadenaRegistro } from '../../src/validators/cadenaRegistro';
import { ValidatorHandler, VALIDO, type ContextoValidacion, type ResultadoValidacion } from '../../src/validators/ValidatorHandler';
import { cuerpoValido } from '../helpers/datos';

const sesion = { id: 1, nombre: 'Funcionario Demo', correo: 'demo@example.com' };
const reloj = () => new Date(2026, 9, 9); // 9-oct-2026
const ctx = (entrada: unknown, s: typeof sesion | null = sesion): ContextoValidacion => ({ sesion: s, entrada, traza: [] });

describe('Chain of Responsibility — cadena de validaciones', () => {
  it('una entrada válida atraviesa los 4 eslabones en orden', () => {
    const c = ctx(cuerpoValido());
    const r = construirCadenaRegistro(reloj).handle(c);
    assert.equal(r.valido, true);
    assert.deepEqual(c.traza, ['AutenticacionHandler', 'CamposObligatoriosHandler', 'ReportanteValidoHandler', 'ObjetoValidoHandler']);
  });

  it('sin sesión se detiene en el primer eslabón (401) y no ejecuta los demás', () => {
    const c = ctx(cuerpoValido(), null);
    const r = construirCadenaRegistro(reloj).handle(c);
    assert.equal(r.valido, false);
    if (!r.valido) { assert.equal(r.estado, 401); assert.equal(r.codigo, 'NO_AUTENTICADO'); }
    assert.deepEqual(c.traza, ['AutenticacionHandler']);
  });

  it('un nombre vacío se rechaza en CamposObligatoriosHandler y detiene la cadena', () => {
    const c = ctx(cuerpoValido({ nombre: '   ' }));
    const r = construirCadenaRegistro(reloj).handle(c);
    assert.equal(r.valido, false);
    if (!r.valido) { assert.equal(r.codigo, 'CAMPOS_OBLIGATORIOS'); assert.ok(r.campos?.nombre); }
    assert.deepEqual(c.traza, ['AutenticacionHandler', 'CamposObligatoriosHandler']);
  });

  it('informa todos los campos obligatorios faltantes a la vez', () => {
    const r = construirCadenaRegistro(reloj).handle(ctx({}));
    assert.equal(r.valido, false);
    if (!r.valido) {
      assert.deepEqual(Object.keys(r.campos ?? {}).sort(),
        ['apellido', 'categoria', 'fechaHallazgo', 'funcionarioResponsableId', 'lugarEncuentro', 'nombre', 'tipoObjeto', 'tipoPersona']);
    }
  });

  it('teléfono y descripción vacíos son válidos (RF-04)', () => {
    const r = construirCadenaRegistro(reloj).handle(ctx(cuerpoValido({ telefono: '', descripcion: '' })));
    assert.equal(r.valido, true);
  });

  it('tipo de persona no permitido se rechaza en ReportanteValidoHandler', () => {
    const c = ctx(cuerpoValido({ tipoPersona: 'alienígena' }));
    const r = construirCadenaRegistro(reloj).handle(c);
    assert.equal(r.valido, false);
    if (!r.valido) assert.equal(r.codigo, 'TIPO_PERSONA_INVALIDO');
    assert.equal(c.traza.at(-1), 'ReportanteValidoHandler');
  });

  it('categoría no permitida se rechaza en ObjetoValidoHandler (último eslabón)', () => {
    const c = ctx(cuerpoValido({ categoria: 'MASCOTA' }));
    const r = construirCadenaRegistro(reloj).handle(c);
    assert.equal(r.valido, false);
    if (!r.valido) assert.equal(r.codigo, 'CATEGORIA_INVALIDA');
    assert.equal(c.traza.at(-1), 'ObjetoValidoHandler');
  });

  it('rechaza correo con formato inválido, fecha futura y fecha inexistente', () => {
    const correo = construirCadenaRegistro(reloj).handle(ctx(cuerpoValido({ correo: 'no-es-correo' })));
    const futura = construirCadenaRegistro(reloj).handle(ctx(cuerpoValido({ fechaHallazgo: '2026-10-10' })));
    const falsa = construirCadenaRegistro(reloj).handle(ctx(cuerpoValido({ fechaHallazgo: '2026-02-31' })));
    for (const r of [correo, futura, falsa]) assert.equal(r.valido, false);
  });

  it('acepta la fecha de hoy', () => {
    assert.equal(construirCadenaRegistro(reloj).handle(ctx(cuerpoValido({ fechaHallazgo: '2026-10-09' }))).valido, true);
  });

  it('los eslabones se pueden reordenar/ampliar sin modificar los existentes (setNext)', () => {
    const orden: string[] = [];
    class A extends ValidatorHandler { protected validar(): ResultadoValidacion { orden.push('A'); return VALIDO; } }
    class B extends ValidatorHandler { protected validar(): ResultadoValidacion { orden.push('B'); return { valido: false, estado: 400, codigo: 'B', mensaje: 'x' }; } }
    class C extends ValidatorHandler { protected validar(): ResultadoValidacion { orden.push('C'); return VALIDO; } }
    const a = new A();
    a.setNext(new B()).setNext(new C());
    const r = a.handle(ctx({}));
    assert.equal(r.valido, false);
    assert.deepEqual(orden, ['A', 'B'], 'C nunca se ejecuta porque B falló');
  });
});
