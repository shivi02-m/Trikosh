"""Consistent online backup of the OpsMindAI SQLite database.

Safe to run while the server is running (uses SQLite's backup API, not a file copy).
Usage: python backup_db.py [--keep 14]
Reads OPSMIND_DB like server.py; writes to <db folder>/backups/.
"""
import argparse
import os
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--keep', type=int, default=14, help='number of scheduled backups to keep')
    args = parser.parse_args()
    source = Path(os.environ.get('OPSMIND_DB', ROOT / 'data' / 'opsmind.db'))
    if not source.exists():
        raise SystemExit(f'Database not found: {source}')
    folder = source.parent / 'backups'
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f'{source.stem}-scheduled-{datetime.now().strftime("%Y%m%d-%H%M%S")}.db'
    src, dst = sqlite3.connect(source), sqlite3.connect(target)
    try:
        src.backup(dst)
        if dst.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise SystemExit(f'Backup failed integrity check: {target}')
    finally:
        dst.close()
        src.close()
    # Only rotate scheduled backups; migration backups are kept.
    scheduled = sorted(folder.glob(f'{source.stem}-scheduled-*.db'))
    for old in scheduled[:-args.keep]:
        old.unlink()
    print(f'Backup written: {target}')


if __name__ == '__main__':
    main()
