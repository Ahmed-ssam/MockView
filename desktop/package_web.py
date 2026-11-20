"""Assemble <out>/web, the Next.js standalone server (the desktop app runs it with its own built-in Node).
Run after `npm run build` in frontend/:  python desktop/package_web.py desktop/dist"""
import shutil
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent / "frontend"
out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "dist"
web = out / "web"
if web.exists():
    shutil.rmtree(web)
shutil.copytree(root / ".next" / "standalone", web)
shutil.copytree(root / ".next" / "static", web / ".next" / "static")
shutil.copytree(root / "public", web / "public")

print("assembled", web)
