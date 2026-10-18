"""
Helper modul untuk konversi angka nominal Rupiah menjadi teks terbilang bahasa Indonesia.
Contoh: 15750000 -> "Lima Belas Juta Tujuh Ratus Lima Puluh Ribu Rupiah"
"""

_SATUAN = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima",
    "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
]


def _terbilang_int(n: int) -> str:
    n = int(abs(n))
    if n < 12:
        return _SATUAN[n]
    elif n < 20:
        return _terbilang_int(n - 10) + " Belas"
    elif n < 100:
        sisa = n % 10
        return _terbilang_int(n // 10) + " Puluh" + (" " + _terbilang_int(sisa) if sisa > 0 else "")
    elif n < 200:
        sisa = n - 100
        return "Seratus" + (" " + _terbilang_int(sisa) if sisa > 0 else "")
    elif n < 1000:
        sisa = n % 100
        return _terbilang_int(n // 100) + " Ratus" + (" " + _terbilang_int(sisa) if sisa > 0 else "")
    elif n < 2000:
        sisa = n - 1000
        return "Seribu" + (" " + _terbilang_int(sisa) if sisa > 0 else "")
    elif n < 1000000:
        sisa = n % 1000
        return _terbilang_int(n // 1000) + " Ribu" + (" " + _terbilang_int(sisa) if sisa > 0 else "")
    elif n < 1000000000:
        sisa = n % 1000000
        return _terbilang_int(n // 1000000) + " Juta" + (" " + _terbilang_int(sisa) if sisa > 0 else "")
    elif n < 1000000000000:
        sisa = n % 1000000000
        return _terbilang_int(n // 1000000000) + " Miliar" + (" " + _terbilang_int(sisa) if sisa > 0 else "")
    else:
        sisa = n % 1000000000000
        return _terbilang_int(n // 1000000000000) + " Triliun" + (" " + _terbilang_int(sisa) if sisa > 0 else "")


def angka_ke_terbilang(nominal: float | int | None) -> str:
    """
    Konversi angka desimal atau integer menjadi kalimat terbilang Rupiah lengkap.
    """
    if nominal is None or nominal == 0:
        return "Nol Rupiah"

    try:
        val = float(nominal)
    except (ValueError, TypeError):
        return "Nol Rupiah"

    if val == 0:
        return "Nol Rupiah"

    bulat = int(val)
    teks = _terbilang_int(bulat).strip()

    # Rapikan spasi ganda jika ada
    teks = " ".join(teks.split())
    return f"{teks} Rupiah"
