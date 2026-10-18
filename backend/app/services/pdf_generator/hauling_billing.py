from io import BytesIO
from datetime import datetime, date
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm, mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

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
)


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def generate_hauling_billing_pdf(billing_data: Any, vendor: Any = None, options: Optional[Dict[str, Any]] = None) -> bytes:
    """
    Generate professional landscape PDF report for Hauling Billing Rekapitulasi.
    Consistent with PT Kusuma Samudera Berkah corporate document style.
    """
    if options is None:
        options = {}

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )
    W, H = landscape(A4)
    content_w = W - 3 * cm

    style = get_base_styles()
    story = []

    # ── Metadata ─────────────────────────────────────────────────────────────
    bill_no = options.get("bill_no") or _get_val(billing_data, "bill_number") or "DRAFT-PREVIEW"
    bill_num_label = Paragraph(f"<font size='12' color='#1e3a8a'><b>NO: {bill_no}</b></font>", style(alignment=TA_RIGHT))

    print_date = fmt_date(date.today())
    date_label = Paragraph(f"<font size='9' color='#6b7280'>Tanggal Cetak: {print_date}</font>", style(alignment=TA_RIGHT))

    story.extend(create_header("REKAPITULASI BIAYA HAULING", [bill_num_label, date_label], content_w, title_size=18))

    vendor_name = (
        _get_val(vendor, "name")
        or _get_val(billing_data, "vendor_name")
        or "Vendor Hauling"
    )
    vendor_contact = _get_val(vendor, "contact_person", "")
    vendor_phone = _get_val(vendor, "phone", "")
    vendor_address = _get_val(vendor, "address", "")

    vendor_info_html = f"<font size='13'><b>{vendor_name}</b></font>"
    if vendor_contact or vendor_phone:
        cp_parts = [p for p in [vendor_contact, vendor_phone] if p]
        vendor_info_html += f"<br/><font size='9' color='#475569'>Kontak: {' - '.join(cp_parts)}</font>"
    if vendor_address:
        vendor_info_html += f"<br/><font size='8' color='#64748b'>{vendor_address}</font>"

    p_start = _get_val(billing_data, "period_start") or _get_val(billing_data, "start_date")
    p_end = _get_val(billing_data, "period_end") or _get_val(billing_data, "end_date")
    period_str = f"{fmt_date(p_start)} s/d {fmt_date(p_end)}"

    proj_name = _get_val(billing_data, "project_name") or "Semua Proyek"
    selected_nopols = options.get("selected_nopols") or []
    nopol_val = _get_val(billing_data, "nopol")
    if nopol_val:
        nopol_str = str(nopol_val)
    elif selected_nopols:
        nopol_str = ", ".join(selected_nopols)
    else:
        nopol_str = "Semua Armada"

    meas_type = _get_val(billing_data, "measurement_type", "tonase")
    unit_str = "m³" if meas_type == "kubikasi" else "Ton"

    info_data = [
        [
            Paragraph("<font size='9' color='#6b7280'>Vendor / Subkontraktor:</font>", style()),
            Paragraph("<font size='9' color='#6b7280'>Periode Operasional:</font>", style(alignment=TA_RIGHT)),
        ],
        [
            Paragraph(vendor_info_html, style()),
            Paragraph(f"<font size='10'><b>{period_str}</b></font><br/><font size='9' color='#475569'>Proyek: <b>{proj_name}</b></font><br/><font size='9' color='#475569'>Armada: {nopol_str}</font>", style(alignment=TA_RIGHT)),
        ],
    ]
    info_table = Table(info_data, colWidths=[content_w * 0.55, content_w * 0.45])
    info_table.setStyle(
        TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(info_table)
    story.append(Spacer(1, 6 * mm))

    # ── HALAMAN 1: TABEL REKAPITULASI (Summary per Tanggal) ───────────────────
    rekap_section = Paragraph("<font size='11' color='#1e3a8a'><b>I. REKAPITULASI TAGIHAN PER TANGGAL</b></font>", style(spaceAfter=4))
    story.append(rekap_section)

    rekap_head = [
        Paragraph("<font size='8' color='white'><b>No</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>Tanggal Operasional</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>Ritase</b></font>", style(alignment=TA_CENTER)),
        Paragraph(f"<font size='8' color='white'><b>Total Vol/Netto ({unit_str})</b></font>", style(alignment=TA_CENTER)),
        Paragraph(f"<font size='8' color='white'><b>Tarif (/{unit_str})</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>Total Biaya Kotor</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>Pot. Material</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>Net Tagihan</b></font>", style(alignment=TA_CENTER)),
    ]

    rekap_rows = [rekap_head]
    grouped_dates = _get_val(billing_data, "grouped_dates", []) or []

    for idx, g in enumerate(grouped_dates):
        g_date = fmt_date(_get_val(g, "date"))
        rit = _get_val(g, "ritase", 0)
        meas = float(_get_val(g, "measurement", 0))
        rates = _get_val(g, "rates", [])
        if rates:
            rate_str = " / ".join(fmt_idr(r) for r in rates)
        else:
            rate_str = "-"
        cost = float(_get_val(g, "hauling_cost", 0))
        ded = float(_get_val(g, "material_deduction", 0))
        net = float(_get_val(g, "net_cost", 0))

        rekap_rows.append([
            Paragraph(f"<font size='8'>{idx + 1}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{g_date}</font>", style(alignment=TA_LEFT)),
            Paragraph(f"<font size='8'>{rit} Rit</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{fmt_qty(meas)} {unit_str}</font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='8'>{rate_str}</font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='8'>{fmt_idr(cost)}</font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='8' color='#b45309'>{'(' + fmt_idr(ded) + ')' if ded > 0 else '-'}</font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='8'><b>{fmt_idr(net)}</b></font>", style(alignment=TA_RIGHT)),
        ])

    tot_rit = _get_val(billing_data, "total_ritase", 0)
    tot_meas = float(_get_val(billing_data, "total_measurement", 0))
    tot_cost = float(_get_val(billing_data, "total_hauling_cost", 0))
    tot_ded = float(_get_val(billing_data, "total_material_deduction", 0))
    tot_net = float(_get_val(billing_data, "total_net", 0))

    rekap_rows.append([
        Paragraph("<font size='8'><b>TOTAL KESELURUHAN:</b></font>", style(alignment=TA_RIGHT)),
        "",
        Paragraph(f"<font size='8'><b>{tot_rit} Rit</b></font>", style(alignment=TA_CENTER)),
        Paragraph(f"<font size='8'><b>{fmt_qty(tot_meas)} {unit_str}</b></font>", style(alignment=TA_RIGHT)),
        "",
        Paragraph(f"<font size='8'><b>{fmt_idr(tot_cost)}</b></font>", style(alignment=TA_RIGHT)),
        Paragraph(f"<font size='8' color='#b45309'><b>{'(' + fmt_idr(tot_ded) + ')' if tot_ded > 0 else '-'}</b></font>", style(alignment=TA_RIGHT)),
        Paragraph(f"<font size='9' color='#0f766e'><b>{fmt_idr(tot_net)}</b></font>", style(alignment=TA_RIGHT)),
    ])

    rekap_col_widths = [
        content_w * 0.04,  # No
        content_w * 0.16,  # Tanggal
        content_w * 0.09,  # Ritase
        content_w * 0.16,  # Measurement
        content_w * 0.15,  # Tarif
        content_w * 0.14,  # Biaya Kotor
        content_w * 0.12,  # Pot. Material
        content_w * 0.14,  # Net Tagihan
    ]

    t_rekap = Table(rekap_rows, colWidths=rekap_col_widths, repeatRows=1)
    rekap_style = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, colors.HexColor("#f8fafc")]),
        ("SPAN", (0, -1), (1, -1)),  # Total label span col 0 and 1
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f1f5f9")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    t_rekap.setStyle(TableStyle(rekap_style))
    story.append(t_rekap)
    story.append(Spacer(1, 6 * mm))

    notes = options.get("notes") or _get_val(billing_data, "notes")
    if notes:
        story.append(Paragraph(f"<font size='8' color='#475569'><b>Catatan:</b> {notes}</font>", style(spaceAfter=6)))

    # Signatures on Page 1
    sig_col_w = content_w / 3
    sig_data = [
        [
            Paragraph("<font size='9'>Dibuat Oleh,</font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9'>Disetujui Oleh,</font>", style(alignment=TA_CENTER)),
            Paragraph("<font size='9'>Mengetahui,</font>", style(alignment=TA_CENTER)),
        ],
        [
            Spacer(1, 16 * mm),
            Spacer(1, 16 * mm),
            Spacer(1, 16 * mm),
        ],
        [
            Paragraph(f"<font size='9'><b>( Bag. Operasional Hauling )</b></font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='9'><b>( {vendor_name} )</b></font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='9'><b>( Finance & Accounting )</b></font>", style(alignment=TA_CENTER)),
        ]
    ]
    t_sig = Table(sig_data, colWidths=[sig_col_w, sig_col_w, sig_col_w])
    t_sig.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(Spacer(1, 4 * mm))
    story.append(t_sig)

    # ── HALAMAN 2+: LAMPIRAN RINCIAN DETAIL SURAT JALAN ───────────────────────
    story.append(PageBreak())

    annex_head_label = Paragraph(f"<font size='9' color='#6b7280'>Lampiran Detail Tagihan No: {bill_no}</font>", style(alignment=TA_RIGHT))
    story.extend(create_header("LAMPIRAN RINCIAN SURAT JALAN HAULING", [annex_head_label], content_w, title_size=16))

    detail_head = [
        Paragraph("<font size='8' color='white'><b>No</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>Tanggal</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>No. Polisi</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>Supir</b></font>", style(alignment=TA_CENTER)),
        Paragraph(f"<font size='8' color='white'><b>Vol/Netto ({unit_str})</b></font>", style(alignment=TA_CENTER)),
        Paragraph(f"<font size='8' color='white'><b>Tarif (/{unit_str})</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>Biaya Kotor</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>Pot. Material</b></font>", style(alignment=TA_CENTER)),
        Paragraph("<font size='8' color='white'><b>Net Tagihan</b></font>", style(alignment=TA_CENTER)),
    ]

    detail_col_widths = [
        content_w * 0.04,  # No
        content_w * 0.12,  # Tanggal
        content_w * 0.12,  # No Polisi
        content_w * 0.14,  # Supir
        content_w * 0.13,  # Measurement
        content_w * 0.13,  # Tarif
        content_w * 0.11,  # Biaya Kotor
        content_w * 0.10,  # Pot. Material
        content_w * 0.11,  # Net Tagihan
    ]

    detail_rows = [detail_head]
    global_no = 1
    date_header_indices = []
    subtotal_indices = []

    for g in grouped_dates:
        g_date_str = fmt_date(_get_val(g, "date"))
        g_rit = _get_val(g, "ritase", 0)

        # Date header separator row
        header_idx = len(detail_rows)
        date_header_indices.append(header_idx)
        detail_rows.append([
            Paragraph(f"<font size='8' color='#0f172a'><b>Tanggal Operasional: {g_date_str} ({g_rit} Ritase)</b></font>", style(alignment=TA_LEFT)),
            "", "", "", "", "", "", "", ""
        ])

        rows_in_group = _get_val(g, "rows", []) or []
        for r in rows_in_group:
            sj_d = fmt_date(_get_val(r, "sj_date"))
            nopol = _get_val(r, "nopol") or "-"
            supir = _get_val(r, "supir") or "-"
            meas = float(_get_val(r, "measurement", 0))
            price = float(_get_val(r, "hauling_price", 0))
            cost = float(_get_val(r, "hauling_cost", 0))
            ded = float(_get_val(r, "material_deduction", 0))
            net = float(_get_val(r, "net_cost", 0))

            detail_rows.append([
                Paragraph(f"<font size='7.5'>{global_no}</font>", style(alignment=TA_CENTER)),
                Paragraph(f"<font size='7.5'>{sj_d}</font>", style(alignment=TA_LEFT)),
                Paragraph(f"<font size='7.5'><b>{nopol}</b></font>", style(alignment=TA_CENTER)),
                Paragraph(f"<font size='7.5'>{supir}</font>", style(alignment=TA_LEFT)),
                Paragraph(f"<font size='7.5'>{fmt_qty(meas)}</font>", style(alignment=TA_RIGHT)),
                Paragraph(f"<font size='7.5'>{fmt_idr(price)}</font>", style(alignment=TA_RIGHT)),
                Paragraph(f"<font size='7.5'>{fmt_idr(cost)}</font>", style(alignment=TA_RIGHT)),
                Paragraph(f"<font size='7.5' color='#b45309'>{'(' + fmt_idr(ded) + ')' if ded > 0 else '-'}</font>", style(alignment=TA_RIGHT)),
                Paragraph(f"<font size='7.5'><b>{fmt_idr(net)}</b></font>", style(alignment=TA_RIGHT)),
            ])
            global_no += 1

        # Subtotal row for date group
        sub_idx = len(detail_rows)
        subtotal_indices.append(sub_idx)
        g_meas = float(_get_val(g, "measurement", 0))
        g_cost = float(_get_val(g, "hauling_cost", 0))
        g_ded = float(_get_val(g, "material_deduction", 0))
        g_net = float(_get_val(g, "net_cost", 0))

        detail_rows.append([
            Paragraph(f"<font size='7.5'><b>Subtotal {g_date_str}:</b></font>", style(alignment=TA_RIGHT)),
            "", "", "",
            Paragraph(f"<font size='7.5'><b>{fmt_qty(g_meas)} {unit_str}</b></font>", style(alignment=TA_RIGHT)),
            "",
            Paragraph(f"<font size='7.5'><b>{fmt_idr(g_cost)}</b></font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='7.5' color='#b45309'><b>{'(' + fmt_idr(g_ded) + ')' if g_ded > 0 else '-'}</b></font>", style(alignment=TA_RIGHT)),
            Paragraph(f"<font size='7.5' color='#0f766e'><b>{fmt_idr(g_net)}</b></font>", style(alignment=TA_RIGHT)),
        ])

    # Grand total row at bottom
    grand_idx = len(detail_rows)
    detail_rows.append([
        Paragraph("<font size='8'><b>GRAND TOTAL RINCIAN:</b></font>", style(alignment=TA_RIGHT)),
        "", "", "",
        Paragraph(f"<font size='8'><b>{fmt_qty(tot_meas)} {unit_str}</b></font>", style(alignment=TA_RIGHT)),
        "",
        Paragraph(f"<font size='8'><b>{fmt_idr(tot_cost)}</b></font>", style(alignment=TA_RIGHT)),
        Paragraph(f"<font size='8' color='#b45309'><b>{'(' + fmt_idr(tot_ded) + ')' if tot_ded > 0 else '-'}</b></font>", style(alignment=TA_RIGHT)),
        Paragraph(f"<font size='8.5' color='#0f766e'><b>{fmt_idr(tot_net)}</b></font>", style(alignment=TA_RIGHT)),
    ])

    t_detail = Table(detail_rows, colWidths=detail_col_widths, repeatRows=1)
    detail_style = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("SPAN", (0, grand_idx), (3, grand_idx)),
        ("BACKGROUND", (0, grand_idx), (-1, grand_idx), colors.HexColor("#f1f5f9")),
    ]

    for d_idx in date_header_indices:
        detail_style.extend([
            ("SPAN", (0, d_idx), (-1, d_idx)),
            ("BACKGROUND", (0, d_idx), (-1, d_idx), colors.HexColor("#f8fafc")),
            ("TOPPADDING", (0, d_idx), (-1, d_idx), 4),
            ("BOTTOMPADDING", (0, d_idx), (-1, d_idx), 4),
        ])

    for s_idx in subtotal_indices:
        detail_style.extend([
            ("SPAN", (0, s_idx), (3, s_idx)),
            ("BACKGROUND", (0, s_idx), (-1, s_idx), colors.HexColor("#f1f5f9")),
        ])

    t_detail.setStyle(TableStyle(detail_style))
    story.append(t_detail)

    doc.build(story)
    return buf.getvalue()
