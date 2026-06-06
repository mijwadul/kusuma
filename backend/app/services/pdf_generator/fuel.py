from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from .base import BRAND_BLUE, BRAND_LIGHT, GRAY_MID, GRAY_LIGHT, WHITE, fmt_date, fmt_idr, get_base_styles, create_header

def generate_fuel_purchases_pdf(purchases, start_date=None, end_date=None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )
    W, _ = landscape(A4)
    content_w = W - 3 * cm

    style = get_base_styles()
    story = []

    period_str = "Semua Tanggal"
    if start_date and end_date:
        period_str = f"Periode: {fmt_date(start_date)} - {fmt_date(end_date)}"
    elif start_date:
        period_str = f"Mulai: {fmt_date(start_date)}"
    elif end_date:
        period_str = f"Sampai: {fmt_date(end_date)}"

    period_label = Paragraph(f"<font size='10' color='#6b7280'>{period_str}</font>", style(alignment=TA_RIGHT))
    
    # Header
    story.extend(create_header("LAPORAN PEMBELIAN BBM", [period_label], content_w))

    table_data = [[
        Paragraph("<font size='9' color='white'><b>No</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Tanggal</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Vendor</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Liter</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Harga/Liter</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Total Harga</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Status</b></font>", style(alignment=TA_CENTER)),
    ]]
    
    total_liter = 0.0
    total_harga = 0.0

    for i, p in enumerate(purchases):
        eff_date = getattr(p, "effective_date", None)
        c_date = getattr(p, "created_at", None)
        tanggal = fmt_date(eff_date if eff_date else c_date)
        vendor = getattr(p, "vendor_name", "-") or "-"
        liter = float(getattr(p, "liters", 0) or 0)
        harga_per_liter = float(getattr(p, "price_per_liter", 0) or 0)
        total = float(getattr(p, "total_price", 0) or 0)
        status = getattr(p, "approval_status", "pending")
        
        if status == "approved":
            status_text = "Disetujui"
        elif status == "rejected":
            status_text = "Ditolak"
        else:
            status_text = "Menunggu"
            
        total_liter += liter
        total_harga += total

        table_data.append([
            Paragraph(f"<font size='8'>{i+1}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{tanggal}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{vendor}</font>", style(alignment=TA_LEFT)),
            Paragraph(f"<font size='8'>{liter:g} L</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{fmt_idr(harga_per_liter)}</font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='8'><b>{fmt_idr(total)}</b></font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='8'>{status_text}</font>", style(alignment=TA_CENTER)),
        ])

    table_data.append([
        Paragraph("<font size='9'><b>TOTAL KESELURUHAN</b></font>", style(alignment=TA_RIGHT)),
        "", "",
        Paragraph(f"<font size='9'><b>{total_liter:g} L</b></font>", style(alignment=TA_CENTER)),
        "-",
        Paragraph(f"<font size='9' color='#10b981'><b>{fmt_idr(total_harga)}</b></font>", style(alignment=TA_RIGHT)),
        ""
    ])

    col_widths = [
        content_w * 0.05, # No
        content_w * 0.15, # Tanggal
        content_w * 0.20, # Vendor
        content_w * 0.15, # Liter
        content_w * 0.15, # Harga/Liter
        content_w * 0.18, # Total Harga
        content_w * 0.12, # Status
    ]
    
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    t_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("INNERGRID", (0, 0), (-1, -2), 0.25, colors.HexColor("#e5e7eb")),
        ("BOX", (0, 0), (-1, -2), 0.5, colors.HexColor("#9ca3af")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        
        ("SPAN", (0, -1), (2, -1)),
        ("ALIGN", (0, -1), (0, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), BRAND_LIGHT),
        ("BOX", (0, -1), (-1, -1), 1, BRAND_BLUE),
    ]
    
    for i in range(len(purchases)):
        bg_color = WHITE if i % 2 == 0 else GRAY_LIGHT
        t_styles.append(("BACKGROUND", (0, i + 1), (-1, i + 1), bg_color))
        
    t.setStyle(TableStyle(t_styles))
    story.append(t)
    story.append(Spacer(1, 8 * mm))

    generated_at = datetime.now()
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_MID))
    story.append(Spacer(1, 2 * mm))
    story.append(
        Paragraph(
            f"<font size='7' color='#9ca3af'>Laporan dicetak secara otomatis oleh sistem pada "
            f"{generated_at.strftime('%d %B %Y pukul %H:%M')}</font>",
            style(alignment=TA_CENTER),
        )
    )

    doc.build(story)
    return buf.getvalue()
