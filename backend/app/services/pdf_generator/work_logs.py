from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from .base import BRAND_BLUE, BRAND_LIGHT, GRAY_MID, GRAY_LIGHT, WHITE, fmt_date, fmt_idr, get_base_styles, create_header

def generate_work_logs_pdf(work_logs: list, start_date=None, end_date=None, equipment_name=None) -> bytes:
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
    eq_str = f"Alat: {equipment_name}" if equipment_name else "Semua Alat"
    eq_label = Paragraph(f"<font size='10' color='#6b7280'>{eq_str}</font>", style(alignment=TA_RIGHT))

    story.extend(create_header("LOG JAM KERJA ALAT", [period_label, eq_label], content_w))

    table_data = [[
        Paragraph("<font size='9' color='white'><b>Tanggal</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Operator</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Alat</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Input</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>HM Awal</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>HM Akhir</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Potongan</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Jam Bersih</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Biaya Sewa</b></font>", style(alignment=TA_CENTER)),
    ]]
    
    total_jam_bersih = 0.0
    total_biaya_sewa = 0.0

    for i, wl in enumerate(work_logs):
        tanggal = fmt_date(wl.work_date)
        operator = wl.operator_name or "-"
        alat = getattr(wl, "equipment_name", None)
        if alat is None:
            alat = getattr(wl.equipment, "name", "-") if hasattr(wl, "equipment") else "-"
            
        input_method = wl.input_method or "HM"
        hm_awal = str(wl.hm_start) if wl.hm_start is not None else "-"
        hm_akhir = str(wl.hm_end) if wl.hm_end is not None else "-"
        
        tot_hours = float(wl.total_hours or 0)
        disc_hours = float(wl.rental_discount_hours or 0)
        jam_bersih = tot_hours - disc_hours
        
        rental_rate = getattr(wl, "rental_rate_per_hour", None)
        if rental_rate is None:
            rental_rate = getattr(wl.equipment, "rental_rate_per_hour", 0) if hasattr(wl, "equipment") and wl.equipment else 0
        rental_rate = float(rental_rate or 0)
        
        biaya_sewa = jam_bersih * rental_rate
        
        total_jam_bersih += jam_bersih
        total_biaya_sewa += biaya_sewa

        table_data.append([
            Paragraph(f"<font size='8'>{tanggal}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{operator}</font>", style(alignment=TA_LEFT)),
            Paragraph(f"<font size='8'>{alat}</font>", style(alignment=TA_LEFT)),
            Paragraph(f"<font size='8'>{input_method}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{hm_awal}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{hm_akhir}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{disc_hours:g} j</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'><b>{jam_bersih:g} j</b></font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{fmt_idr(biaya_sewa)}</font>", style(alignment=TA_RIGHT)),
        ])

    table_data.append([
        Paragraph("<font size='9'><b>TOTAL</b></font>", style(alignment=TA_RIGHT)),
        "", "", "", "", "", "",
        Paragraph(f"<font size='9'><b>{total_jam_bersih:g} jam</b></font>", style(alignment=TA_CENTER)),
        Paragraph(f"<font size='9'><b>{fmt_idr(total_biaya_sewa)}</b></font>", style(alignment=TA_RIGHT)),
    ])

    col_widths = [
        content_w * 0.12, # Tanggal
        content_w * 0.15, # Operator
        content_w * 0.15, # Alat
        content_w * 0.08, # Input
        content_w * 0.08, # HM Awal
        content_w * 0.08, # HM Akhir
        content_w * 0.08, # Potongan
        content_w * 0.09, # Jam Bersih
        content_w * 0.17, # Biaya Sewa
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
        
        ("SPAN", (0, -1), (6, -1)),
        ("ALIGN", (0, -1), (0, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), BRAND_LIGHT),
        ("BOX", (0, -1), (-1, -1), 1, BRAND_BLUE),
    ]
    
    for i in range(len(work_logs)):
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
