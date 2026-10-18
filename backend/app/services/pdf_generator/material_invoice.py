from collections import defaultdict
from datetime import date, datetime
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .base import (
    ACCENT_GREEN,
    ACCENT_RED,
    BRAND_BLUE,
    BRAND_LIGHT,
    GRAY_DARK,
    GRAY_LIGHT,
    GRAY_MID,
    WHITE,
    create_header,
    fmt_date,
    fmt_idr,
    fmt_qty,
    get_base_styles,
    get_logo_image,
)


def generate_material_invoice_pdf(invoice, include_kuitansi: bool = False, kuitansi_options: Optional[dict] = None) -> bytes:
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

    invoice_number = getattr(invoice, "invoice_number", "-")
    invoice_num_label = Paragraph(f"<font size='12' color='#111827'><b>{invoice_number}</b></font>", style(alignment=TA_RIGHT))
    
    invoice_date = fmt_date(getattr(invoice, "invoice_date", getattr(invoice, "created_at", None)))
    date_label = Paragraph(f"<font size='9' color='#6b7280'>Tanggal: {invoice_date}</font>", style(alignment=TA_RIGHT))

    story.extend(create_header("INVOICE", [invoice_num_label, date_label], content_w, title_size=22))

    # Customer and Period Info
    customer_name = getattr(invoice, "customer_name", "-")
    start_date = fmt_date(getattr(invoice, "start_date", None))
    end_date = fmt_date(getattr(invoice, "end_date", None))
    
    project = getattr(invoice, "project", None)
    project_location = getattr(project, "location", "") if project else ""
    
    customer_html = f"<font size='14'><b>{customer_name}</b></font>"
    if project_location:
        customer_html += f"<br/><font size='10' color='#4b5563'>{project_location}</font>"
    
    info_table = Table([
        [
            Paragraph("<font size='9' color='#6b7280'>Kepada Yth:</font>", style()),
            Paragraph("<font size='9' color='#6b7280'>Periode Penjualan:</font>", style(alignment=TA_RIGHT))
        ],
        [
            Paragraph(customer_html, style()),
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
    payment_info = []
    bank_account = getattr(invoice, "bank_account", None)
    if bank_account:
        payment_info = [
            Paragraph("<font size='9'><b>Informasi Pembayaran:</b></font>", style()),
            Spacer(1, 2 * mm),
            Paragraph(f"<font size='9' color='#4b5563'>{bank_account.bank_name}</font>", style()),
            Paragraph(f"<font size='9' color='#4b5563'>No. Rekening: <b>{bank_account.account_number}</b></font>", style()),
            Paragraph(f"<font size='9' color='#4b5563'>Atas Nama: <b>{bank_account.account_name}</b></font>", style()),
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

    if include_kuitansi:
        from .kuitansi import build_kuitansi_story
        story.append(PageBreak())
        story.extend(build_kuitansi_story(invoice, options=kuitansi_options, content_w=content_w))

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
