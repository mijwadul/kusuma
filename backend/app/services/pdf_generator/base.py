from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, Image, Table, TableStyle

TEMPLATES_DIR = Path(__file__).parent.parent.parent.parent.parent / "frontend" / "public"
LOGO_PATH = TEMPLATES_DIR / "logo.png"

# ── Colors ────────────────────────────────────────────────────────────────
BRAND_BLUE = colors.HexColor("#1e40af")
BRAND_LIGHT = colors.HexColor("#dbeafe")
ACCENT_GREEN = colors.HexColor("#16a34a")
ACCENT_RED = colors.HexColor("#dc2626")
GRAY_DARK = colors.HexColor("#1f2937")
GRAY_MID = colors.HexColor("#6b7280")
GRAY_LIGHT = colors.HexColor("#f3f4f6")
WHITE = colors.white

_MONTHS_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

def fmt_date(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, str):
        try:
            from datetime import date as _date
            value = _date.fromisoformat(value)
        except ValueError:
            return value
    return f"{value.day} {_MONTHS_ID[value.month - 1]} {value.year}"

def fmt_idr(value: Any) -> str:
    try:
        if value is None:
            return "Rp 0"
        v = round(float(value), 4)
        if v.is_integer():
            return "Rp {:,.0f}".format(v).replace(",", ".")
        else:
            s = "{:,.4f}".format(v).rstrip("0").rstrip(".")
            return "Rp " + s.replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return "Rp 0"

def get_base_styles():
    styles = getSampleStyleSheet()
    def style(name="Normal", **kw):
        return ParagraphStyle(name, parent=styles[name], **kw)
    return style

def get_logo_image(width_cm=8.5, height_cm=3.2):
    from reportlab.lib.units import cm
    if LOGO_PATH.exists():
        try:
            import io as _io
            from PIL import Image as PILImage
            pil_img = PILImage.open(LOGO_PATH)
            pil_img.thumbnail((1200, 500), PILImage.LANCZOS)
            thumb_buf = _io.BytesIO()
            pil_img.save(thumb_buf, format="PNG", optimize=True)
            thumb_buf.seek(0)
            return Image(thumb_buf, width=width_cm * cm, height=height_cm * cm, kind="proportional")
        except Exception:
            pass
    return Paragraph("", get_base_styles()("Normal"))

def create_header(title_text: str, right_paragraphs: list, content_w: float, title_size: int = 16):
    from reportlab.lib.units import mm, cm
    from reportlab.platypus import Spacer, HRFlowable
    
    logo_cell = get_logo_image(width_cm=3.0, height_cm=3.0)
    style = get_base_styles()
    
    company_name = Paragraph("<font size='15' color='#1e293b'><b>PT. Kusuma Samudera Berkah</b></font>", style(alignment=TA_LEFT, spaceAfter=2))
    company_sub = Paragraph("<font size='9' color='#64748b'><i>Pertambangan & Konstruksi</i></font>", style(alignment=TA_LEFT, spaceAfter=4))
    company_address = Paragraph("<font size='8' color='#64748b'>Jl. Pendidikan Tlogosadang, Kec. Paciran,<br/>Kab. Lamongan Jawa Timur 62264</font>", style(alignment=TA_LEFT, leading=10))
    
    company_info = [company_name, company_sub, company_address]
    
    left_table = Table([[logo_cell, company_info]], colWidths=[3.2 * cm, content_w * 0.6 - 3.2 * cm])
    left_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    
    slip_title = Paragraph(
        f"<font size='{title_size}' color='#1e3a8a'><b>{title_text}</b></font>",
        style(alignment=TA_RIGHT, spaceAfter=4),
    )
    
    right_cells = [slip_title, Spacer(1, 4 * mm)] + right_paragraphs

    header_data = [
        [left_table, right_cells]
    ]
    header_table = Table(header_data, colWidths=[content_w * 0.6, content_w * 0.4])
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return [
        header_table,
        Spacer(1, 3 * mm),
        HRFlowable(width="100%", thickness=2, color=BRAND_BLUE),
        Spacer(1, 6 * mm)
    ]
