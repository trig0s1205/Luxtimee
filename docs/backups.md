# Backups semanales de la base (Supabase → Google Drive)

El workflow `.github/workflows/db-backup.yml` corre **cada domingo a las 08:00 UTC**
(03:00 en Colombia) y también se puede lanzar a mano (`workflow_dispatch`).

Usa `pg_dump` en formato custom (`-Fc`), comprime el archivo, lo sube a Google Drive
con **rclone**, borra dumps de más de **8 semanas** (56 días) y guarda un artifact
en GitHub por **7 días**.

---

## Secrets de GitHub Actions

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Qué es |
|--------|--------|
| `SUPABASE_DB_URL` | URL de Postgres **directa** o **session pooler**. **Nunca** el transaction pooler (pgbouncer en modo transaction). Ejemplo de forma: `postgresql://USER:PASSWORD@HOST:5432/postgres` |
| `RCLONE_CONFIG` | Contenido **completo** de tu `rclone.conf` (remoto de Google Drive ya autenticado) |
| `GDRIVE_FOLDER` | Destino rclone, por ejemplo `gdrive:LuxtimeeBackups` |

Si falta cualquiera, el job **falla** (GitHub puede enviar correo de workflow fallido).

### Versión del cliente Postgres

El workflow instala **postgresql-client-17** (apto para Supabase Postgres 17).
Si tu proyecto Supabase usa otra major, cambia en el workflow la línea
`postgresql-client-17` por `postgresql-client-XX` y vuelve a probar un run manual.

---

## Cómo generar `rclone.conf` en tu PC (Google Drive)

1. Instala rclone: [https://rclone.org/install/](https://rclone.org/install/)
2. En una terminal:

```bash
rclone config
```

3. Elige **n** (new remote), nombre sugerido: `gdrive`.
4. Tipo de storage: busca **Google Drive** (número de la lista).
5. Deja client id/secret vacíos salvo que tengas OAuth propio.
6. Scope: normalmente `drive` (acceso completo) o el mínimo que necesites.
7. Confirma el navegador para autorizar tu cuenta Google.
8. Al terminar, el archivo queda en:

- Windows: `%APPDATA%\rclone\rclone.conf`
- Linux/macOS: `~/.config/rclone/rclone.conf`

9. Abre ese archivo, **copia TODO el contenido** y pégalo como secret `RCLONE_CONFIG`.
10. Crea la carpeta en Drive (ej. `LuxtimeeBackups`) y pon `GDRIVE_FOLDER=gdrive:LuxtimeeBackups`
    (usa el mismo nombre de remoto que elegiste).

Prueba local:

```bash
rclone lsd gdrive:
rclone mkdir gdrive:LuxtimeeBackups
rclone ls gdrive:LuxtimeeBackups
```

---

## Cómo correr el backup a mano

1. En GitHub: **Actions → Weekly DB backup → Run workflow**.
2. Cuando termine, descarga el artifact `db-backup-<run_id>` o mira la carpeta en Drive
   (`luxtimee-AAAA-MM-DD.dump.gz`).

---

## Cómo restaurar (solo en una base de **prueba**)

**Nunca** restaures directo sobre producción sin confirmación explícita y un plan de rollback.

1. Descomprime:

```bash
gunzip -k luxtimee-AAAA-MM-DD.dump.gz
```

2. Crea o elige una base vacía de prueba (otro proyecto Supabase o Postgres local).

3. Restaura:

```bash
pg_restore \
  --dbname="postgresql://USER:PASSWORD@HOST:5432/DB_PRUEBA" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  luxtimee-AAAA-MM-DD.dump
```

4. Verifica conteos de tablas críticas (`Watch`, `User`, etc.) antes de cualquier decisión.

Si `pg_restore` avisa de errores menores de ownership, suele ser normal con `--no-owner`.
Errores de objetos faltantes: revisa que la base destino esté vacía o usa `--clean` con cuidado.
