# Trikosh expense tracker. Standard-library Python only: nothing to pip install.
# Python 3.13 is the version the app and its tests run on locally (the app needs 3.11+).
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OPSMIND_DB=/data/opsmind.db

# Unprivileged runtime user with a fixed UID/GID so volume ownership is predictable (10001:10001).
RUN groupadd --system --gid 10001 opsmind \
 && useradd --system --uid 10001 --gid opsmind --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin opsmind \
 && mkdir -p /data \
 && chown opsmind:opsmind /data \
 && chmod 0700 /data

WORKDIR /app
# Application code and static assets only. Files stay root-owned and read-only for the app user.
COPY server.py accounts.py workspace_features.py business_expenses.py backup_db.py ./
COPY static/ ./static/

USER opsmind
EXPOSE 8000

# server.py exits cleanly on KeyboardInterrupt, so stop with SIGINT.
STOPSIGNAL SIGINT

# Fails unless the app answers and can read its SQLite database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4).status == 200 else 1)"]

CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "8000"]
