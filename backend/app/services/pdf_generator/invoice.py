from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, PageBreak
from .base import BRAND_BLUE, BRAND_LIGHT, ACCENT_GREEN, ACCENT_RED, GRAY_DARK, GRAY_MID, GRAY_LIGHT, WHITE, fmt_date, fmt_idr, fmt_qty, get_base_styles, get_logo_image

def generate_invoice_pdf(invoice) -> bytes:
    if getattr(invoice, "invoice_type", "material_sale") == "project":
        return generate_project_invoice_pdf(invoice)

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

    # Items Summary Table
    table_data = [[
        Paragraph("<font size='9' color='white'><b>No</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Tanggal</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Material</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Jumlah Ritase</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Jumlah Qty</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Harga Satuan</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Subtotal</b></font>", style(alignment=TA_CENTER)),
    ]]

    items = getattr(invoice, "items", [])
    
    from collections import defaultdict
    summary_raw = defaultdict(lambda: {'date_str': '', 'material': '', 'ritase': 0, 'qty': 0.0, 'unit': '', 'unit_price': 0.0, 'amount': 0.0})
    for item in items:
        raw_date = getattr(item, "income_date", None)
        if not raw_date: continue
        mat = getattr(item, "material_type", "-")
        qty = getattr(item, "quantity", 0) or 0
        unit = getattr(item, "unit", "") or ""
        price = getattr(item, "unit_price", 0) or 0
        amount = getattr(item, "amount", 0) or 0
        
        key = (raw_date, mat, price)
        summary_raw[key]['date_str'] = fmt_date(raw_date)
        summary_raw[key]['material'] = mat
        summary_raw[key]['ritase'] += 1
        summary_raw[key]['qty'] += qty
        summary_raw[key]['unit'] = unit
        summary_raw[key]['unit_price'] = price
        summary_raw[key]['amount'] += amount

    sorted_keys = sorted(list(summary_raw.keys()), key=lambda k: (k[0], k[1]))

    subtotal = 0.0
    for i, k in enumerate(sorted_keys):
        d = summary_raw[k]
        subtotal += d['amount']
        table_data.append([
            Paragraph(f"<font size='8'>{i+1}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{d['date_str']}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{d['material']}</font>", style(alignment=TA_LEFT)),
            Paragraph(f"<font size='8'>{d['ritase']} Rit</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{d['qty']:g} {d['unit']}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{fmt_idr(d['unit_price'])}</font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='8'><b>{fmt_idr(d['amount'])}</b></font>", style(alignment=TA_RIGHT)),
        ])

    # Footer rows for Subtotal, Discount, Total
    discount_type = getattr(invoice, "discount_type", None)
    discount_val = getattr(invoice, "discount_value", 0) or 0
    total_amount = getattr(invoice, "total_amount", 0) or 0
    
    # Subtotal
    table_data.append([
        Paragraph("<font size='9'><b>Subtotal</b></font>", style(alignment=TA_RIGHT)),
        "", "", "", "", "",
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
            "", "", "", "", "",
            Paragraph(f"<font size='9' color='#ef4444'><b>- {fmt_idr(discount_amount)}</b></font>", style(alignment=TA_RIGHT))
        ])
        extra_rows += 1

    # Total
    table_data.append([
        Paragraph("<font size='10' color='#10b981'><b>TOTAL TAGIHAN</b></font>", style(alignment=TA_RIGHT)),
        "", "", "", "", "",
        Paragraph(f"<font size='10' color='#10b981'><b>{fmt_idr(total_amount)}</b></font>", style(alignment=TA_RIGHT))
    ])
    extra_rows += 1

    col_widths = [
        content_w * 0.05, # No
        content_w * 0.15, # Tanggal
        content_w * 0.20, # Material
        content_w * 0.15, # Ritase
        content_w * 0.15, # Qty
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
    
    for i in range(len(sorted_keys)):
        bg_color = WHITE if i % 2 == 0 else GRAY_LIGHT
        t_styles.append(("BACKGROUND", (0, i + 1), (-1, i + 1), bg_color))
        
    # Style for Subtotal, Discount, Total
    for j in range(1, extra_rows + 1):
        row_idx = -j
        t_styles.extend([
            ("SPAN", (0, row_idx), (5, row_idx)),
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
    payment_info = [
        Paragraph("<font size='9'><b>Informasi Pembayaran:</b></font>", style()),
        Spacer(1, 2 * mm),
        Paragraph("<font size='9' color='#4b5563'>Bank Mandiri</font>", style()),
        Paragraph("<font size='9' color='#4b5563'>No. Rekening: <b>1780001847504</b></font>", style()),
        Paragraph("<font size='9' color='#4b5563'>Atas Nama: <b>DEWI KUSUMA WARDHANI</b></font>", style()),
    ]

    sig_data = [
        [Paragraph("<font size='9'>Hormat Kami,</font>", style(alignment=TA_CENTER))],
        [Paragraph("<br/><br/><br/>", style())],
        [Paragraph("<font size='9'><b>( Finance Dept. )</b></font>", style(alignment=TA_CENTER))],
    ]
    sig_table = Table(sig_data, colWidths=[5 * cm])
    sig_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    
    # Push signature to the right and add payment info to the left
    sig_wrapper = Table([[payment_info, sig_table]], colWidths=[content_w - 5*cm, 5*cm])
    sig_wrapper.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
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

    if len(items) > 0:
        story.append(PageBreak())
        
        story.append(Paragraph("<font size='14'><b>LAMPIRAN DETAIL PENJUALAN MATERIAL</b></font>", style(alignment=TA_CENTER)))
        story.append(Spacer(1, 5 * mm))
        
        detail_data = [[
            Paragraph("<font size='9' color='white'><b>No</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Tanggal</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Material</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Nopol</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Supir</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Qty</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Harga</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Jumlah</b></font>", style(alignment=TA_CENTER)),
        ]]
        
        from datetime import date
        sorted_items = sorted(items, key=lambda x: (getattr(x, "income_date", None) or date.min, getattr(x, "material_type", ""), getattr(x, "license_plate", "") or ""))
        
        for i, item in enumerate(sorted_items):
            inc_date = fmt_date(getattr(item, "income_date", None))
            material = getattr(item, "material_type", "-")
            nopol = getattr(item, "license_plate", "-") or "-"
            supir = getattr(item, "driver_name", "-") or "-"
            qty = getattr(item, "quantity", 0) or 0
            unit = getattr(item, "unit", "") or ""
            qty_str = f"{qty:g} {unit}"
            price = getattr(item, "unit_price", 0) or 0
            amount = getattr(item, "amount", 0) or 0
            
            detail_data.append([
                Paragraph(f"<font size='8'>{i+1}</font>", style(alignment=TA_CENTER)),
                Paragraph(f"<font size='8'>{inc_date}</font>", style(alignment=TA_CENTER)),
                Paragraph(f"<font size='8'>{material}</font>", style(alignment=TA_LEFT)),
                Paragraph(f"<font size='8'>{nopol}</font>", style(alignment=TA_CENTER)),
                Paragraph(f"<font size='8'>{supir}</font>", style(alignment=TA_LEFT)),
                Paragraph(f"<font size='8'>{qty_str}</font>", style(alignment=TA_RIGHT)),
                Paragraph(f"<font size='8'>{fmt_idr(price)}</font>", style(alignment=TA_RIGHT)),
                Paragraph(f"<font size='8'><b>{fmt_idr(amount)}</b></font>", style(alignment=TA_RIGHT)),
            ])
            
        detail_col_w = [
            content_w * 0.05,
            content_w * 0.13,
            content_w * 0.15,
            content_w * 0.12,
            content_w * 0.15,
            content_w * 0.10,
            content_w * 0.15,
            content_w * 0.15,
        ]
        
        dt = Table(detail_data, colWidths=detail_col_w, repeatRows=1)
        dt_styles = [
            ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#9ca3af")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]
        for i in range(len(sorted_items)):
            bg = WHITE if i % 2 == 0 else GRAY_LIGHT
            dt_styles.append(("BACKGROUND", (0, i + 1), (-1, i + 1), bg))
            
        dt.setStyle(TableStyle(dt_styles))
        story.append(dt)
        story.append(Spacer(1, 8 * mm))

    doc.build(story)
    return buf.getvalue()

def generate_project_invoice_pdf(invoice) -> bytes:
    from collections import defaultdict
    
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

    story.extend(create_header("INVOICE PROYEK", [invoice_num_label, date_label], content_w, title_size=20))

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

    items = getattr(invoice, "items", [])
    
    summary_raw = defaultdict(lambda: {'date_str': '', 'ritase': 0, 'qty': 0.0, 'unit': '', 'unit_price': 0.0, 'amount': 0.0})
    for item in items:
        raw_date = getattr(item, "income_date", None)
        if not raw_date: continue
        qty = getattr(item, "quantity", 0) or 0
        unit = getattr(item, "unit", "") or ""
        price = getattr(item, "unit_price", 0) or 0
        amount = getattr(item, "amount", 0) or 0
        
        summary_raw[raw_date]['date_str'] = fmt_date(raw_date)
        summary_raw[raw_date]['ritase'] += 1
        summary_raw[raw_date]['qty'] += qty
        summary_raw[raw_date]['unit'] = unit
        summary_raw[raw_date]['unit_price'] = price
        summary_raw[raw_date]['amount'] += amount

    sorted_raw_dates = sorted(list(summary_raw.keys()))

    table_data = [[
        Paragraph("<font size='9' color='white'><b>No</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Tanggal</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Jumlah Ritase</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Jumlah Qty</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Harga Satuan</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='9' color='white'><b>Subtotal</b></font>", style(alignment=TA_CENTER)),
    ]]

    total_ritase = 0
    total_qty = 0.0
    first_unit = ""
    if sorted_raw_dates:
        first_unit = summary_raw[sorted_raw_dates[0]]['unit']

    subtotal = 0.0
    for i, rdate in enumerate(sorted_raw_dates):
        d = summary_raw[rdate]
        subtotal += d['amount']
        total_ritase += d['ritase']
        total_qty += d['qty']
        table_data.append([
            Paragraph(f"<font size='8'>{i+1}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{d['date_str']}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{d['ritase']} Rit</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{fmt_qty(d['qty'], 3)} {d['unit']}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{fmt_idr(d['unit_price'])}</font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='8'><b>{fmt_idr(d['amount'])}</b></font>", style(alignment=TA_RIGHT)),
        ])

    table_data.append([
        Paragraph("<font size='9'><b>Total Keseluruhan</b></font>", style(alignment=TA_RIGHT)),
        "",
        Paragraph(f"<font size='9'><b>{total_ritase} Rit</b></font>", style(alignment=TA_CENTER)),
        Paragraph(f"<font size='9'><b>{fmt_qty(total_qty, 3)} {first_unit}</b></font>", style(alignment=TA_CENTER)),
        "", ""
    ])

    discount_type = getattr(invoice, "discount_type", None)
    discount_val = getattr(invoice, "discount_value", 0) or 0
    total_amount = getattr(invoice, "total_amount", 0) or 0
    
    table_data.append([
        Paragraph("<font size='9'><b>Subtotal</b></font>", style(alignment=TA_RIGHT)),
        "", "", "", "",
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
            "", "", "", "",
            Paragraph(f"<font size='9' color='#ef4444'><b>- {fmt_idr(discount_amount)}</b></font>", style(alignment=TA_RIGHT))
        ])
        extra_rows += 1

    table_data.append([
        Paragraph("<font size='10' color='#10b981'><b>TOTAL TAGIHAN</b></font>", style(alignment=TA_RIGHT)),
        "", "", "", "",
        Paragraph(f"<font size='10' color='#10b981'><b>{fmt_idr(total_amount)}</b></font>", style(alignment=TA_RIGHT))
    ])
    extra_rows += 1

    col_widths = [
        content_w * 0.05,
        content_w * 0.20,
        content_w * 0.15,
        content_w * 0.20,
        content_w * 0.20,
        content_w * 0.20,
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
    
    for i in range(len(sorted_raw_dates)):
        bg_color = WHITE if i % 2 == 0 else GRAY_LIGHT
        t_styles.append(("BACKGROUND", (0, i + 1), (-1, i + 1), bg_color))
        
    total_row_idx = len(sorted_raw_dates) + 1
    t_styles.extend([
        ("SPAN", (0, total_row_idx), (1, total_row_idx)),
        ("SPAN", (4, total_row_idx), (5, total_row_idx)),
        ("BACKGROUND", (0, total_row_idx), (-1, total_row_idx), GRAY_LIGHT),
    ])

    for j in range(1, extra_rows + 1):
        row_idx = -j
        t_styles.extend([
            ("SPAN", (0, row_idx), (4, row_idx)),
            ("ALIGN", (0, row_idx), (0, row_idx), "RIGHT"),
            ("BACKGROUND", (0, row_idx), (-1, row_idx), BRAND_LIGHT if j == 1 else (colors.HexColor("#fee2e2") if extra_rows > 2 and j == 2 else WHITE)),
            ("BOX", (0, row_idx), (-1, row_idx), 0.5, colors.HexColor("#9ca3af")),
        ])
        if j == 1:
            t_styles.append(("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#d1fae5")))
            t_styles.append(("BOX", (0, row_idx), (-1, row_idx), 1, ACCENT_GREEN))
            
    t.setStyle(TableStyle(t_styles))
    story.append(t)
    story.append(Spacer(1, 8 * mm))

    notes = getattr(invoice, "notes", "")
    if notes:
        story.append(Paragraph("<font size='9'><b>Catatan:</b></font>", style()))
        story.append(Paragraph(f"<font size='9' color='#4b5563'>{notes}</font>", style()))
        story.append(Spacer(1, 8 * mm))

    payment_info = [
        Paragraph("<font size='9'><b>Informasi Pembayaran:</b></font>", style()),
        Spacer(1, 2 * mm),
        Paragraph("<font size='9' color='#4b5563'>Bank Mandiri</font>", style()),
        Paragraph("<font size='9' color='#4b5563'>No. Rekening: <b>1780001847504</b></font>", style()),
        Paragraph("<font size='9' color='#4b5563'>Atas Nama: <b>DEWI KUSUMA WARDHANI</b></font>", style()),
    ]

    sig_data = [
        [Paragraph("<font size='9'>Hormat Kami,</font>", style(alignment=TA_CENTER))],
        [Paragraph("<br/><br/><br/>", style())],
        [Paragraph("<font size='9'><b>( Finance Dept. )</b></font>", style(alignment=TA_CENTER))],
    ]
    sig_table = Table(sig_data, colWidths=[5 * cm])
    sig_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    
    sig_wrapper = Table([[payment_info, sig_table]], colWidths=[content_w - 5*cm, 5*cm])
    sig_wrapper.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sig_wrapper)
    story.append(Spacer(1, 4 * mm))

    if len(items) > 0:
        story.append(PageBreak())
        
        first_item = items[0]
        unit = getattr(first_item, "unit", "") or ""
        is_tonase = unit.lower() == "ton"
        
        story.append(Paragraph("<font size='14'><b>LAMPIRAN DETAIL SURAT JALAN</b></font>", style(alignment=TA_CENTER)))
        story.append(Spacer(1, 5 * mm))
        
        from itertools import groupby
        # Sort items by date then nopol
        sorted_items = sorted(items, key=lambda x: (getattr(x, "income_date", None) or date.min, getattr(x, "license_plate", "") or ""))

        if is_tonase:
            detail_headers = ["No", "Nopol", "Supir", "Bruto", "Tarra", "Potongan", "Netto (Ton)"]
            col_w = [content_w * 0.05, content_w * 0.15, content_w * 0.20, content_w * 0.15, content_w * 0.15, content_w * 0.15, content_w * 0.15]
        else:
            detail_headers = ["No", "Nopol", "Supir", "P", "L", "T", "Min.T", "Vol (m3)"]
            col_w = [content_w * 0.05, content_w * 0.15, content_w * 0.18, content_w * 0.10, content_w * 0.10, content_w * 0.10, content_w * 0.12, content_w * 0.20]

        for inc_date, group in groupby(sorted_items, key=lambda x: getattr(x, "income_date", None) or date.min):
            group_items = list(group)
            date_ritase = 0
            date_qty = 0.0
            
            dt_str_sub = fmt_date(inc_date)
            story.append(Paragraph(f"<font size='10' color='#1f2937'><b>Tanggal: {dt_str_sub}</b></font>", style()))
            story.append(Spacer(1, 2 * mm))
            
            detail_data = [[Paragraph(f"<font size='8' color='white'><b>{h}</b></font>", style(alignment=TA_CENTER)) for h in detail_headers]]
            
            dt_styles = [
                ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e5e7eb")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#9ca3af")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]

            row_idx = 1
            item_counter = 1
            
            for item in group_items:
                nopol = getattr(item, "license_plate", "-") or "-"
                supir = getattr(item, "driver_name", "-") or "-"
                
                row = [
                    Paragraph(f"<font size='8'>{item_counter}</font>", style(alignment=TA_CENTER)),
                    Paragraph(f"<font size='8'>{nopol}</font>", style(alignment=TA_CENTER)),
                    Paragraph(f"<font size='8'>{supir}</font>", style(alignment=TA_LEFT))
                ]
                
                if is_tonase:
                    bruto = getattr(item, "sj_gross_weight", 0) or 0
                    tarra = getattr(item, "sj_tare_weight", 0) or 0
                    minus = getattr(item, "sj_weight_minus", 0) or 0
                    netto = getattr(item, "sj_net_weight", 0) or 0
                    if not netto: netto = getattr(item, "quantity", 0) or 0
                    
                    row.extend([
                        Paragraph(f"<font size='8'>{fmt_qty(bruto, 0)}</font>", style(alignment=TA_CENTER)),
                        Paragraph(f"<font size='8'>{fmt_qty(tarra, 0)}</font>", style(alignment=TA_CENTER)),
                        Paragraph(f"<font size='8'>{fmt_qty(minus, 0)}</font>", style(alignment=TA_CENTER)),
                        Paragraph(f"<font size='8'><b>{fmt_qty(netto, 3)}</b></font>", style(alignment=TA_CENTER)),
                    ])
                    date_qty += netto
                else:
                    p = getattr(item, "sj_length", 0) or 0
                    l = getattr(item, "sj_width", 0) or 0
                    t_val = getattr(item, "sj_height", 0) or 0
                    m = getattr(item, "sj_volume_minus", 0) or 0
                    vol = getattr(item, "sj_volume", 0) or 0
                    if not vol: vol = getattr(item, "quantity", 0) or 0
                    
                    row.extend([
                        Paragraph(f"<font size='8'>{fmt_qty(p, 3)}</font>", style(alignment=TA_CENTER)),
                        Paragraph(f"<font size='8'>{fmt_qty(l, 3)}</font>", style(alignment=TA_CENTER)),
                        Paragraph(f"<font size='8'>{fmt_qty(t_val, 3)}</font>", style(alignment=TA_CENTER)),
                        Paragraph(f"<font size='8'>{fmt_qty(m, 3)}</font>", style(alignment=TA_CENTER)),
                        Paragraph(f"<font size='8'><b>{fmt_qty(vol, 3)}</b></font>", style(alignment=TA_CENTER)),
                    ])
                    date_qty += vol
                
                date_ritase += 1
                detail_data.append(row)
                
                bg_color = WHITE if item_counter % 2 != 0 else GRAY_LIGHT
                dt_styles.append(("BACKGROUND", (0, row_idx), (-1, row_idx), bg_color))
                
                item_counter += 1
                row_idx += 1
                
            if is_tonase:
                sub_row = [
                    Paragraph(f"<font size='8'><b>Total {dt_str_sub}</b></font>", style(alignment=TA_RIGHT)),
                    "", "",
                    Paragraph(f"<font size='8'><b>{date_ritase} Rit</b></font>", style(alignment=TA_CENTER)),
                    "", "",
                    Paragraph(f"<font size='8'><b>{fmt_qty(date_qty, 3)}</b></font>", style(alignment=TA_CENTER)),
                ]
                dt_styles.extend([
                    ("SPAN", (0, row_idx), (2, row_idx)),
                    ("SPAN", (3, row_idx), (4, row_idx)),
                    ("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#e5e7eb")),
                ])
            else:
                sub_row = [
                    Paragraph(f"<font size='8'><b>Total {dt_str_sub}</b></font>", style(alignment=TA_RIGHT)),
                    "", "", "", "",
                    Paragraph(f"<font size='8'><b>{date_ritase} Rit</b></font>", style(alignment=TA_CENTER)),
                    "",
                    Paragraph(f"<font size='8'><b>{fmt_qty(date_qty, 3)}</b></font>", style(alignment=TA_CENTER)),
                ]
                dt_styles.extend([
                    ("SPAN", (0, row_idx), (4, row_idx)),
                    ("SPAN", (5, row_idx), (6, row_idx)),
                    ("BACKGROUND", (0, row_idx), (-1, row_idx), colors.HexColor("#e5e7eb")),
                ])
            
            detail_data.append(sub_row)
            
            dt_table = Table(detail_data, colWidths=col_w, repeatRows=1)
            dt_table.setStyle(TableStyle(dt_styles))
            story.append(dt_table)
            story.append(Spacer(1, 6 * mm))

    def add_footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(GRAY_MID)
        canvas.setLineWidth(0.5)
        canvas.line(1.5*cm, 1.5*cm + 10, A4[0] - 1.5*cm, 1.5*cm + 10)
        
        generated_at = datetime.now()
        footer_text = f"Invoice ini dicetak secara otomatis oleh System Kusuma pada {generated_at.strftime('%d %B %Y pukul %H:%M')} · Dokumen ini sah tanpa tanda tangan basah."
        
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(colors.HexColor('#9ca3af'))
        canvas.drawCentredString(A4[0] / 2.0, 1.5*cm, footer_text)
        canvas.restoreState()

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    return buf.getvalue()
