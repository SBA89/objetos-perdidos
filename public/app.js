'use strict';
/* Interfaz del módulo "Registrar objeto encontrado". Sin scripts en línea (compatible con la CSP del servidor). */

const $ = (id) => document.getElementById(id);
const CAMPOS = ['nombre', 'apellido', 'correo', 'telefono', 'tipoPersona', 'categoria', 'tipoObjeto',
  'lugarEncuentro', 'fechaHallazgo', 'funcionarioResponsableId', 'descripcion'];
const ETIQUETA_PERSONA = { estudiante: 'Estudiante', funcionario: 'Funcionario', docente: 'Docente', visitante: 'Visitante' };

let usuarioActual = null;
let claveIdempotencia = null;

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function hoyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function api(ruta, opciones = {}) {
  const respuesta = await fetch(ruta, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  let datos = {};
  try { datos = await respuesta.json(); } catch { /* respuesta sin cuerpo JSON */ }
  return { estado: respuesta.status, datos };
}

function mostrarAlerta(id, mensaje) {
  const el = $(id);
  el.textContent = mensaje || '';
  el.hidden = !mensaje;
}

function limpiarErrores() {
  CAMPOS.forEach((c) => {
    $(`err-${c}`).textContent = '';
    $(c).closest('.campo').classList.remove('campo--invalido');
  });
  mostrarAlerta('alerta-registro', '');
}

function marcarErrores(campos) {
  let primero = null;
  Object.entries(campos || {}).forEach(([campo, mensaje]) => {
    const err = $(`err-${campo}`);
    if (!err) return;
    err.textContent = mensaje;
    $(campo).closest('.campo').classList.add('campo--invalido');
    if (!primero) primero = $(campo);
  });
  if (primero) primero.focus();
}

function opcion(valor, texto) {
  const o = document.createElement('option');
  o.value = valor;
  o.textContent = texto;
  return o;
}

function llenarSelect(select, opciones, textoInicial) {
  select.replaceChildren(opcion('', textoInicial));
  opciones.forEach(([v, t]) => select.appendChild(opcion(v, t)));
}

/* ---------- Vistas ---------- */
function mostrarLogin() {
  usuarioActual = null;
  $('vista-registro').hidden = true;
  $('barra-usuario').hidden = true;
  $('vista-login').hidden = false;
  $('login-correo').focus();
}

async function mostrarRegistro(usuario) {
  usuarioActual = usuario;
  $('nombre-usuario').textContent = usuario.nombre;
  $('barra-usuario').hidden = false;
  $('vista-login').hidden = true;
  $('vista-registro').hidden = false;

  const { estado, datos } = await api('/api/catalogos');
  if (estado === 401) return mostrarLogin();
  if (estado !== 200) return mostrarAlerta('alerta-registro', 'No se pudieron cargar los catálogos. Recargue la página.');

  llenarSelect($('tipoPersona'), datos.tiposPersona.map((t) => [t, ETIQUETA_PERSONA[t] || t]), 'Seleccione...');
  llenarSelect($('categoria'), datos.categorias.map((c) => [c.codigo, c.nombre]), 'Seleccione...');
  llenarSelect($('funcionarioResponsableId'), datos.funcionarios.map((f) => [String(f.id), f.nombre]), 'Seleccione...');
  $('funcionarioResponsableId').value = String(usuario.id); // por defecto: quien opera el sistema (editable)
  $('fechaHallazgo').max = hoyLocal();
  $('fechaHallazgo').value = hoyLocal();
  claveIdempotencia = uuid();
}

function reiniciarFormulario() {
  $('form-registro').reset();
  limpiarErrores();
  if (usuarioActual) $('funcionarioResponsableId').value = String(usuarioActual.id);
  $('fechaHallazgo').value = hoyLocal();
  claveIdempotencia = uuid();
}

/* ---------- Eventos ---------- */
$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  mostrarAlerta('alerta-login', '');
  const boton = $('btn-login');
  boton.disabled = true;
  try {
    const { estado, datos } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ correo: $('login-correo').value, clave: $('login-clave').value }),
    });
    if (estado === 200) {
      $('login-clave').value = '';
      await mostrarRegistro(datos.usuario);
    } else {
      mostrarAlerta('alerta-login', datos.mensaje || 'No fue posible iniciar sesión.');
    }
  } catch {
    mostrarAlerta('alerta-login', 'No hay conexión con el servidor.');
  } finally {
    boton.disabled = false;
  }
});

$('btn-salir').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  $('panel-exito').hidden = true;
  $('form-registro').hidden = false;
  mostrarLogin();
});

$('btn-limpiar').addEventListener('click', reiniciarFormulario);

$('btn-nuevo').addEventListener('click', () => {
  $('panel-exito').hidden = true;
  $('form-registro').hidden = false;
  reiniciarFormulario();
  $('nombre').focus();
});

$('form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  limpiarErrores();
  const cuerpo = { claveIdempotencia };
  CAMPOS.forEach((c) => { cuerpo[c] = $(c).value; });

  const boton = $('btn-guardar');
  boton.disabled = true; // evita doble envío
  boton.textContent = 'Guardando...';
  try {
    const { estado, datos } = await api('/api/objetos', { method: 'POST', body: JSON.stringify(cuerpo) });
    if (estado === 201 || estado === 200) {
      const o = datos.objeto;
      $('exito-id').textContent = o.id;
      $('exito-categoria').textContent = $('categoria').selectedOptions[0].textContent;
      $('exito-estado').textContent = o.estado;
      $('exito-objeto').textContent = `${o.tipoObjeto} — ${o.lugarEncuentro}`;
      $('exito-custodia').textContent = o.instruccionCustodia;
      $('exito-tiempo').textContent = `${datos.mensaje} Procesado por el servidor en ${datos.tiempoServidorMs} ms.`;
      $('form-registro').hidden = true;
      $('panel-exito').hidden = false;
      $('panel-exito').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (estado === 401) {
      mostrarLogin();
      mostrarAlerta('alerta-login', 'Su sesión expiró. Inicie sesión nuevamente.');
    } else {
      marcarErrores(datos.campos);
      mostrarAlerta('alerta-registro', datos.mensaje || 'No se pudo completar el registro.');
    }
  } catch {
    mostrarAlerta('alerta-registro', 'No hay conexión con el servidor. No se guardó ningún dato.');
  } finally {
    boton.disabled = false;
    boton.textContent = 'Registrar objeto';
  }
});

/* ---------- Arranque ---------- */
(async () => {
  try {
    const { estado, datos } = await api('/api/auth/sesion');
    if (estado === 200) await mostrarRegistro(datos.usuario);
    else mostrarLogin();
  } catch {
    mostrarLogin();
    mostrarAlerta('alerta-login', 'No hay conexión con el servidor.');
  }
})();
