"""Generates every desktop icon from the brand emblem (run: python make_icons.py).
Outputs: app-icon.svg/png/ico/icns (cream tile, navy emblem), setup-icon.svg/png/ico (navy tile, cream emblem,
sand download badge), and the installer wizard images (wizard-large.bmp 164x314, wizard-small.bmp 55x55)."""
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
NAVY, SLATE, SOFT, SAND, CREAM = "#0B1F3B", "#376A90", "#8FB6D9", "#F4C992", "#F8F4EC"

def emblem(main: str, side_top: str, side_bot: str, uid: str) -> str:
    """The brand emblem (M monogram + armchair under a light cone) in a given colour scheme, 200x180 box."""
    return f'''
  <defs>
    <linearGradient id="s{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{side_top}"/><stop offset="1" stop-color="{side_bot}"/></linearGradient>
    <linearGradient id="l{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{SAND}" stop-opacity="0.95"/><stop offset="1" stop-color="{SAND}" stop-opacity="0.15"/></linearGradient>
  </defs>
  <path d="M10 28 L58 8 L100 40 L142 8 L190 28 L190 52 L142 36 L100 70 L58 36 L10 52 Z" fill="{main}"/>
  <path d="M10 52 L58 36 L58 150 L10 128 Z" fill="url(#s{uid})"/>
  <path d="M190 52 L142 36 L142 150 L190 128 Z" fill="url(#s{uid})"/>
  <path d="M100 70 L132 140 L68 140 Z" fill="url(#l{uid})"/>
  <circle cx="100" cy="66" r="3.5" fill="{main}"/>
  <g fill="{main}"><rect x="84" y="102" width="32" height="26" rx="8"/><rect x="76" y="112" width="12" height="22" rx="5"/>
  <rect x="112" y="112" width="12" height="22" rx="5"/><rect x="82" y="124" width="36" height="10" rx="4"/>
  <rect x="86" y="134" width="3" height="10"/><rect x="111" y="134" width="3" height="10"/></g>'''

APP = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="bgA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14325a"/><stop offset="1" stop-color="{NAVY}"/></linearGradient></defs>
  <rect width="512" height="512" rx="104" fill="url(#bgA)"/>
  <g transform="translate(26 76) scale(2.3)">{emblem(CREAM, SOFT, SLATE, "a")}</g>
</svg>'''

SETUP = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="104" fill="{CREAM}"/>
  <g transform="translate(40 52) scale(1.75)">{emblem(NAVY, SLATE, NAVY, "b")}</g>
  <circle cx="386" cy="386" r="108" fill="{NAVY}"/>
  <circle cx="386" cy="386" r="92" fill="{SAND}"/>
  <path d="M386 330 V414 M346 380 L386 420 L426 380" fill="none" stroke="{NAVY}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M344 446 H428" fill="none" stroke="{NAVY}" stroke-width="22" stroke-linecap="round"/>
</svg>'''

def wizard_large() -> str:  # 164 x 314
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 164 314" width="164" height="314">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{NAVY}"/><stop offset="1" stop-color="#14325a"/></linearGradient></defs>
  <rect width="164" height="314" fill="url(#bg)"/>
  <g transform="translate(22 56) scale(0.6)">{emblem(CREAM, SOFT, SLATE, "c")}</g>
  <text x="82" y="200" text-anchor="middle" font-family="Playfair Display, Georgia, 'DejaVu Serif', serif" font-size="26" font-weight="700" fill="{CREAM}">Mock<tspan fill="{SOFT}">View</tspan></text>
  <text x="82" y="222" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="8" letter-spacing="2.6" fill="{SOFT}">AI MOCK INTERVIEWS</text>
  <rect x="62" y="246" width="40" height="3" rx="1.5" fill="{SAND}"/>
</svg>'''

def wizard_small() -> str:  # 55 x 55
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="55" height="55">{APP[APP.index(">")+1:-6]}</svg>'

def render(page, svg: str, w: int, h: int, out: Path):
    page.set_viewport_size({"width": w, "height": h})
    page.set_content(f'<body style="margin:0;background:transparent">{svg.replace("<svg ", f"<svg width=%d height=%d " % (w, h), 1)}</body>')
    page.screenshot(path=str(out), omit_background=True)

def main():
    for name, svg in (("app-icon", APP), ("setup-icon", SETUP)):
        (HERE / f"{name}.svg").write_text(svg)
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        render(pg, APP, 1024, 1024, HERE / "app-icon.png")
        render(pg, SETUP, 1024, 1024, HERE / "setup-icon.png")
        render(pg, wizard_large(), 164 * 2, 314 * 2, HERE / "_wl.png")
        render(pg, wizard_small(), 55 * 4, 55 * 4, HERE / "_ws.png")
        b.close()
    sizes = [16, 24, 32, 48, 64, 128, 256]
    for name in ("app-icon", "setup-icon"):
        im = Image.open(HERE / f"{name}.png").convert("RGBA")
        im.save(HERE / f"{name}.ico", sizes=[(s, s) for s in sizes])
    Image.open(HERE / "app-icon.png").convert("RGBA").save(HERE / "app-icon.icns")
    # Inno Setup wants opaque BMPs at 1x size.
    for src, dst, size in (("_wl.png", "wizard-large.bmp", (164, 314)), ("_ws.png", "wizard-small.bmp", (55, 55))):
        im = Image.open(HERE / src).convert("RGBA")
        bg = Image.new("RGB", im.size, NAVY); bg.paste(im, mask=im.split()[3])
        bg.resize(size, Image.LANCZOS).save(HERE / dst)
        (HERE / src).unlink()
    Image.open(HERE / "app-icon.png").resize((512, 512), Image.LANCZOS).save(HERE / "app-icon-512.png")

if __name__ == "__main__":
    main()
