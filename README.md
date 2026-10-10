# Sistema de Gestión de Objetos Perdidos — Módulo «Registrar objeto encontrado»

Universidad Católica Luis Amigó · Arquitectura de Sistemas

Módulo funcional (TypeScript + Express + PostgreSQL) que registra un objeto encontrado junto con su reportante y el funcionario responsable, con tres patrones de diseño implementados en código real: **Factory Method**, **Chain of Responsibility** y **Singleton**.

> **Estado de verificación (honesto):** las 30 pruebas unitarias (`npm test`) se ejecutaron y pasaron en el entorno donde se construyó el código. Las pruebas de **integración con PostgreSQL real**, el arranque del servidor y la compilación con las dependencias reales (`express`, `pg`, `bcrypt`) **no pudieron ejecutarse allí** (sin red ni PostgreSQL). Deben ejecutarse una vez en su equipo siguiendo los pasos de abajo; antes de la sustentación corra `npm run typecheck`, `npm test` y `npm run test:integration`.

---

## 1. Requisitos (Windows)

| Software | Versión | Nota |
|---|---|---|
| Node.js | **22 LTS o superior** | https://nodejs.org — marque «npm» al instalar |
| PostgreSQL | 14 o superior | https://www.postgresql.org/download/windows/ (incluye pgAdmin y SQL Shell/psql) |

Verifique en PowerShell: `node -v` (debe ser v22+) y `npm -v`.

## 2. Instalación

```powershell
cd objetos-perdidos
npm install
```

Si `bcrypt` fallara al instalarse (módulo nativo), instale las «Herramientas de compilación de C++» de Visual Studio, o alternativamente cambie `bcrypt` por `bcryptjs` (API compatible) en `package.json` y en `src/services/AuthService.ts` y `test/integration/api.test.ts`.

## 3. Crear la base de datos

Opción A — **pgAdmin**: clic derecho en *Databases → Create → Database…* y nómbrela `objetos_perdidos`.

Opción B — **SQL Shell (psql)** (Enter en todo para los valores por defecto, luego su contraseña de `postgres`):

```sql
CREATE DATABASE objetos_perdidos;
```

## 4. Configurar variables de entorno

```powershell
Copy-Item .env.example .env
notepad .env
```

Complete `DB_USER`, `DB_PASSWORD` (los de su PostgreSQL) y `SESSION_SECRET`. Para generar un secreto:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

(No hay credenciales en el repositorio: `.env` está en `.gitignore`.)

## 5. Crear tablas y datos de prueba

```powershell
npm run db:init
```

Aplica `sql/schema.sql` (tablas, claves, restricciones, secuencias) y `sql/seed.sql` (3 categorías y 3 funcionarios de prueba). Es re-ejecutable. Equivalente con psql: `psql -U <usuario> -d objetos_perdidos -f sql/schema.sql` y luego `-f sql/seed.sql`.

## 6. Asignar contraseña a un funcionario (para iniciar sesión)

El módulo exige autenticación real (RNF-S-03). Los funcionarios del seed no tienen contraseña hasta que usted se la asigna (queda guardada con **bcrypt**):

```powershell
npm run set-password -- recepcion@example.com
```

Escriba la contraseña cuando la pida (mínimo 8 caracteres). Use ese correo y esa contraseña en la pantalla de inicio de sesión.

## 7. Ejecutar

```powershell
npm run dev      # desarrollo (recarga automática)
# o bien
npm start        # compila a dist/ y ejecuta
```

Abra **http://localhost:3000**.

## 8. Verificar los registros en PostgreSQL

En pgAdmin (*Query Tool*) o psql:

```sql
SELECT o.id, c.nombre AS categoria, o.estado, o.tipo_objeto, o.lugar_encuentro, o.fecha_hallazgo,
       r.nombre || ' ' || r.apellido AS reportante, r.tipo_persona,
       f.nombre || ' ' || f.apellido AS funcionario_responsable, o.creado_en
FROM objetos_encontrados o
JOIN categorias   c ON c.id = o.categoria_id
JOIN reportantes  r ON r.id = o.reportante_id
JOIN funcionarios f ON f.id = o.funcionario_id
ORDER BY o.creado_en DESC;
```

Auditoría: abra `auditoria_logs.txt` (raíz del proyecto), una línea JSON por evento:
`{"fechaHora":"…","usuario":"funcionario:1","accion":"REGISTRAR_OBJETO","resultado":"EXITO","objetoId":"ELEC-000001","detalle":"12.4 ms"}`

## 9. Guion de demostración (≈5 min)

1. Abrir la app → muestra el **login** (sin sesión no se accede al formulario). Probar una contraseña incorrecta → mensaje genérico.
2. Iniciar sesión → aparece el formulario con catálogos cargados desde la BD.
3. Enviar vacío → errores por campo (validado **en el servidor**, `CamposObligatoriosHandler`).
4. Registrar un **objeto electrónico** → ID `ELEC-000001`, estado *Pendiente*, instrucción de custodia propia de la clase concreta, tiempo del servidor en ms.
5. Registrar un **documento** (`DOC-…`) y un **objeto general** (`OBJ-…`) con teléfono y descripción vacíos.
6. Mostrar `SELECT` en PostgreSQL (sección 8) y `auditoria_logs.txt`.
7. Mostrar en el código los 3 patrones (sección 11).
8. (Opcional) Apagar PostgreSQL y registrar → mensaje de error comprensible y **ningún dato parcial**.

## 10. Pruebas

### Automatizadas

```powershell
npm run typecheck           # compila src, test y scripts sin emitir archivos
npm test                    # 30 pruebas unitarias (no requieren BD)
npm run test:integration    # pruebas con Express + PostgreSQL reales (ver abajo)
```

**Integración:** cree una base **separada** (`CREATE DATABASE objetos_perdidos_test;`), deje `TEST_DB_NAME=objetos_perdidos_test` en `.env` y ejecute. Esa base se **vacía** (objetos y reportantes) en cada corrida: nunca apunte `TEST_DB_NAME` a la base real. Sin `TEST_DB_NAME` las pruebas de integración se omiten.

| # | Escenario solicitado | Dónde se prueba | Resultado esperado |
|---|---|---|---|
| 1 | Registro correcto electrónico | integración 1 · unit `servicio`, `factory` | 201, ID `ELEC-NNNNNN`, fila en BD |
| 2 | Registro correcto documento | integración 2 | 201, ID `DOC-NNNNNN` |
| 3 | Registro correcto objeto general | integración 3 | 201, ID `OBJ-NNNNNN` |
| 4 | Rechazo de nombre vacío | integración 4 · unit `cadena` | 400 `CAMPOS_OBLIGATORIOS`, tablas sin cambios |
| 5 | Rechazo de categoría no permitida | integración 5 · unit `cadena`, `factory` | 400 `CATEGORIA_INVALIDA` |
| 6 | Teléfono vacío válido | integración 6 · unit `servicio` | 201, `telefono` = NULL |
| 7 | Descripción vacía válida | integración 7 | 201, `descripcion` = NULL |
| 8 | Estado «Pendiente» automático | integración 8 · unit `factory` | `Pendiente` aunque el cliente envíe otro estado |
| 9 | IDs distintos | integración 9 (25 simultáneos) · unit `factory` | 25 IDs únicos |
| 10 | Persistencia real en PostgreSQL | integración 1–9 (consultan la BD) | la fila existe con sus relaciones |
| 11 | Petición no autenticada | integración 11 · unit `cadena` | 401 `NO_AUTENTICADO`, sin registros |
| 12 | Orden de la cadena | unit `cadena` (`traza`) | Autenticación → Campos → Reportante → Objeto; se detiene en el primer fallo |
| 13 | Evento de auditoría | integración 13 · unit `auditoria` | línea con usuario, acción, fecha, resultado, objeto; sin datos personales |
| 14 | Error de BD sin datos parciales | integración 14 (ROLLBACK real) · unit `servicio` | 500 `ERROR_ALMACENAMIENTO`, 0 filas nuevas |

### Manuales (con la interfaz)

| Acción | Resultado esperado |
|---|---|
| Abrir `/` sin sesión | Pantalla de login |
| Login con clave incorrecta | «Correo o contraseña incorrectos.» |
| Enviar formulario vacío | Errores en nombre, apellido, tipo, categoría, tipo de objeto, lugar (fecha y funcionario vienen precargados) |
| Registrar con correo `abc` | Error en correo |
| Hacer doble clic en «Registrar» | Un solo registro (botón deshabilitado + clave de idempotencia) |
| Registrar válido | Panel verde con ID, estado *Pendiente* y tiempo en ms |
| Cerrar sesión y volver a `/api/catalogos` | 401 |

## 11. Dónde está cada patrón (para la sustentación)

| Patrón / rol formal | Archivo | Cómo identificarlo |
|---|---|---|
| **Factory Method** · Producto abstracto | `src/models/IObjetoPerdido.ts` | Interfaz `IObjetoPerdido` |
| · Productos concretos | `src/models/ObjetoElectronico.ts`, `DocumentoPersonal.ts`, `ObjetoGeneral.ts` | Prefijos `ELEC`/`DOC`/`OBJ` y `instruccionCustodia()` propia |
| · Creador | `src/factories/ObjetoFactory.ts` → `abstract class ObjetoFactory` | Método abstracto `crearProducto()` (el *factory method*) y operación plantilla `crear()` |
| · Creadores concretos | mismo archivo: `ObjetoElectronicoFactory`, `DocumentoPersonalFactory`, `ObjetoGeneralFactory` | Sobrescriben `crearProducto()` |
| · Selector (del documento) | mismo archivo: `ObjetoFactory.crearObjeto(categoria, datos)` | Fachada estática que elige el creador; **sola sería Simple Factory**, el patrón formal lo dan las subclases |
| · Uso | `src/services/RegistroObjetoService.ts` | `ObjetoFactory.crearObjeto(...)` |
| **Chain of Responsibility** · Manejador | `src/validators/ValidatorHandler.ts` | `setNext()` + método plantilla `handle()` que se detiene si `validar()` falla |
| · Manejadores concretos | `AutenticacionHandler.ts`, `CamposObligatoriosHandler.ts`, `ReportanteValidoHandler.ts` y `ObjetoValidoHandler.ts` (4.º eslabón añadido) | Cada uno implementa solo `validar()` |
| · Armado de la cadena | `src/validators/cadenaRegistro.ts` | `auth.setNext(campos).setNext(reportante).setNext(objeto)` |
| · Cliente | `src/controllers/ObjetoController.ts` | `this.cadena.handle(contexto)` antes de llamar al servicio |
| **Singleton** | `src/services/AuditoriaService.ts` | Constructor `private`, `static getInstance()`, cola de escritura serializada |

**Alcance real del Singleton:** garantiza **una instancia por proceso** de Node.js. Con varios procesos/servidores habría una instancia por cada uno escribiendo en el mismo archivo. Lo que evita que las líneas se mezclen es la **cola de promesas** (una `appendFile` completa tras otra), no el Singleton por sí solo.

## 12. Decisiones tomadas ante inconsistencias del documento

1. **50 ms vs 2 s.** El documento exige «estrictamente inferior a 50 ms» (Eficiencia de ejecución) y «< 2 segundos» (RNF-EE-01). No se afirma ninguno sin medirlo. Objetivo recomendado: **p95 del procesamiento en servidor ≤ 200 ms** y **máximo extremo a extremo ≤ 2 s** en red local; 50 ms queda como meta ideal reportada, no como garantía (Express no «garantiza» tiempos y el `COMMIT` de PostgreSQL implica escritura en disco). Cómo medirlo: la interfaz muestra `tiempoServidorMs` y la cabecera `X-Tiempo-Servidor-Ms`; para estadísticas (min/prom/p50/p95/máx):
   ```powershell
   $env:PERF_CORREO="recepcion@example.com"; $env:PERF_CLAVE="<su contraseña>"; npm run medir
   ```
   Crea 50 registros con descripción `[PRUEBA-RENDIMIENTO]`; para borrarlos (en psql): `DELETE FROM objetos_encontrados WHERE descripcion = '[PRUEBA-RENDIMIENTO]'; DELETE FROM reportantes WHERE nombre='Prueba' AND apellido='Rendimiento';`
2. **Autenticación.** El documento menciona `express-session` y `bcrypt` pero no define usuarios. Se implementó un login real contra la tabla `funcionarios` (hash bcrypt). Es una autenticación mínima: sin roles ni bloqueo por intentos.
3. **Funcionario responsable obligatorio.** RF-03 no lo lista, pero RF-07/RF-08 y la regla 5 exigen asociarlo; la BD lo declara `NOT NULL`. La categoría también se exige (RF-06).
4. **Cuarto eslabón.** Ningún manejador del documento valida la categoría (RF-06) ni la fecha; se añadió `ObjetoValidoHandler` (justificado por Abierto/Cerrado).
5. **Factory.** El documento describe un método estático (Simple Factory). Se implementó el Factory Method formal y se conservó `crearObjeto()` como selector.
6. **Singleton y I/O.** El documento atribuye al Singleton evitar corrupción del archivo; eso lo logra la cola de escrituras.
7. **«Vinculación con reportante válido» (RF-07)** no puede garantizarla un validador: la garantizan `reportante_id NOT NULL` + clave foránea + transacción.
8. **IDs únicos:** secuencias de PostgreSQL por categoría (`nextval` atómico) + clave primaria. Una transacción revertida deja huecos en la numeración (no duplicados).

## 13. Seguridad: qué se hizo y qué no

Hecho: validación en servidor; consultas parametrizadas; bcrypt; sesión `httpOnly` + `sameSite=lax`; regeneración de sesión al entrar; respuesta de login sin revelar qué dato falló; cabeceras de seguridad y CSP; mensajes de error sin detalles internos; auditoría sin datos personales ni contraseñas; sin endpoints de modificar/borrar; rol de BD de mínimos privilegios opcional (`sql/roles.sql`).

Fuera de alcance / mejoras futuras: HTTPS, límite de intentos de login, almacén de sesiones persistente (hoy `MemoryStore`: las sesiones se pierden al reiniciar), roles de usuario, deduplicar reportantes por correo, rotación del archivo de auditoría.

## 14. Estructura

```
src/
  controllers/  AuthController, ObjetoController          (HTTP)
  routes/       index.ts
  models/       IObjetoPerdido + 3 productos concretos     (Factory: productos)
  factories/    ObjetoFactory.ts                           (Factory: creadores)
  validators/   ValidatorHandler + 4 manejadores + cadena  (Chain of Responsibility)
  services/     RegistroObjetoService, AuditoriaService (Singleton), AuthService, CatalogoService
  database/     pool.ts, initDb.ts, setPassword.ts
  middleware/   seguridad.ts, asyncHandler.ts
  config/       env.ts
  types/        tipos compartidos
public/         index.html, styles.css, app.js
sql/            schema.sql, seed.sql, roles.sql
test/           unit/ (sin BD) · integration/ (PostgreSQL) · helpers/
scripts/        medirRendimiento.ts
docs/           CONTENIDO_DOCUMENTO_ACADEMICO.md
```
