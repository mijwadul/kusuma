from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from .base import BRAND_BLUE, BRAND_LIGHT, ACCENT_GREEN, ACCENT_RED, GRAY_DARK, GRAY_MID, GRAY_LIGHT, WHITE, fmt_date, fmt_idr, get_base_styles, get_logo_image

def generate_payroll_pdf(payroll_data: dict) -> bytes:
    employee = payroll_data["employee"]
    payroll = payroll_data["payroll"]
    generated_at: datetime = payroll_data.get("generated_at", datetime.now())

    def g(obj, key, default=""):
        if obj is None:
            return default
        if isinstance(obj, dict):
            return obj.get(key, default) or default
        return getattr(obj, key, default) or default

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=1.5*cm
    )
    W, _ = A4
    content_w = W - 3 * cm

    style = get_base_styles()
    story = []

    from .base import create_header
    
    period_label = Paragraph(
        f"<font size='10' color='#6b7280'>Periode: {fmt_date(g(payroll, 'period_start'))} – {fmt_date(g(payroll, 'period_end'))}</font>",
        style(alignment=TA_RIGHT),
    )

    story.extend(create_header("SLIP GAJI", [period_label], content_w, title_size=22))

    # Employee Info
    emp_name = g(employee, "name", "—")
    def info_row(label, value):
        return [
            Paragraph(f"<font size='9' color='#6b7280'>{label}</font>", style()),
            Paragraph("<font size='9'>:</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='9'><b>{value}</b></font>", style()),
        ]

    emp_info = Table([
        info_row("Nama Karyawan", emp_name),
        info_row("NIK", g(employee, "nik", "-")),
        info_row("Jabatan", g(employee, "position", "-")),
        info_row("Departemen", g(employee, "department", "-")),
        info_row("Jenis Karyawan", str(g(employee, "employment_type", "-")).capitalize()),
    ], colWidths=[3.5 * cm, 0.5 * cm, content_w / 2 - 4 * cm])
    emp_info.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))

    # Work Info
    payroll_id = g(payroll, "id", "-")
    ot_hours = g(payroll, "overtime_hours", 0)
    
    def wday_row(label, value, bold=False):
        b = "<b>" if bold else ""
        be = "</b>" if bold else ""
        return [
            Paragraph(f"<font size='9' color='#6b7280'>{label}</font>", style()),
            Paragraph("<font size='9'>:</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='9'>{b}{value}{be}</font>", style()),
        ]

    work_info = Table([
        wday_row("No. Slip", f"SG-{payroll_id:04d}" if isinstance(payroll_id, int) else f"SG-{payroll_id}"),
        wday_row("Hari Kerja", f"{g(payroll, 'work_days', 0)} hari"),
        wday_row("Hadir", f"{g(payroll, 'present_days', 0)} hari"),
        wday_row("Tidak Hadir", f"{g(payroll, 'absent_days', 0)} hari"),
        wday_row("Jam Lembur", f"{ot_hours} jam"),
    ], colWidths=[3.5 * cm, 0.5 * cm, content_w / 2 - 4 * cm])
    work_info.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 2), ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))

    two_col = Table([[emp_info, work_info]], colWidths=[content_w / 2, content_w / 2])
    two_col.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(two_col)
    story.append(Spacer(1, 4 * mm))

    # Helpers
    def section_header(title: str):
        t = Table([[Paragraph(f"<font size='9' color='white'><b>{title}</b></font>", style())]], colWidths=[content_w])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BRAND_BLUE),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return t

    def money_row(label, amount, color=None, bold=False):
        b = "<b>" if bold else ""
        be = "</b>" if bold else ""
        color_tag = f" color='{color}'" if color else ""
        return [
            Paragraph(f"<font size='9'{color_tag}>{b}{label}{be}</font>", style()),
            Paragraph(f"<font size='9'{color_tag}>{b}{fmt_idr(amount)}{be}</font>", style(alignment=TA_RIGHT)),
        ]

    # Income
    income_rows = [
        money_row("Gaji Pokok", g(payroll, "basic_salary", 0)),
        money_row(f"Lembur ({ot_hours} jam)", g(payroll, "overtime_amount", 0), color="#16a34a"),
        money_row("Bonus", g(payroll, "bonus", 0), color="#16a34a"),
        money_row("Tunjangan", g(payroll, "allowance", 0), color="#16a34a"),
        money_row("Total Pendapatan", g(payroll, "total_income", 0), bold=True),
    ]
    income_table = Table(income_rows, colWidths=[content_w * 0.65, content_w * 0.35])
    income_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 4), (-1, 4), BRAND_LIGHT),
        ("LINEABOVE", (0, 4), (-1, 4), 0.5, BRAND_BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 0), (-1, 3), [WHITE, GRAY_LIGHT]),
    ]))
    story.append(section_header("PENDAPATAN"))
    story.append(income_table)
    story.append(Spacer(1, 4 * mm))

    # Deduction
    ded_note = g(payroll, "deduction_note", "")
    deduction_rows = [
        money_row("Potongan Pinjaman", g(payroll, "loan_deduction", 0), color="#dc2626"),
        money_row("Potongan Hutang ke Perusahaan", g(payroll, "debt_deduction", 0), color="#dc2626"),
        money_row(f"Potongan Lainnya{' – ' + ded_note if ded_note else ''}", g(payroll, "other_deduction", 0), color="#dc2626"),
        money_row("Total Potongan", g(payroll, "total_deduction", 0), bold=True),
    ]
    ded_table = Table(deduction_rows, colWidths=[content_w * 0.65, content_w * 0.35])
    ded_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#fee2e2")),
        ("LINEABOVE", (0, 3), (-1, 3), 0.5, ACCENT_RED),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 0), (-1, 2), [WHITE, GRAY_LIGHT]),
    ]))
    story.append(section_header("POTONGAN"))
    story.append(ded_table)
    story.append(Spacer(1, 5 * mm))

    # Take Home Pay
    takehome_table = Table([[
        Paragraph("<font size='13' color='white'><b>TAKE-HOME PAY (GAJI BERSIH)</b></font>", style(alignment=TA_LEFT)),
        Paragraph(f"<font size='14' color='white'><b>{fmt_idr(g(payroll, 'net_salary', 0))}</b></font>", style(alignment=TA_RIGHT)),
    ]], colWidths=[content_w * 0.55, content_w * 0.45])
    takehome_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("ROUNDEDCORNERS", (0, 0), (-1, -1), 4),
    ]))
    story.append(takehome_table)
    story.append(Spacer(1, 6 * mm))

    # Notes
    notes = g(payroll, "notes", "")
    if notes:
        story.append(Paragraph(f"<font size='8' color='#92400e'><b>Catatan:</b> {notes}</font>", style()))
        story.append(Spacer(1, 4 * mm))

    # Signature
    approved_at = g(payroll, "approved_at", None)
    approved_label = fmt_date(approved_at) if approved_at else "—"
    payment_status = g(payroll, "payment_status", "—")

    sig_data = [
        [Paragraph("<font size='9'>Diterima oleh,</font>", style(alignment=TA_CENTER)), Paragraph("<font size='9'>Disetujui oleh,</font>", style(alignment=TA_CENTER))],
        [Paragraph("<br/><br/><br/>", style()), Paragraph("<br/><br/><br/>", style())],
        [Paragraph(f"<font size='9'>( {emp_name} )</font>", style(alignment=TA_CENTER)), Paragraph("<font size='9'>( General Manager )</font>", style(alignment=TA_CENTER))],
        [Paragraph("<font size='8' color='#6b7280'>Karyawan</font>", style(alignment=TA_CENTER)), Paragraph(f"<font size='8' color='#6b7280'>Tanggal: {approved_label}</font>", style(alignment=TA_CENTER))],
    ]
    sig_table = Table(sig_data, colWidths=[content_w / 2, content_w / 2])
    sig_table.setStyle(TableStyle([
        ("BOX", (0, 0), (0, -1), 0.5, colors.HexColor("#d1d5db")),
        ("BOX", (1, 0), (1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("BACKGROUND", (0, 0), (0, 0), GRAY_LIGHT),
        ("BACKGROUND", (1, 0), (1, 0), BRAND_LIGHT),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 4 * mm))

    # Footer
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_MID))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"<font size='7' color='#9ca3af'>Slip gaji ini dicetak secara otomatis oleh sistem pada "
        f"{generated_at.strftime('%d %B %Y pukul %H:%M')} · Status: {payment_status.upper()} · "
        f"Dokumen ini sah tanpa tanda tangan basah.</font>",
        style(alignment=TA_CENTER),
    ))

    doc.build(story)
    return buf.getvalue()
