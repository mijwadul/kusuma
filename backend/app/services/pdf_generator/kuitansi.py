from io import BytesIO
from datetime import datetime, date
from typing import Any, Dict, Optional

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

from ...utils.terbilang import angka_ke_terbilang
from .base import (
    ACCENT_GREEN,
    BRAND_BLUE,
    BRAND_LIGHT,
    GRAY_DARK,
    GRAY_LIGHT,
    GRAY_MID,
    WHITE,
    create_header,
    fmt_date,
    fmt_idr,
    get_base_styles,
)


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def build_kuitansi_story(invoice_or_data: Any, options: Optional[Dict[str, Any]] = None, content_w: float = 18 * cm) -> list:
    """
    Builds the ReportLab Flowable elements for an official Kuitansi.
    Can be used standalone or appended into a multi-page Invoice Bundle.
    """
    if options is None:
        options = {}

    style = get_base_styles()
    story = []

    # ── Identifikasi Data ─────────────────────────────────────────────────────
    inv_num = _get_val(invoice_or_data, "invoice_number", "-")
    kwt_no = (
        options.get("kuitansi_no")
        or (f"KWT-{inv_num}" if inv_num and inv_num != "-" else f"KWT-{date.today().strftime('%Y%m%d')}-01")
    )

    cust_name = (
        options.get("customer_name")
        or _get_val(invoice_or_data, "customer_name")
        or "Customer"
    )

    amount = float(
        options.get("amount")
        if options.get("amount") is not None
        else (
            _get_val(invoice_or_data, "final_amount")
            if _get_val(invoice_or_data, "final_amount") is not None
            else _get_val(invoice_or_data, "total_amount", 0)
        )
    )

    raw_date = (
        options.get("payment_date")
        or _get_val(invoice_or_data, "invoice_date")
        or _get_val(invoice_or_data, "income_date")
        or date.today()
    )
    payment_date_str = fmt_date(raw_date)

    inv_status = str(_get_val(invoice_or_data, "status", "unpaid")).lower()
    is_paid = inv_status == "paid" or options.get("is_paid", False)

    # Deskripsi pembayaran dinamis (apakah pelunasan atau tagihan resmi)
    default_desc = (
        f"Pelunasan Invoice No. {inv_num}"
        if is_paid and inv_num != "-"
        else (
            f"Pembayaran Invoice No. {inv_num}"
            if inv_num != "-"
            else "Pembayaran Transaksi Material & Operasional"
        )
    )
    notes_val = _get_val(invoice_or_data, "notes", "")
    if notes_val:
        default_desc += f" ({notes_val})"

    description = options.get("description") or default_desc

    # Info Bank / Metode Pembayaran
    bank = _get_val(invoice_or_data, "bank_account", None)
    bank_name = options.get("bank_name") or (_get_val(bank, "bank_name") if bank else "")
    account_no = options.get("account_number") or (_get_val(bank, "account_number") if bank else "")
    payment_method = options.get("payment_method") or _get_val(invoice_or_data, "payment_method", "Transfer Bank")

    payment_method_display = payment_method.capitalize()
    if bank_name:
        payment_method_display += f" - {bank_name}"
        if account_no:
            payment_method_display += f" (Rek: {account_no})"

    signatory = options.get("signatory_name") or "Bagian Keuangan"
    city = options.get("city") or "Lamongan"

    # Bea meterai wajib untuk transaksi >= 5 juta sesuai regulasi
    needs_materai = amount >= 5000000 if options.get("include_materai") is None else bool(options.get("include_materai"))

    # ── Header Kuitansi ───────────────────────────────────────────────────────
    kwt_num_label = Paragraph(f"<font size='12' color='#1e3a8a'><b>NO: {kwt_no}</b></font>", style(alignment=TA_RIGHT))
    date_label = Paragraph(f"<font size='9' color='#6b7280'>Tanggal: {payment_date_str}</font>", style(alignment=TA_RIGHT))

    doc_title = "KUITANSI PEMBAYARAN" if is_paid else "KUITANSI PENAGIHAN"
    story.extend(create_header(doc_title, [kwt_num_label, date_label], content_w, title_size=18))

    # ── Badan Kuitansi (Telah Diterima Dari, Terbilang, Keperluan) ─────────────
    terbilang_text = angka_ke_terbilang(amount)

    terbilang_cell = Table(
        [[Paragraph(f"<font size='9.5' color='#0f172a'><b><i>## {terbilang_text} ##</i></b></font>", style())]],
        colWidths=[content_w - 4.8 * cm],
    )
    terbilang_cell.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    body_rows = [
        [
            Paragraph("<font size='9.5'><b>Telah Diterima Dari</b></font>", style()),
            Paragraph("<font size='9.5'><b>:</b></font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='11' color='#0f172a'><b>{cust_name}</b></font>", style()),
        ],
        [
            Paragraph("<font size='9.5'><b>Uang Sejumlah</b></font>", style()),
            Paragraph("<font size='9.5'><b>:</b></font>", style(alignment=TA_CENTER)),
            terbilang_cell,
        ],
        [
            Paragraph("<font size='9.5'><b>Untuk Pembayaran</b></font>", style()),
            Paragraph("<font size='9.5'><b>:</b></font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='9.5' color='#334155'>{description}</font>", style()),
        ],
        [
            Paragraph("<font size='9.5'><b>Metode Transaksi</b></font>", style()),
            Paragraph("<font size='9.5'><b>:</b></font>", style(alignment=TA_CENTER)),
            Paragraph(f"<font size='9' color='#475569'>{payment_method_display}</font>", style()),
        ],
    ]

    t_body = Table(body_rows, colWidths=[4.2 * cm, 0.5 * cm, content_w - 4.7 * cm])
    t_body.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("LINEBELOW", (2, 0), (2, 0), 0.5, colors.HexColor("#e2e8f0")),
        ("LINEBELOW", (2, 2), (2, 2), 0.5, colors.HexColor("#e2e8f0")),
        ("LINEBELOW", (2, 3), (2, 3), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    story.append(t_body)
    story.append(Spacer(1, 10 * mm))

    # ── Kotak Jumlah Nominal & Area Pengesahan / Meterai ───────────────────────
    nominal_content = [
        Paragraph(
            f"<font size='15' color='#1e3a8a'><b>JUMLAH : {fmt_idr(amount)},-</b></font>",
            style(alignment=TA_CENTER),
        )
    ]
    nominal_box = Table([nominal_content], colWidths=[8.5 * cm], rowHeights=[1.4 * cm])
    nominal_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
        ("BOX", (0, 0), (-1, -1), 1.5, BRAND_BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))

    # Area Materai (jika berlaku)
    materai_cell = Paragraph("", style())
    if needs_materai:
        m_table = Table(
            [[Paragraph("<font size='7' color='#94a3b8'>METERAI TEMPEL<br/>Rp 10.000,-</font>", style(alignment=TA_CENTER))]],
            colWidths=[2.6 * cm],
            rowHeights=[1.6 * cm],
        )
        m_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1"), None, (2, 2)), # garis putus-putus
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        materai_cell = m_table

    sig_place_date = Paragraph(
        f"<font size='9' color='#334155'>{city}, {payment_date_str}</font>",
        style(alignment=TA_CENTER),
    )
    sig_title = Paragraph(
        "<font size='9'><b>PT. Kusuma Samudera Berkah</b><br/><font size='8' color='#64748b'>Penerima / Keuangan,</font></font>",
        style(alignment=TA_CENTER),
    )
    sig_space = Spacer(1, 14 * mm)
    sig_name = Paragraph(
        f"<font size='9.5'><b>( {signatory} )</b></font>",
        style(alignment=TA_CENTER),
    )

    sig_column = [sig_place_date, Spacer(1, 1.5 * mm), sig_title, sig_space, sig_name]

    # Gabungkan kotak nominal di kiri dengan kotak meterai + tanda tangan di kanan
    bottom_table_data = [
        [nominal_box, materai_cell, sig_column]
    ]
    t_bottom = Table(bottom_table_data, colWidths=[content_w * 0.48, content_w * 0.18, content_w * 0.34])
    t_bottom.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(t_bottom)
    story.append(Spacer(1, 8 * mm))

    # Catatan kaki legal
    legal_note = (
        "<font size='7.5' color='#94a3b8'><i>* Kuitansi ini merupakan bukti pembayaran/penagihan resmi PT. Kusuma Samudera Berkah. "
        "Pembayaran melalui transfer dianggap sah setelah dana efektif masuk ke rekening perusahaan.</i></font>"
    )
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(legal_note, style()))

    return story


def generate_kuitansi_pdf(invoice_or_data: Any, options: Optional[Dict[str, Any]] = None) -> bytes:
    """
    Generate Standalone Single-Page Kuitansi PDF (A4 Portrait).
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )
    W, H = A4
    content_w = W - 3 * cm

    story = build_kuitansi_story(invoice_or_data, options, content_w=content_w)
    doc.build(story)
    return buf.getvalue()
