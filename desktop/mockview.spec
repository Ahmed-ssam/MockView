# PyInstaller recipe for the local API server: `pyinstaller --noconfirm --distpath desktop/dist desktop/mockview.spec`
import os
import sys
from PyInstaller.utils.hooks import collect_all, collect_submodules

ROOT = os.path.dirname(SPECPATH)  # repository root (SPECPATH is the desktop/ folder)
j = lambda *p: os.path.join(ROOT, *p)
hidden = collect_submodules("app") + collect_submodules("uvicorn") + collect_submodules("alembic", filter=lambda n: "testing" not in n) + [
    "sqlalchemy.dialects.sqlite", "multipart", "python_multipart", "email_validator"]
datas = [(j("backend", "migrations"), "migrations")]
for pkg in ("reportlab", "pypdf"):
    d, b, h = collect_all(pkg); datas += d; hidden += h

a = Analysis([j("desktop", "server_main.py")], pathex=[j("backend")], datas=datas, hiddenimports=hidden, excludes=["pytest", "tkinter"])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="MockView-server", console=False)
coll = COLLECT(exe, a.binaries, a.datas, name="server")
