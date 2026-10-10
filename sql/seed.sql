-- =====================================================================
-- Datos iniciales: catálogos y funcionarios de PRUEBA (sin contraseña).
-- Para poder iniciar sesión, asigne una contraseña con:
--     npm run set-password -- recepcion@example.com
-- Re-ejecutable (no duplica).
-- =====================================================================
INSERT INTO categorias (codigo, nombre, prefijo) VALUES
    ('ELECTRONICO', 'Objeto electrónico', 'ELEC'),
    ('DOCUMENTO',   'Documento personal', 'DOC'),
    ('GENERAL',     'Objeto general',     'OBJ')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO funcionarios (nombre, apellido, correo) VALUES
    ('Recepción',  'Principal', 'recepcion@example.com'),
    ('Seguridad',  'Campus',    'seguridad@example.com'),
    ('Bienestar',  'Estudiantil', 'bienestar@example.com')
ON CONFLICT (lower(correo)) DO NOTHING;
