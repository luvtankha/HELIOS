#!/bin/sh
set -eu

password_file=/run/helios-db-secrets/password
if [ ! -s "$password_file" ]; then
    umask 022
    od -An -N32 -tx1 /dev/urandom | tr -d ' \n' > "$password_file"
fi

export POSTGRES_PASSWORD_FILE="$password_file"
exec /usr/local/bin/docker-entrypoint.sh "$@"
