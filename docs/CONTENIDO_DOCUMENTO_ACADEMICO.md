# Contenido técnico para el documento académico

Material para redactar las cinco secciones. Cada sección distingue lo **implementado** (existe en el código y se puede demostrar), las **decisiones de diseño** (por qué se hizo así) y las **mejoras futuras** (no implementadas). Los textos son borradores: ajústelos a su estilo y a las normas de citación de la asignatura.

---

## 1. Planteamiento del proyecto

**Problema.** Las instituciones reciben objetos hallados sin un procedimiento uniforme: se pierden datos de quién los encontró, no se sabe quién los recibió y no hay evidencia de lo ocurrido.

**Alcance del módulo «Registrar objeto encontrado».** Permite a un funcionario autenticado registrar el objeto, a su reportante y al funcionario que lo recibe, dejando el caso en estado *Pendiente* y confirmando con un ID único. No incluye búsqueda, devolución, entrega ni cierre de casos.

**Por qué este módulo.** Concentra captura y validación de datos, asociación entre entidades, asignación automática de estado, generación de identificadores, manejo de datos personales (confidencialidad) y trazabilidad: permite justificar tres patrones de diseño en un alcance pequeño.

- *Implementado:* flujo completo (login → formulario → validación → transacción en PostgreSQL → confirmación con ID → evento de auditoría).
- *Fuera de alcance:* gestión posterior del objeto.

## 2. Requerimientos funcionales del módulo

| ID | Requisito | Estado en el código | Dónde |
|---|---|---|---|
| RF-01 | Registrar reportante (nombre, apellido, correo, teléfono, tipo de persona ∈ {estudiante, funcionario, docente, visitante}) | Implementado | `reportantes` (schema.sql), `ReportanteValidoHandler` |
| RF-02 | Registrar objeto (tipo, lugar, descripción, fecha, funcionario) | Implementado | `objetos_encontrados`, `ObjetoValidoHandler` |
| RF-03 | Validar obligatorios (nombre, apellido, tipo de persona, tipo de objeto, lugar, fecha) | Implementado en servidor (+ categoría y funcionario) | `CamposObligatoriosHandler` |
| RF-04 | Teléfono y descripción opcionales | Implementado (se guardan NULL) | `RegistroObjetoService` |
| RF-05 | Estado inicial «Pendiente» automático | Implementado; el cliente no puede cambiarlo | `ObjetoPerdidoBase`, `ObjetoFactory.crear()` (invariante) |
| RF-06 | Asignar categoría | Implementado (tabla `categorias`) | `categorias`, `ObjetoFactory` |
| RF-07 | Objeto siempre asociado a un reportante | Implementado por motor (FK + NOT NULL + transacción) | `schema.sql` |
| RF-08 | Funcionario responsable | Implementado | `funcionario_id` NOT NULL |
| RF-09 | ID único automático | Implementado: prefijo por categoría + secuencia PostgreSQL + PK | `RegistroObjetoService`, `schema.sql` |
| RF-10 | Confirmación o error; en éxito mostrar ID | Implementado | `ObjetoController`, `public/app.js` |

*Decisiones:* funcionario y categoría se exigen como obligatorios aunque RF-03 no los liste (RF-06/07/08). Se añadió una clave de idempotencia para que un doble clic no duplique registros.

## 3. Atributos de calidad y su justificación

| Atributo | Cómo se aborda (implementado) | Cómo se verifica |
|---|---|---|
| **Idoneidad funcional** | Solo el flujo de registro, sin funcionalidades adicionales; estado y ID asignados por el sistema | Pruebas 1–10 |
| **Eficiencia de ejecución** | E/S asíncrona, pool de conexiones (`pg`), una transacción corta, escritura de auditoría en cola sin bloquear la respuesta | `tiempoServidorMs`, `X-Tiempo-Servidor-Ms`, `npm run medir` |
| **Seguridad** | Autenticación (sesión + bcrypt), validación en servidor, SQL parametrizado, sin endpoints de edición/borrado, cabeceras de seguridad | Pruebas 4, 5, 11 |
| **Integridad** | Claves foráneas, NOT NULL, CHECK de valores permitidos, transacción atómica | Prueba 14 |
| **Trazabilidad** | `AuditoriaService`: usuario, acción, fecha/hora, resultado, ID del objeto; `registrado_por` en la BD | Prueba 13 |
| **Mantenibilidad** | Capas separadas (controladores, servicios, fábrica, validadores); patrones aislados en archivos propios; añadir categoría o validación = añadir una clase | Estructura de carpetas |

**Sobre los tiempos del documento.** Aparecen dos cifras: «< 50 ms» (Eficiencia de ejecución) y «< 2 s» (RNF-EE-01), contradictorias entre sí y no medidas. Propuesta coherente: *p95 del procesamiento en servidor ≤ 200 ms; máximo extremo a extremo ≤ 2 s en red local*, con 50 ms como meta ideal. Justificación: una confirmación de `COMMIT` exige persistir en disco y el rendimiento depende del hardware; Express no «garantiza» tiempos por ser asíncrono. **No se declara cumplimiento sin los resultados de `npm run medir`; incluya en el documento los valores que usted obtenga.**

## 4. Stack tecnológico y justificación

| Tecnología | Justificación (ajustada a lo implementado) |
|---|---|
| TypeScript | Interfaces y clases abstractas hacen explícitos los roles de Factory Method y Chain of Responsibility; tipado estático mejora mantenibilidad |
| Node.js + Express 4 | E/S no bloqueante para atender peticiones concurrentes; enrutamiento y middleware simples. (No «garantiza» un tiempo de respuesta: se mide) |
| PostgreSQL | Integridad referencial por el motor (RF-07), transacciones ACID, secuencias atómicas para IDs |
| `pg` | Pool de conexiones, consultas parametrizadas (previene inyección SQL), transacciones con `BEGIN/COMMIT/ROLLBACK` |
| `express-session` | Sesión del lado del servidor para autenticidad. Almacén en memoria: suficiente para la demo, no para producción |
| `bcrypt` | Hash con sal de contraseñas; nunca se guardan en texto plano |
| `fs` (nativo) | Escritura de `auditoria_logs.txt` sin dependencias; cola de promesas para no mezclar líneas |
| `tsx` (desarrollo) | Ejecuta TypeScript directamente y corre las pruebas con el ejecutor nativo `node:test` (sin Jest/Mocha) |
| HTML/CSS/JS plano (front) | Interfaz simple sin proceso de compilación; sin scripts en línea (compatible con CSP) |

*No se añadieron librerías de validación, ORM ni `dotenv`* (se usa `process.loadEnvFile` de Node 22).

## 5. Patrones de diseño: considerados, descartados e implementados

### Implementados

**5.1 Factory Method (creacional).** *Definición formal:* define una interfaz para crear un objeto, pero deja que las subclases decidan qué clase instanciar; el creador delega la instanciación en un método fábrica sobrescrito.

| Rol formal | Clase |
|---|---|
| Product | `IObjetoPerdido` |
| ConcreteProduct | `ObjetoElectronico`, `DocumentoPersonal`, `ObjetoGeneral` (comparten `ObjetoPerdidoBase`, que no es un rol del patrón) |
| Creator | `ObjetoFactory` (abstracta): `crearProducto()` = factory method; `crear()` = operación plantilla |
| ConcreteCreator | `ObjetoElectronicoFactory`, `DocumentoPersonalFactory`, `ObjetoGeneralFactory` |
| (Selector) | `ObjetoFactory.crearObjeto(categoria, datos)` estático: elige el creador. Por sí solo sería *Simple Factory*; no es parte del patrón formal |

Cada producto aporta comportamiento propio (prefijo del ID y `instruccionCustodia()`), por lo que no es un simple cambio de etiqueta. *Motivación:* RF-05, RF-06 y RF-09.

**5.2 Chain of Responsibility (comportamiento).** *Definición formal:* evita acoplar el emisor de una petición con su receptor dando a varios objetos la oportunidad de manejarla; se encadenan y la petición pasa por la cadena hasta que alguno la maneja (aquí: hasta que uno la rechaza o todos la aprueban).

| Rol formal | Clase |
|---|---|
| Handler | `ValidatorHandler` (`setNext()`, `handle()` plantilla, `validar()` abstracto) |
| ConcreteHandler | `AutenticacionHandler` → `CamposObligatoriosHandler` → `ReportanteValidoHandler` → `ObjetoValidoHandler` |
| Client | `ObjetoController` (usa la cadena construida en `cadenaRegistro.ts`) |

*Variante:* cada eslabón *valida y pasa* o *rechaza y corta* (no «el primero que atiende consume la petición»). *Ampliación:* el 4.º eslabón no estaba en el documento. *Motivación:* SRP y Abierto/Cerrado frente a un controlador con condicionales.

**5.3 Singleton (creacional) — `AuditoriaService`.** *Definición formal:* garantiza que una clase tenga una única instancia y proporciona un punto de acceso global a ella. *Alcance:* una instancia **por proceso**. Las escrituras seguras se deben a una cola de promesas, no al patrón.

### Considerados y descartados (documento original)

- **Builder:** el formulario se captura en un solo paso; no hay construcción por etapas.
- **Abstract Factory:** no hay familias de productos relacionados; solo variantes de una entidad.
- **Condicionales anidados en el controlador:** violan SRP y OCP.
- **Middlewares sueltos de Express:** sin abstracción orientada a objetos ni orden/corte explícitos.

### Matriz: implementado / diseño / futuro

| Elemento | Categoría |
|---|---|
| Formulario, login, transacción, ID, estado, auditoría, 3 patrones, pruebas | Implementado |
| IDs por secuencia, clave de idempotencia, 4.º eslabón, Factory Method formal | Decisión de diseño |
| Roles de usuario, límite de intentos de login, HTTPS, sesiones persistentes, rotación del log, deduplicar reportantes, módulos de devolución/cierre | Mejora futura |
