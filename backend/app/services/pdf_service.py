"""Render a stored report to PDF. Pure formatting: every number comes from the stored report."""
from __future__ import annotations

from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.graphics.charts.spider import SpiderChart
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

NAVY, SLATE, BLUE, SAND, CREAM = (colors.HexColor(c) for c in ("#0B1F3B", "#376A90", "#8FB6D9", "#F4C992", "#F8F4EC"))


def _t(x) -> str:
    """Escape for Paragraph markup. The built-in PDF fonts are Latin-1, so other characters become '?'."""
    return escape(str(x if x is not None else "")).encode("latin-1", "replace").decode("latin-1")


def _plain(x) -> str:
    """For non-markup text (chart labels): Latin-1 safe but not XML-escaped."""
    return str(x).encode("latin-1", "replace").decode("latin-1")


def _styles():
    b = getSampleStyleSheet()["BodyText"]
    body = ParagraphStyle("b", parent=b, fontName="Helvetica", fontSize=9.5, leading=13, textColor=NAVY)
    return {
        "body": body,
        "small": ParagraphStyle("s", parent=body, fontSize=8, leading=10.5, textColor=colors.HexColor("#4A5B72")),
        "h1": ParagraphStyle("h1", parent=body, fontName="Times-Bold", fontSize=24, leading=28, spaceAfter=2),
        "h2": ParagraphStyle("h2", parent=body, keepWithNext=1, fontName="Times-Bold", fontSize=14.5, leading=18, spaceBefore=14, spaceAfter=5, textColor=NAVY),
        "h3": ParagraphStyle("h3", parent=body, fontName="Helvetica-Bold", fontSize=10, spaceBefore=6, spaceAfter=2),
        "bullet": ParagraphStyle("bu", parent=body, leftIndent=10, bulletIndent=0),
    }


def build_pdf(r: dict) -> bytes:
    st = _styles()
    buf = BytesIO()

    def footer(c, d):
        c.saveState()
        c.setFont("Helvetica", 7.5); c.setFillColor(colors.HexColor("#4A5B72"))
        c.drawString(18 * mm, 10 * mm, "MockView - practice summary, not a hiring prediction")
        c.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {d.page}")
        c.restoreState()

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm,
                            bottomMargin=18 * mm, title=f"MockView report - {r['specialization']}", author="MockView")
    W = A4[0] - 36 * mm
    S: list = [Paragraph("Interview report", st["h1"]),
               Paragraph(_t(f"{r['specialization']} | {r['level']} | {r['difficulty']} | "
                            f"{str(r['completed_at'] or '')[:10]}"), st["small"]), Spacer(1, 6)]
    if r["demo_mode"]:
        t = Table([[Paragraph("<b>Demo mode.</b> This report was produced without a real AI provider. The feedback is "
                              "simulated and should not be treated as real.", st["body"])]], colWidths=[W])
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), SAND), ("BOX", (0, 0), (-1, -1), 0.5, NAVY),
                               ("LEFTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 5),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
        S += [t, Spacer(1, 6)]

    # 1. overall
    nf = sum(1 for q in r["questions"] if q["followup"])
    boxes = [[Paragraph(f'<font size=22><b>{r["overall_score"]:.0f}</b></font>/100', ParagraphStyle("big", parent=st["body"], leading=28)),
              Paragraph(f'<font size=13><b>{_t(r["performance_level"])}</b></font>', ParagraphStyle("big2", parent=st["body"], leading=28)),
              Paragraph(f'<font size=13><b>{len(r["questions"])} + {nf}</b></font>', ParagraphStyle("big3", parent=st["body"], leading=28))],
             [Paragraph("Overall score", st["small"]), Paragraph("Performance level", st["small"]),
              Paragraph("Main questions + follow-ups", st["small"])]]
    t = Table(boxes, colWidths=[W / 3] * 3)
    t.setStyle(TableStyle([("BOX", (0, 0), (0, -1), 0.5, BLUE), ("BOX", (1, 0), (1, -1), 0.5, BLUE),
                           ("BOX", (2, 0), (2, -1), 0.5, BLUE), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                           ("TOPPADDING", (0, 0), (-1, 0), 8)]))
    S += [Paragraph("1. Overall result", st["h2"]), t,
          Paragraph(f"Calculated by fixed scoring rules (v{_t(r['scoring_version'])}).", st["small"])]

    # 2. radar
    dims = r["radar"]
    d = Drawing(W, 200)
    sp = SpiderChart()
    sp.x, sp.y, sp.width, sp.height = W / 2 - 65, 25, 130, 130
    sp.data = [[(v or 0) for v in dims.values()]]
    sp.labels = [_plain(k) for k in dims]
    sp.spokeLabels.fontName = "Helvetica"
    sp.strands[0].strokeColor = SLATE; sp.strands[0].fillColor = colors.Color(0.56, 0.71, 0.85, 0.5)
    sp.spokeLabels.fontSize = 7.5
    d.add(sp)
    na = [k for k, v in dims.items() if v is None]
    S += [Paragraph("2. Skills radar", st["h2"]), d]
    if na:
        S.append(Paragraph(_t("Not assessed in this interview: " + ", ".join(na) + "."), st["small"]))

    # 3. skills
    rows = [["Skill", "Score", "Level", "Evidence"]] + [
        [Paragraph(_t(k["skill"]), st["body"]), "-" if k["score"] is None else f'{k["score"]:.0f}',
         Paragraph(_t(k["level"] or "Not assessed"), st["body"]), Paragraph(_t(" | ".join(k["evidence"])), st["small"])]
        for k in r["skills"]]
    t = Table(rows, colWidths=[W * .26, W * .1, W * .2, W * .44], repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), CREAM),
                           ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 1), (-1, -1), 0.25, BLUE)]))
    S += [Paragraph("3. Skill evaluations", st["h2"]), t]

    def skill_block(title, items, empty):
        head = Paragraph(title, st["h2"])
        if not items:
            S.append(KeepTogether([head, Paragraph(empty, st["body"])]))
        for i, it in enumerate(items):
            blk = [Paragraph(_t(f'{it["skill"]} ({it["score"]:.0f})'), st["h3"])] + \
                  [Paragraph(_t(e), st["bullet"], bulletText="-") for e in it["evidence"]]
            S.append(KeepTogether(([head] if i == 0 else []) + blk))

    skill_block("4. Strengths", r["strengths"], "No skill reached the strong threshold (70) this time.")
    skill_block("5. Areas to improve", r["weaknesses"], "No skill fell below the strong threshold.")
    S += [Paragraph("6. Coach summary", st["h2"]), Paragraph(_t(r["coach_summary"]), st["body"]),
          Paragraph("7. Recommendations", st["h2"])]
    if not r["recommendations"]:
        S.append(Paragraph("No weak questions. Try a harder difficulty next.", st["body"]))
    for x in r["recommendations"]:
        S.append(KeepTogether([
            Paragraph(_t(f'[{x["priority"].upper()}] {x["topic"]}'), st["h3"]), Paragraph(_t(x["explanation"]), st["body"]),
            Paragraph(_t("Why it matters: " + x["why_it_matters"]), st["body"]),
            Paragraph(_t("Do this: " + x["activity"]), st["body"]),
            Paragraph(_t("Expected result: " + x["expected_improvement"]), st["body"])]))
    S.append(Paragraph("8. Learning roadmap", st["h2"]))
    for x in r["roadmap"] or []:
        S.append(Paragraph(_t(f'Step {x["step"]} ({x["priority"]}): {x["focus"]}. {x["activity"]}'), st["body"]))
    if not r["roadmap"]:
        S.append(Paragraph("Nothing urgent to plan.", st["body"]))

    S.append(Paragraph("9. Question-by-question review", st["h2"]))

    def qblock(q, label):
        out = [Paragraph(_t(f'{label} {q["question"]}  -  {q["score"]:.0f}/100 ({q["verdict"].replace("_", " ")})'), st["h3"]),
               Paragraph(_t("Your answer: " + ("(Skipped)" if q["skipped"] else q["answer"])), st["body"])]
        if q["explanation"]:
            out.append(Paragraph(_t(q["explanation"]), st["body"]))
        for title, items in (("Did well", q["did_well"]), ("Missing", q["missing"]), ("Incorrect", q["incorrect_statements"])):
            if items:
                out.append(Paragraph(f"<b>{title}:</b> " + _t("; ".join(items)), st["body"]))
        if q["improved_answer"]:
            out.append(Paragraph("<b>A stronger answer:</b> " + _t(q["improved_answer"]), st["body"]))
        if q["tip"]:
            out.append(Paragraph("<b>Tip:</b> " + _t(q["tip"]), st["body"]))
        return out

    for q in r["questions"]:
        blk = qblock(q, f'Q{q["position"]}.')
        if q["followup"]:
            blk += [Spacer(1, 3)] + qblock(q["followup"], "Follow-up:")
        S += [KeepTogether(blk[:3]), *blk[3:], Spacer(1, 4)]
    doc.build(S, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
