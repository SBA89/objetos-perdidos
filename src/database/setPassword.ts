import bcrypt from 'bcrypt';
import { createInterface } from 'readline/promises';
import { Client } from 'pg';
import { cargarEnv, configuracionBd } from '../config/env';

/**
 * Asigna (con hash bcrypt) la contraseña de un funcionario existente:
 *     npm run set-password -- recepcion@example.com
 * La contraseña se pide por consola (o se toma de la variable NUEVA_CLAVE). Nunca se guarda en texto plano.
 */
async function main(): Promise<void> {
  cargarEnv();
  const correo = process.argv[2];
  if (!correo) throw new Error('Uso: npm run set-password -- <correo del funcionario>');

  let clave = process.env.NUEVA_CLAVE ?? '';
  if (!clave) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    clave = await rl.question(`Nueva contraseña para ${correo} (mínimo 8 caracteres): `);
    rl.close();
  }
  if (clave.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');

  const hash = await bcrypt.hash(clave, 10);
  const cliente = new Client(configuracionBd());
  await cliente.connect();
  try {
    const r = await cliente.query('UPDATE funcionarios SET password_hash = $1 WHERE lower(correo) = lower($2)', [hash, correo]);
    if (r.rowCount === 0) throw new Error(`No existe un funcionario con el correo ${correo}.`);
    console.log('✔ Contraseña actualizada.');
  } finally {
    await cliente.end();
  }
}

main().catch((err: unknown) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
