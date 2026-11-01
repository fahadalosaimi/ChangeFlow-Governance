"""Optional fresh local PostgreSQL cluster; never attach to an existing server.

Used on Windows hosts without Docker. Reuses A1's engine/schema/cluster ownership
checks so migrations remain restricted to databases created by this test run.
"""
from pathlib import Path
from contextlib import closing
import os
import secrets
import shutil
import socket
import subprocess
import tempfile

import psycopg2
import sqlalchemy as sa


def native_postgres_url(bin_directory):
    # Import at invocation to avoid a cycle with the original fixture module.
    from a1_postgresql import _IDENTITY_SQL, _SERVERS, _Server

    binary = Path(bin_directory).resolve(strict=True)
    suffix = ".exe" if os.name == "nt" else ""
    initdb = binary / ("initdb" + suffix)
    pg_ctl = binary / ("pg_ctl" + suffix)
    if not initdb.is_file() or not pg_ctl.is_file():
        raise RuntimeError("Native PostgreSQL test binaries are unavailable.")
    root = Path(tempfile.mkdtemp(prefix="changeflow-a2-pg-")).resolve()
    temp_parent = Path(tempfile.gettempdir()).resolve()
    if root.parent != temp_parent or not root.name.startswith("changeflow-a2-pg-"):
        raise RuntimeError("Unexpected native PostgreSQL test directory.")
    data = root / "data"
    password_file = root / "password"
    password = secrets.token_urlsafe(32)
    env = os.environ.copy()
    for key in tuple(env):
        if key.startswith("PG") or key in {"DATABASE_URL", "JWT_SECRET_KEY"}:
            env.pop(key, None)
    server = None
    url = None

    def run(*args):
        # Windows server descendants can retain inherited pipe handles. A file
        # lets pg_ctl return without waiting for the server to close those pipes.
        with (root / "control.log").open("a", encoding="utf-8") as output:
            return subprocess.run(
                list(map(str, args)), env=env, check=True, stdout=output,
                stderr=subprocess.STDOUT, text=True, timeout=60,
            )

    try:
        password_file.touch(mode=0o600)
        password_file.write_text(password, encoding="ascii")
        # Native mode requires PostgreSQL 17+ for portable Unicode case mapping;
        # libc's plain C locale would only lower ASCII on Windows.
        run(initdb, "-D", data, "-U", "a1_test", "--pwfile", password_file,
            "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C",
            "--locale-provider=builtin", "--builtin-locale=C.UTF-8")
        password_file.unlink()
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        # pg_ctl always targets this newly initialized directory. A port race
        # fails startup; it never causes us to attach to the competing server.
        run(pg_ctl, "-D", data, "-l", root / "server.log", "-w", "start",
            "-o", f"-h 127.0.0.1 -p {port}")
        # The A5 runner permits only a newly started cluster under its private root.
        from a5_isolation import register_native_cluster, unregister_native_cluster
        register_native_cluster(data, port, password)
        connection = psycopg2.connect(
            host="127.0.0.1", port=port, user="a1_test", password=password,
            dbname="postgres", connect_timeout=5,
        )
        try:
            connection.autocommit = True
            with connection.cursor() as cursor:
                cursor.execute("CREATE DATABASE changeflow_a1_test")
        finally:
            connection.close()
        url = sa.URL.create(
            "postgresql+psycopg2", username="a1_test", password=password,
            host="127.0.0.1", port=port, database="changeflow_a1_test",
        )
        with closing(psycopg2.connect(
            host="127.0.0.1", port=port, user="a1_test", password=password,
            dbname="changeflow_a1_test", connect_timeout=5,
        )) as connection:
            with connection.cursor() as cursor:
                cursor.execute(_IDENTITY_SQL)
                identity = cursor.fetchone()
        server = _Server(url, (identity[0], identity[1], identity[4]))
        _SERVERS[url] = server
        yield url
    finally:
        from a5_isolation import unregister_native_cluster
        unregister_native_cluster(data)
        if server is not None:
            server.active = False
            _SERVERS.pop(url, None)
        try:
            if (data / "postmaster.pid").exists():
                run(pg_ctl, "-D", data, "-m", "immediate", "-w", "stop")
        finally:
            password_file.unlink(missing_ok=True)
        # Only remove the exact temporary root created by this invocation.
        # If stopping the server fails, preserve its directory for diagnosis.
        if root.parent == temp_parent and root.name.startswith("changeflow-a2-pg-"):
            shutil.rmtree(root)
