from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from .base import BRAND_BLUE, BRAND_LIGHT, ACCENT_GREEN, ACCENT_RED, GRAY_DARK, GRAY_MID, GRAY_LIGHT, WHITE, fmt_date, fmt_idr, get_base_styles, get_logo_image

def generate_invoice_pdf(invoice) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )
    W, _ = A4
    content_w = W - 3 * cm

    style = get_base_styles()
    story = []

    from .base import create_header
    
    invoice_number = getattr(invoice, "invoice_number", "-")
    invoice_num_label = Paragraph(f"<font size='12' color='#111827'><b>{invoice_number}</b></font>", style(alignment=TA_RIGHT))
    
    invoice_date = fmt_date(getattr(invoice, "invoice_date", getattr(invoice, "created_at", None)))
    date_label = Paragraph(f"<font size='9' color='#6b7280'>Tanggal: {invoice_date}</font>", style(alignment=TA_RIGHT))

    story.extend(create_header("INVOICE", [invoice_num_label, date_label], content_w, title_size=22))

    # Customer and Period Info
    customer_name = getattr(invoice, "customer_name", "-")
    start_date = fmt_date(getattr(invoice, "start_date", None))
    end_date = fmt_date(getattr(invoice, "end_date", None))
    
    info_table = Table([
        [
            Paragraph("<font size='9' color='#6b7280'>Kepada Yth:</font>", style()),
            Paragraph("<font size='9' color='#6b7280'>Periode Penjualan:</font>", style(alignment=TA_RIGHT))
        ],
        [
            Paragraph(f"<font size='14'><b>{customer_name}</b></font>", style()),
            Paragraph(f"<font size='10'><b>{start_date} - {end_date}</b></font>", style(alignment=TA_RIGHT))
        ]
    ], colWidths=[content_w * 0.6, content_w * 0.4])
    info_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 8 * mm))

    # Items Table
    table_data = [[
        Paragraph("<font size='9' color='white'><b>No</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Tanggal</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Material</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Nopol</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Supir</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Qty</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Harga</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Jumlah</b></font>", style(alignment=TA_CENTER)),
    ]]

    items = getattr(invoice, "items", [])
    subtotal = 0.0

    for i, item in enumerate(items):
        inc_date = fmt_date(getattr(item, "income_date", None))
        material = getattr(item, "material_type", "-")
        nopol = getattr(item, "license_plate", "-") or "-"
        supir = getattr(item, "driver_name", "-") or "-"
        qty = getattr(item, "quantity", 0) or 0
        unit = getattr(item, "unit", "") or ""
        qty_str = f"{qty:g} {unit}"
        price = getattr(item, "unit_price", 0) or 0
        amount = getattr(item, "amount", 0) or 0
        
        subtotal += amount

        table_data.append([
            Paragraph(f"<font size='8'>{i+1}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{inc_date}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{material}</font>", style(alignment=TA_LEFT)),
            Paragraph(f"<font size='8'>{nopol}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{supir}</font>", style(alignment=TA_LEFT)),
            Paragraph(f"<font size='8'>{qty_str}</font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='8'>{fmt_idr(price)}</font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='8'><b>{fmt_idr(amount)}</b></font>", style(alignment=TA_RIGHT)),
        ])

    # Footer rows for Subtotal, Discount, Total
    # Make sure we have the same number of columns (8)
    discount_type = getattr(invoice, "discount_type", None)
    discount_val = getattr(invoice, "discount_value", 0) or 0
    total_amount = getattr(invoice, "total_amount", 0) or 0
    
    # Subtotal
    table_data.append([
        Paragraph("<font size='9'><b>Subtotal</b></font>", style(alignment=TA_RIGHT)),
        "", "", "", "", "", "",
        Paragraph(f"<font size='9'><b>{fmt_idr(subtotal)}</b></font>", style(alignment=TA_RIGHT))
    ])

    extra_rows = 1
    if discount_type and discount_val:
        discount_amount = 0
        disc_label = "Diskon"
        if discount_type == "percentage":
            discount_amount = subtotal * (discount_val / 100.0)
            disc_label = f"Diskon ({discount_val}%)"
        else:
            discount_amount = discount_val
            disc_label = "Diskon (Nominal)"
            
        table_data.append([
            Paragraph(f"<font size='9' color='#ef4444'><b>{disc_label}</b></font>", style(alignment=TA_RIGHT)),
            "", "", "", "", "", "",
            Paragraph(f"<font size='9' color='#ef4444'><b>- {fmt_idr(discount_amount)}</b></font>", style(alignment=TA_RIGHT))
        ])
        extra_rows += 1

    # Total
    table_data.append([
        Paragraph("<font size='10' color='#10b981'><b>TOTAL TAGIHAN</b></font>", style(alignment=TA_RIGHT)),
        "", "", "", "", "", "",
        Paragraph(f"<font size='10' color='#10b981'><b>{fmt_idr(total_amount)}</b></font>", style(alignment=TA_RIGHT))
    ])
    extra_rows += 1

    col_widths = [
        content_w * 0.05, # No
        content_w * 0.13, # Tanggal
        content_w * 0.15, # Material
        content_w * 0.12, # Nopol
        content_w * 0.15, # Supir
        content_w * 0.10, # Qty
        content_w * 0.15, # Harga
        content_w * 0.15, # Jumlah
    ]
    
    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    t_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("INNERGRID", (0, 0), (-1, -extra_rows - 1), 0.25, colors.HexColor("#e5e7eb")),
        ("BOX", (0, 0), (-1, -extra_rows - 1), 0.5, colors.HexColor("#9ca3af")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    
    for i in range(len(items)):
        bg_color = WHITE if i % 2 == 0 else GRAY_LIGHT
        t_styles.append(("BACKGROUND", (0, i + 1), (-1, i + 1), bg_color))
        
    # Style for Subtotal, Discount, Total
    for j in range(1, extra_rows + 1):
        row_idx = -j
        t_styles.extend([
            ("SPAN", (0, row_idx), (6, row_idx)),
            ("ALIGN", (0, row_idx), (0, row_idx), "RIGHT"),
            ("BACKGROUND", (0, row_idx), (-1, row_idx), BRAND_LIGHT if j == 1 else (colors.HexColor("#fee2e2") if extra_rows > 2 and j == 2 else WHITE)),
            ("BOX", (0, row_idx), (-1, row_idx), 0.5, colors.HexColor("#9ca3af")),
        ])
        if j == 1: # Total is always at the bottom, so j=1 is Total
            t_styles.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#d1fae5")))
            t_styles.append(("BOX", (0, row_idx), (-1, row_idx), 1, ACCENT_GREEN))
            
    t.setStyle(TableStyle(t_styles))
    story.append(t)
    story.append(Spacer(1, 8 * mm))

    # Notes
    notes = getattr(invoice, "notes", "")
    if notes:
        story.append(Paragraph("<font size='9'><b>Catatan:</b></font>", style()))
        story.append(Paragraph(f"<font size='9' color='#4b5563'>{notes}</font>", style()))
        story.append(Spacer(1, 8 * mm))

    # Signature
    sig_data = [
        [Paragraph("<font size='9'>Hormat Kami,</font>", style(alignment=TA_CENTER))],
        [Paragraph("<br/><br/><br/>", style())],
        [Paragraph("<font size='9'><b>( Finance Dept. )</b></font>", style(alignment=TA_CENTER))],
    ]
    sig_table = Table(sig_data, colWidths=[5 * cm])
    sig_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    
    # Push signature to the right
    sig_wrapper = Table([["", sig_table]], colWidths=[content_w - 5*cm, 5*cm])
    story.append(sig_wrapper)
    story.append(Spacer(1, 4 * mm))

    generated_at = datetime.now()
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY_MID))
    story.append(Spacer(1, 2 * mm))
    story.append(
        Paragraph(
            f"<font size='7' color='#9ca3af'>Invoice ini dicetak secara otomatis oleh System Kusuma pada "
            f"{generated_at.strftime('%d %B %Y pukul %H:%M')} · Dokumen ini sah tanpa tanda tangan basah.</font>",
            style(alignment=TA_CENTER),
        )
    )

    doc.build(story)
    return buf.getvalue()
