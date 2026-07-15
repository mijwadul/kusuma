from io import BytesIO
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from .base import BRAND_BLUE, BRAND_LIGHT, ACCENT_GREEN, ACCENT_RED, GRAY_DARK, GRAY_MID, GRAY_LIGHT, WHITE, fmt_date, fmt_idr, get_base_styles, get_logo_image

def generate_jasa_loading_pdf(invoice, project) -> bytes:
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
    # For Jasa Loading, we can prefix with JL-
    jl_number = f"JL-{invoice_number.replace('INV-', '')}" if invoice_number.startswith("INV-") else f"JL-{invoice_number}"
    
    invoice_num_label = Paragraph(f"<font size='12' color='#111827'><b>{jl_number}</b></font>", style(alignment=TA_RIGHT))
    
    invoice_date = fmt_date(getattr(invoice, "invoice_date", getattr(invoice, "created_at", None)))
    date_label = Paragraph(f"<font size='9' color='#6b7280'>Tanggal: {invoice_date}</font>", style(alignment=TA_RIGHT))

    story.extend(create_header("JASA LOADING", [invoice_num_label, date_label], content_w, title_size=20))

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
    
    # summary_raw[(vendor_name, loading_price, date_str)] = ritase
    summary_raw = defaultdict(int)
    total_loading_fee = 0
    total_ritase_all = 0
    
    for item in items:
        # Check if item has loading cost
        l_price = getattr(item, "loading_price", None)
        l_cost = getattr(item, "loading_cost", None)
        l_vendor_name = getattr(item, "loading_vendor_name", "-") or "-"
        
        # We only count items that have loading price configured
        if l_price is None or l_cost is None:
            continue
            
        raw_date = getattr(item, "income_date", None)
        if not raw_date: continue
        
        date_str = fmt_date(raw_date)
        key = (l_vendor_name, float(l_price), date_str)
        summary_raw[key] += 1
        total_ritase_all += 1
        total_loading_fee += float(l_cost)

    # Group by vendor
    vendor_groups = defaultdict(list)
    for (v_name, price, d_str), ritase in summary_raw.items():
        vendor_groups[v_name].append({
            'date_str': d_str,
            'price': price,
            'ritase': ritase,
            'subtotal': price * ritase
        })

    # Build the tables
    if not vendor_groups:
        story.append(Paragraph("<font size='10'>Tidak ada data jasa loading yang tercatat dengan harga di periode ini.</font>", style(alignment=TA_CENTER)))
    else:
        for v_name, group_items in sorted(vendor_groups.items()):
            # Vendor Title
            story.append(Paragraph(f"<font size='11' color='{BRAND_BLUE}'><b>Vendor: {v_name}</b></font>", style()))
            story.append(Spacer(1, 2 * mm))
            
            # Sort items by date_str (this might not sort chronologically if date_str is formatted, but usually it's ok for display or we should sort by original date)
            # Assuming group_items are small enough or date_str is sortable (if format is YYYY-MM-DD it is, if DD/MM/YYYY it's not. Let's just sort as is).
            group_items.sort(key=lambda x: x['date_str'])
            
            table_data = [[
                Paragraph("<font size='9' color='white'><b>No</b></font>", style(alignment=TA_CENTER)),
                Paragraph("<font size='9' color='white'><b>Tanggal</b></font>", style(alignment=TA_CENTER)),
                Paragraph("<font size='9' color='white'><b>Jumlah Ritase</b></font>", style(alignment=TA_CENTER)),
                Paragraph("<font size='9' color='white'><b>Rate / Rit</b></font>", style(alignment=TA_CENTER)),
                Paragraph("<font size='9' color='white'><b>Subtotal</b></font>", style(alignment=TA_CENTER)),
            ]]
            
            vendor_total = 0
            for i, d in enumerate(group_items):
                table_data.append([
                    Paragraph(f"<font size='8'>{i+1}</font>", style(alignment=TA_CENTER)),
                    Paragraph(f"<font size='8'>{d['date_str']}</font>", style(alignment=TA_CENTER)),
                    Paragraph(f"<font size='8'>{d['ritase']} Rit</font>", style(alignment=TA_CENTER)),
                    Paragraph(f"<font size='8'>{fmt_idr(d['price'])}</font>", style(alignment=TA_RIGHT)),
                    Paragraph(f"<font size='8'><b>{fmt_idr(d['subtotal'])}</b></font>", style(alignment=TA_RIGHT)),
                ])
                vendor_total += d['subtotal']
                
            table_data.append([
                Paragraph(f"<font size='9' color='#10b981'><b>SUBTOTAL {v_name.upper()}</b></font>", style(alignment=TA_RIGHT)),
                "", "", "",
                Paragraph(f"<font size='9' color='#10b981'><b>{fmt_idr(vendor_total)}</b></font>", style(alignment=TA_RIGHT))
            ])
            
            col_widths = [
                content_w * 0.05,
                content_w * 0.25,
                content_w * 0.20,
                content_w * 0.25,
                content_w * 0.25,
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
            ]
            
            for i in range(len(group_items)):
                bg_color = WHITE if i % 2 == 0 else GRAY_LIGHT
                t_styles.append(("BACKGROUND", (0, i + 1), (-1, i + 1), bg_color))
                
            # Subtotal style
            t_styles.extend([
                ("SPAN", (0, -1), (3, -1)),
                ("ALIGN", (0, -1), (0, -1), "RIGHT"),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#d1fae5")),
                ("BOX", (0, -1), (-1, -1), 1, ACCENT_GREEN),
            ])
            
            t.setStyle(TableStyle(t_styles))
            story.append(t)
            story.append(Spacer(1, 6 * mm))

        # Grand Total Table
        grand_total_data = [[
            Paragraph("<font size='10' color='#10b981'><b>GRAND TOTAL PEMBAYARAN JASA LOADING</b></font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='10' color='#10b981'><b>{fmt_idr(total_loading_fee)}</b></font>", style(alignment=TA_RIGHT))
        ]]
        
        gt = Table(grand_total_data, colWidths=[content_w * 0.75, content_w * 0.25])
        gt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#d1fae5")),
            ("BOX", (0, 0), (-1, -1), 1.5, ACCENT_GREEN),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(gt)

    story.append(Spacer(1, 8 * mm))

    # Signature
    payment_info = [
        Paragraph("<font size='9'><b>Informasi Pembayaran:</b></font>", style()),
        Spacer(1, 2 * mm),
        Paragraph("<font size='9' color='#4b5563'>Bank Mandiri</font>", style()),
        Paragraph("<font size='9' color='#4b5563'>No. Rekening: <b>1780001847504</b></font>", style()),
        Paragraph("<font size='9' color='#4b5563'>Atas Nama: <b>DEWI KUSUMA</b></font>", style()),
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

    def add_footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(GRAY_MID)
        canvas.setLineWidth(0.5)
        canvas.line(1.5*cm, 1.5*cm + 10, A4[0] - 1.5*cm, 1.5*cm + 10)
        
        generated_at = datetime.now()
        footer_text = f"Dicetak secara otomatis oleh System Kusuma pada {generated_at.strftime('%d %B %Y pukul %H:%M')} · Dokumen ini sah tanpa tanda tangan basah."
        
        canvas.setFont('Helvetica', 7)
        canvas.setFillColor(colors.HexColor('#9ca3af'))
        canvas.drawCentredString(A4[0] / 2.0, 1.5*cm, footer_text)
        canvas.restoreState()

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    return buf.getvalue()
