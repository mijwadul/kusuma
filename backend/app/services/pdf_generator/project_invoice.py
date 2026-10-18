import re
from collections import defaultdict
from datetime import date, datetime
from io import BytesIO
from itertools import groupby
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
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


def generate_project_invoice_pdf(invoice, include_kuitansi: bool = False, kuitansi_options: Optional[dict] = None) -> bytes:
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

    story.extend(create_header("INVOICE PROYEK", [invoice_num_label, date_label], content_w, title_size=20))

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

    items = getattr(invoice, "items", [])
    
    is_ritase = False
    if project and getattr(project, "measurement_type", "") == "ritase":
        is_ritase = True
    elif any(getattr(item, "unit", "").lower() in ["ritase", "rit"] for item in items):
        is_ritase = True

    discount_type = getattr(invoice, "discount_type", None)
    discount_val = getattr(invoice, "discount_value", 0) or 0
    total_amount = getattr(invoice, "total_amount", 0) or 0

    if is_ritase:
        summary_raw = defaultdict(lambda: {'date_str': '', 'raw_date': None, 'truck_type': '', 'ritase': 0, 'unit_price': 0.0, 'amount': 0.0})
        for item in items:
            raw_date = getattr(item, "income_date", None)
            if not raw_date: continue
            ttype = getattr(item, "truck_type", "") or getattr(item, "vehicle_type", "") or ""
            price = getattr(item, "unit_price", 0) or 0
            amount = getattr(item, "amount", 0) or 0

            key = (raw_date, ttype)
            summary_raw[key]['raw_date'] = raw_date
            summary_raw[key]['date_str'] = fmt_date(raw_date)
            summary_raw[key]['truck_type'] = ttype
            summary_raw[key]['ritase'] += 1
            summary_raw[key]['unit_price'] = price
            summary_raw[key]['amount'] += amount

        sorted_keys = sorted(list(summary_raw.keys()), key=lambda k: (k[0], 0 if k[1] == 'colt_diesel' else (1 if k[1] == 'tronton' else 2)))

        table_data = [[
            Paragraph("<font size='9' color='white'><b>No</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Tanggal</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Jenis Kendaraan</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Jumlah Ritase</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Harga Satuan</b></font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9' color='white'><b>Subtotal</b></font>", style(alignment=TA_CENTER)),
        ]]

        total_ritase = 0
        subtotal = 0.0
        for i, key in enumerate(sorted_keys):
            d = summary_raw[key]
            subtotal += d['amount']
            total_ritase += d['ritase']
            tt_label = "Colt Diesel" if d['truck_type'] == 'colt_diesel' else ("Tronton" if d['truck_type'] == 'tronton' else (d['truck_type'] or '-'))
            table_data.append([
                Paragraph(f"<font size='8'>{i+1}</font>", style(alignment=TA_CENTER)),
                Paragraph(f"<font size='8'>{d['date_str']}</font>", style(alignment=TA_CENTER)),
                Paragraph(f"<font size='8'>{tt_label}</font>", style(alignment=TA_CENTER)),
                Paragraph(f"<font size='8'>{d['ritase']} Rit</font>", style(alignment=TA_CENTER)),
                Paragraph(f"<font size='8'>{fmt_idr(d['unit_price'])}</font>", style(alignment=TA_RIGHT)),
                Paragraph(f"<font size='8'><b>{fmt_idr(d['amount'])}</b></font>", style(alignment=TA_RIGHT)),
            ])

        table_data.append([
            Paragraph("<font size='9'><b>Total Keseluruhan</b></font>", style(alignment=TA_RIGHT)),
            "", "",
            Paragraph(f"<font size='9'><b>{total_ritase} Rit</b></font>", style(alignment=TA_CENTER)),
            "",
            Paragraph(f"<font size='9'><b>{fmt_idr(subtotal)}</b></font>", style(alignment=TA_RIGHT))
        ])

        table_data.append([
            Paragraph("<font size='9'><b>Subtotal</b></font>", style(alignment=TA_RIGHT)),
            "", "", "", "",
            Paragraph(f"<font size='9'><b>{fmt_idr(subtotal)}</b></font>", style(alignment=TA_RIGHT))
        ])

        extra_rows = 1
        if discount_type and discount_val:
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
            content_w * 0.06,
            content_w * 0.20,
            content_w * 0.20,
            content_w * 0.16,
            content_w * 0.19,
            content_w * 0.19,
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
            
        total_row_idx = len(sorted_keys) + 1
        t_styles.extend([
            ("SPAN", (0, total_row_idx), (2, total_row_idx)),
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
    else:
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
    
    sig_wrapper = Table([[payment_info, sig_table]], colWidths=[content_w - 5*cm, 5*cm])
    sig_wrapper.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sig_wrapper)
    story.append(Spacer(1, 4 * mm))

    if include_kuitansi:
        from .kuitansi import build_kuitansi_story
        story.append(PageBreak())
        story.extend(build_kuitansi_story(invoice, options=kuitansi_options, content_w=content_w))

    if len(items) > 0:
        story.append(PageBreak())
        
        first_item = items[0]
        unit = getattr(first_item, "unit", "") or ""
        is_tonase = unit.lower() == "ton"
        
        story.append(Paragraph("<font size='14'><b>LAMPIRAN DETAIL SURAT JALAN</b></font>", style(alignment=TA_CENTER)))
        story.append(Spacer(1, 5 * mm))
        
        sorted_items = sorted(items, key=lambda x: (getattr(x, "income_date", None) or date.min, getattr(x, "license_plate", "") or ""))

        if is_ritase:
            detail_headers = ["No", "Nopol", "Supir", "Jenis Kendaraan", "Ritase"]
            col_w = [content_w * 0.08, content_w * 0.24, content_w * 0.28, content_w * 0.25, content_w * 0.15]
        elif is_tonase:
            detail_headers = ["No", "Nopol", "Supir", "Bruto", "Tarra", "Potongan", "Netto (Ton)"]
            col_w = [content_w * 0.05, content_w * 0.15, content_w * 0.20, content_w * 0.15, content_w * 0.15, content_w * 0.15, content_w * 0.15]
        else:
            detail_headers = ["No", "Nopol", "Supir", "P", "L", "T", "Min.T", "Vol (m3)"]
            col_w = [content_w * 0.05, content_w * 0.15, content_w * 0.18, content_w * 0.10, content_w * 0.10, content_w * 0.10, content_w * 0.12, content_w * 0.20]

        for inc_date, group in groupby(sorted_items, key=lambda x: getattr(x, "income_date", None) or date.min):
            group_items = list(group)
            dt_str_sub = fmt_date(inc_date)
            story.append(Paragraph(f"<font size='10' color='#1f2937'><b>Tanggal: {dt_str_sub}</b></font>", style()))
            story.append(Spacer(1, 2 * mm))

            if is_ritase:
                sorted_by_vtype = sorted(group_items, key=lambda x: (
                    0 if (getattr(x, "truck_type", "") or getattr(x, "vehicle_type", "")) == "colt_diesel" else (
                        1 if (getattr(x, "truck_type", "") or getattr(x, "vehicle_type", "")) == "tronton" else 2
                    ),
                    getattr(x, "license_plate", "") or ""
                ))
                date_total_ritase = 0

                for t_type, sub_group in groupby(sorted_by_vtype, key=lambda x: getattr(x, "truck_type", "") or getattr(x, "vehicle_type", "") or ""):
                    sub_items = list(sub_group)
                    tt_name = "Colt Diesel" if t_type == "colt_diesel" else ("Tronton" if t_type == "tronton" else (t_type or "Lainnya"))
                    story.append(Paragraph(f"<font size='9' color='#374151'><b>Kategori Armada: {tt_name}</b></font>", style()))
                    story.append(Spacer(1, 1.5 * mm))

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
                    sub_ritase = 0
                    for s_idx, item in enumerate(sub_items):
                        nopol = getattr(item, "license_plate", "-") or "-"
                        supir = getattr(item, "driver_name", "-") or "-"
                        detail_data.append([
                            Paragraph(f"<font size='8'>{s_idx + 1}</font>", style(alignment=TA_CENTER)),
                            Paragraph(f"<font size='8'>{nopol}</font>", style(alignment=TA_CENTER)),
                            Paragraph(f"<font size='8'>{supir}</font>", style(alignment=TA_LEFT)),
                            Paragraph(f"<font size='8'>{tt_name}</font>", style(alignment=TA_CENTER)),
                            Paragraph(f"<font size='8'>1 Rit</font>", style(alignment=TA_CENTER)),
                        ])
                        bg_color = WHITE if (s_idx + 1) % 2 != 0 else GRAY_LIGHT
                        dt_styles.append(("BACKGROUND", (0, s_idx + 1), (-1, s_idx + 1), bg_color))
                        sub_ritase += 1

                    date_total_ritase += sub_ritase
                    sub_tot_idx = len(detail_data)
                    detail_data.append([
                        Paragraph(f"<font size='8'><b>Subtotal {tt_name}</b></font>", style(alignment=TA_RIGHT)),
                        "", "", "",
                        Paragraph(f"<font size='8'><b>{sub_ritase} Rit</b></font>", style(alignment=TA_CENTER)),
                    ])
                    dt_styles.extend([
                        ("SPAN", (0, sub_tot_idx), (3, sub_tot_idx)),
                        ("BACKGROUND", (0, sub_tot_idx), (-1, sub_tot_idx), colors.HexColor("#f3f4f6")),
                    ])

                    dt_table = Table(detail_data, colWidths=col_w, repeatRows=1)
                    dt_table.setStyle(TableStyle(dt_styles))
                    story.append(dt_table)
                    story.append(Spacer(1, 3 * mm))

                story.append(Paragraph(f"<font size='9' color='#059669'><b>Total Ritase Tanggal {dt_str_sub}: {date_total_ritase} Rit</b></font>", style(alignment=TA_RIGHT)))
                story.append(Spacer(1, 6 * mm))
            else:
                date_ritase = 0
                date_qty = 0.0
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
                for s_idx, item in enumerate(group_items):
                    nopol = getattr(item, "license_plate", "-") or "-"
                    supir = getattr(item, "driver_name", "-") or "-"
                    row = [
                        Paragraph(f"<font size='8'>{item_counter}</font>", style(alignment=TA_CENTER)),
                        Paragraph(f"<font size='8'>{nopol}</font>", style(alignment=TA_CENTER)),
                        Paragraph(f"<font size='8'>{supir}</font>", style(alignment=TA_LEFT)),
                    ]
                    
                    if is_tonase:
                        bruto = getattr(item, "sj_bruto", None)
                        if bruto is None: bruto = getattr(item, "sj_gross_weight", None)
                        if bruto is None: bruto = getattr(item, "bruto", None)

                        tarra = getattr(item, "sj_tarra", None)
                        if tarra is None: tarra = getattr(item, "sj_tare_weight", None)
                        if tarra is None: tarra = getattr(item, "tarra", None)

                        pot = getattr(item, "sj_potongan", None)
                        if pot is None: pot = getattr(item, "sj_weight_minus", None)
                        if pot is None: pot = getattr(item, "minus_berat", None)

                        netto = getattr(item, "sj_netto", None)
                        if netto is None: netto = getattr(item, "sj_net_weight", None)
                        if netto is None: netto = getattr(item, "netto", None)
                        if netto is None or netto == 0: netto = getattr(item, "quantity", 0) or 0

                        # Fallback parsing description if bruto or tarra are empty
                        if (not bruto or bruto == 0) and getattr(item, "description", None):
                            match_desc = re.search(r"B1:([0-9.]+)\s+B2:([0-9.]+)\s+M:([0-9.]+)", str(item.description))
                            if match_desc:
                                try:
                                    bruto = float(match_desc.group(1))
                                    tarra = float(match_desc.group(2))
                                    pot = float(match_desc.group(3))
                                except (ValueError, TypeError):
                                    pass

                        def _fmt_w(val):
                            if val is None or val == "":
                                return "0"
                            try:
                                v = float(val)
                                if v == 0:
                                    return "0"
                                if v.is_integer():
                                    return fmt_qty(v, 0)
                                return fmt_qty(v, 2)
                            except (ValueError, TypeError):
                                return "0"

                        row.extend([
                            Paragraph(f"<font size='8'>{_fmt_w(bruto)}</font>", style(alignment=TA_CENTER)),
                            Paragraph(f"<font size='8'>{_fmt_w(tarra)}</font>", style(alignment=TA_CENTER)),
                            Paragraph(f"<font size='8'>{_fmt_w(pot)}</font>", style(alignment=TA_CENTER)),
                            Paragraph(f"<font size='8'><b>{fmt_qty(netto, 3)}</b></font>", style(alignment=TA_CENTER)),
                        ])
                        date_qty += float(netto or 0)
                    else:
                        p = getattr(item, "sj_panjang", None)
                        if p is None: p = getattr(item, "sj_length", None)
                        if p is None: p = getattr(item, "panjang", None)

                        l = getattr(item, "sj_lebar", None)
                        if l is None: l = getattr(item, "sj_width", None)
                        if l is None: l = getattr(item, "lebar", None)

                        t_val = getattr(item, "sj_tinggi", None)
                        if t_val is None: t_val = getattr(item, "sj_height", None)
                        if t_val is None: t_val = getattr(item, "tinggi", None)

                        m = getattr(item, "sj_volume_minus", None)
                        if m is None: m = getattr(item, "minus_tinggi", None)

                        vol = getattr(item, "sj_volume", None)
                        if vol is None: vol = getattr(item, "volume", None)
                        if vol is None or vol == 0: vol = getattr(item, "quantity", 0) or 0

                        # Fallback parsing description if dimensions are empty
                        if (not p or p == 0) and getattr(item, "description", None):
                            match_desc = re.search(r"P:([0-9.]+)\s+L:([0-9.]+)\s+T:([0-9.]+)\s+M:([0-9.]+)", str(item.description))
                            if match_desc:
                                try:
                                    p = float(match_desc.group(1))
                                    l = float(match_desc.group(2))
                                    t_val = float(match_desc.group(3))
                                    m = float(match_desc.group(4))
                                except (ValueError, TypeError):
                                    pass

                        def _fmt_dim(val):
                            if val is None or val == "":
                                return "0"
                            try:
                                v = float(val)
                                if v == 0:
                                    return "0"
                                if v.is_integer():
                                    return fmt_qty(v, 0)
                                return fmt_qty(v, 2)
                            except (ValueError, TypeError):
                                return "0"

                        row.extend([
                            Paragraph(f"<font size='8'>{_fmt_dim(p)}</font>", style(alignment=TA_CENTER)),
                            Paragraph(f"<font size='8'>{_fmt_dim(l)}</font>", style(alignment=TA_CENTER)),
                            Paragraph(f"<font size='8'>{_fmt_dim(t_val)}</font>", style(alignment=TA_CENTER)),
                            Paragraph(f"<font size='8'>{_fmt_dim(m)}</font>", style(alignment=TA_CENTER)),
                            Paragraph(f"<font size='8'><b>{fmt_qty(vol, 3)}</b></font>", style(alignment=TA_CENTER)),
                        ])
                        date_qty += float(vol or 0)
                    
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
                        ("SPAN", (3, row_idx), (5, row_idx)),
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
