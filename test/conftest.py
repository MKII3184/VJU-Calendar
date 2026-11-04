# -*- coding: utf-8 -*-
"""Dat webapp/ vao sys.path de cac test import duoc module backend
(`from app import app`, `import api.manual_section`, ...) khi chay
`py -m pytest test/` tu thu muc goc du an."""

import sys
from pathlib import Path

WEBAPP_DIR = Path(__file__).resolve().parent.parent / "webapp"
if str(WEBAPP_DIR) not in sys.path:
    sys.path.insert(0, str(WEBAPP_DIR))
