-- =====================================================================
-- OPCIONAL (seguridad / integridad): rol de aplicación con permisos mínimos.
-- La aplicación solo necesita LEER catálogos e INSERTAR registros; NO modificar ni borrar.
-- Ejecutar como superusuario:
--     psql -U postgres -d objetos_perdidos -f sql/roles.sql
-- Luego asigne la contraseña de forma interactiva (no queda en ningún archivo):
--     \password app_objetos
-- y use app_objetos como DB_USER en el .env. (set-password e initDb requieren un usuario administrador.)
-- =====================================================================
CREATE ROLE app_objetos LOGIN;
GRANT CONNECT ON DATABASE objetos_perdidos TO app_objetos;
GRANT USAGE ON SCHEMA public TO app_objetos;
GRANT SELECT ON categorias, funcionarios TO app_objetos;
GRANT SELECT, INSERT ON reportantes, objetos_encontrados TO app_objetos;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_objetos;
