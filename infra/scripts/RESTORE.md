# Restoring from backup

All commands run on the server in `/opt/onlinedars` as the `deploy` user.
Practise this **monthly on staging** and write the time it took in the log at the bottom.

## Where backups are

| Kind                      | Location                                              | Made by                                      |
| ------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| Pre-deploy (production)   | `/opt/onlinedars/backups/predeploy-<tag>-<time>.dump` | `scripts/deploy.sh` → `scripts/backup-db.sh` |
| Manual                    | `/opt/onlinedars/backups/manual-<time>.dump`          | `./scripts/backup-db.sh`                     |
| Nightly + off-server copy | see `infra/backup/`                                   | nightly job (architect)                      |

Dumps are `pg_dump -Fc` (custom format). Restore them with `pg_restore`, not `psql`.

## 1. Restore the database

```bash
cd /opt/onlinedars
export IMAGE_TAG="$(cat .deployed_tag)"
C="docker compose -f docker-compose.prod.yml --env-file .env"

# a) Stop writers so nothing changes during the restore
$C stop web api worker

# b) Safety copy of the current state (even if it's broken)
./scripts/backup-db.sh before-restore

# c) Restore: drops and recreates the objects in the dump inside the existing database
DUMP=backups/predeploy-v1.2.0-20261201T020000Z.dump      # <- pick the file
$C exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' < "$DUMP"

# d) Start the version that matches the dump's schema
#    (the tag in a predeploy file name is the release that was about to be deployed,
#     so the dump matches the release *before* it - see .deploy_history)
./scripts/rollback.sh <tag-that-matches-the-dump>

# e) Check
curl -fsS https://<domain>/api/v1/health
```

## 2. Restore files (MinIO)

Bucket data is synced off-server by the nightly job. To bring it back:

```bash
$C run --rm --entrypoint /bin/sh minio-init -c '
  mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" &&
  mc alias set remote "$BACKUP_S3_URL" "$BACKUP_S3_KEY" "$BACKUP_S3_SECRET" &&
  mc mirror --overwrite remote/<backup-bucket>/minio/ local/'"$S3_BUCKET"'/'
```

(`BACKUP_S3_*` are the off-server storage credentials from the password manager; pass them with `-e`.)

## 3. Restore test on staging (monthly)

1. Copy last night's production dump to staging (never the other way round).
2. Run section 1 on staging.
3. Log in as a test student and admin, open a course, check the access-request list and a certificate verify URL.
4. Write the result below.

| Date | Who | Dump | Duration | Result |
| ---- | --- | ---- | -------- | ------ |
|      |     |      |          |        |
