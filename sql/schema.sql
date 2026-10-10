-- =====================================================================
-- Esquema PostgreSQL — módulo "Registrar objeto encontrado"
-- Re-ejecutable: usa IF NOT EXISTS y no borra datos.
-- =====================================================================

-- Catálogo de categorías (RF-06). "prefijo" se usa para construir los IDs (ELEC-, DOC-, OBJ-).
CREATE TABLE IF NOT EXISTS categorias (
    id      SMALLSERIAL PRIMARY KEY,
    codigo  VARCHAR(20) NOT NULL UNIQUE
            CONSTRAINT categorias_codigo_ck CHECK (codigo IN ('ELECTRONICO', 'DOCUMENTO', 'GENERAL')),
    nombre  VARCHAR(60) NOT NULL,
    prefijo VARCHAR(5)  NOT NULL UNIQUE
            CONSTRAINT categorias_prefijo_ck CHECK (prefijo IN ('ELEC', 'DOC', 'OBJ'))
);

-- Funcionarios: reciben los objetos y son los usuarios que inician sesión (password_hash = bcrypt).
CREATE TABLE IF NOT EXISTS funcionarios (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    apellido      VARCHAR(100) NOT NULL,
    correo        VARCHAR(100) NOT NULL,
    password_hash TEXT,
    activo        BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX IF NOT EXISTS funcionarios_correo_uq ON funcionarios (lower(correo));

-- Persona que encontró el objeto (RF-01). Correo y teléfono son opcionales.
CREATE TABLE IF NOT EXISTS reportantes (
    id           SERIAL PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL,
    apellido     VARCHAR(100) NOT NULL,
    correo       VARCHAR(100),
    telefono     VARCHAR(100),
    tipo_persona VARCHAR(20)  NOT NULL
                 CONSTRAINT reportantes_tipo_persona_ck
                 CHECK (tipo_persona IN ('estudiante', 'funcionario', 'docente', 'visitante')),
    creado_en    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Una secuencia por categoría: nextval() es atómico, así que dos registros simultáneos
-- NUNCA reciben el mismo número (aunque una transacción se revierta, el número no se reutiliza).
CREATE SEQUENCE IF NOT EXISTS seq_objeto_electronico START 1;
CREATE SEQUENCE IF NOT EXISTS seq_objeto_documento   START 1;
CREATE SEQUENCE IF NOT EXISTS seq_objeto_general     START 1;

CREATE TABLE IF NOT EXISTS objetos_encontrados (
    id                  VARCHAR(20) PRIMARY KEY
                        CONSTRAINT objetos_id_formato_ck CHECK (id ~ '^(ELEC|DOC|OBJ)-[0-9]{6,}$'),
    categoria_id        SMALLINT     NOT NULL REFERENCES categorias (id),
    tipo_objeto         VARCHAR(150) NOT NULL,
    lugar_encuentro     VARCHAR(200) NOT NULL,
    descripcion         TEXT,
    fecha_hallazgo      DATE         NOT NULL,
    -- 'Entregado' y 'Cerrado' los usarán módulos futuros; este módulo solo inserta 'Pendiente'.
    estado              VARCHAR(20)  NOT NULL DEFAULT 'Pendiente'
                        CONSTRAINT objetos_estado_ck CHECK (estado IN ('Pendiente', 'Entregado', 'Cerrado')),
    reportante_id       INTEGER      NOT NULL REFERENCES reportantes (id),   -- RF-07: no hay objeto sin reportante
    funcionario_id      INTEGER      NOT NULL REFERENCES funcionarios (id),  -- RF-08: funcionario responsable
    registrado_por      INTEGER      NOT NULL REFERENCES funcionarios (id),  -- trazabilidad: quién operó el sistema
    clave_idempotencia  UUID,
    creado_en           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT objetos_clave_idempotencia_uq UNIQUE (clave_idempotencia)
);

CREATE INDEX IF NOT EXISTS objetos_reportante_idx  ON objetos_encontrados (reportante_id);
CREATE INDEX IF NOT EXISTS objetos_funcionario_idx ON objetos_encontrados (funcionario_id);
CREATE INDEX IF NOT EXISTS objetos_estado_idx      ON objetos_encontrados (estado);
