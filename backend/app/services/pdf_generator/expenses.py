from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from .base import BRAND_BLUE, BRAND_LIGHT, GRAY_MID, GRAY_LIGHT, WHITE, fmt_date, fmt_idr, get_base_styles, create_header

def generate_expense_records_pdf(records, start_date=None, end_date=None) -> bytes:
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
    story.extend(create_header("LAPORAN PENGELUARAN", [period_label], content_w))

    table_data = [[
        Paragraph("<font size='9' color='white'><b>No</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Tanggal</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Kategori</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Deskripsi</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Proyek/Penerima</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Pembayaran</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Nominal</b></font>", style(alignment=TA_CENTER)),
    ]]
    
    total_amount = 0.0

    for i, r in enumerate(records):
        tanggal = fmt_date(getattr(r, "expense_date", getattr(r, "created_at", None)))
        
        cat = getattr(r, "category", "")
        if cat == "operational":
            kategori = "Operasional"
        elif cat == "project":
            kategori = "Proyek"
        elif cat == "salary":
            kategori = "Gaji"
        elif cat == "equipment":
            kategori = "Alat Berat"
        elif cat == "fuel":
            kategori = "BBM"
        elif cat == "office":
            kategori = "Kantor"
        elif cat == "other":
            kategori = "Lainnya"
        else:
            kategori = cat.capitalize() if cat else "-"
            
        desc = getattr(r, "description", "-") or "-"
        
        if cat == "project":
            client = getattr(r.project, "name", "-") if hasattr(r, "project") and r.project else "-"
        else:
            client = getattr(r, "recipient", "-") or "-"
            
        pay_method = getattr(r, "payment_method", "cash")
        pay_text = "Transfer" if pay_method == "transfer" else "Cash"
        
        amount = float(getattr(r, "amount", 0) or 0)
        total_amount += amount

        table_data.append([
            Paragraph(f"<font size='8'>{i+1}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{tanggal}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{kategori}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{desc}</font>", style(alignment=TA_LEFT)),
            Paragraph(f"<font size='8'>{client}</font>", style(alignment=TA_LEFT)),
            Paragraph(f"<font size='8'>{pay_text}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'><b>{fmt_idr(amount)}</b></font>", style(alignment=TA_RIGHT)),
        ])

    table_data.append([
        Paragraph("<font size='9'><b>TOTAL PENGELUARAN</b></font>", style(alignment=TA_RIGHT)),
        "", "", "", "", "",
        Paragraph(f"<font size='9' color='#dc2626'><b>{fmt_idr(total_amount)}</b></font>", style(alignment=TA_RIGHT))
    ])

    col_widths = [
        content_w * 0.05, # No
        content_w * 0.12, # Tanggal
        content_w * 0.12, # Kategori
        content_w * 0.25, # Deskripsi
        content_w * 0.18, # Proyek/Penerima
        content_w * 0.10, # Pembayaran
        content_w * 0.18, # Nominal
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
        
        ("SPAN", (0, -1), (5, -1)),
        ("ALIGN", (0, -1), (0, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), BRAND_LIGHT),
        ("BOX", (0, -1), (-1, -1), 1, BRAND_BLUE),
    ]
    
    for i in range(len(records)):
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
