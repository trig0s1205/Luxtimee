const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function assertLocalDatabaseUrl(databaseUrl: string | undefined): URL {
  if (!databaseUrl?.trim()) {
    throw new Error(
      'DATABASE_URL no está definida. El backfill solo corre contra Postgres local.',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL no es una URL válida.');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Backfill cancelado: la base (${host}) no es local. No se toca producción.`,
    );
  }
  return parsed;
}
