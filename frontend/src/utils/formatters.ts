export const toLocalDateInput = (value?: string | Date | null) => {
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value.includes("T")) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
  }
  const date = value ? new Date(value) : new Date();
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toLocalDateTimeInputString = (value?: string | Date | null) => {
  const date = value ? new Date(value) : new Date();
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const toLocalDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

export const formatIDR = (v?: number | string | null) =>
  Number(v ?? 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  });

export const formatDate = (d?: string | Date | null) => {
  if (!d) return "-";
  const str = String(d);
  const parts = str.split('T')[0].split('-');
  if (parts.length < 3) return str;
  const [y, m, dayVal] = parts;
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const mIndex = parseInt(m, 10) - 1;
  return `${dayVal} ${months[mIndex] || m} ${y}`;
};

export const truncToTwo = (val: number): number => {
  return Math.trunc(val * 100) / 100;
};

export const formatNopol = (value: string) => {
  if (!value) return '';
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const match = cleaned.match(/^([A-Z]{1,2})(\d{1,4})?([A-Z]{0,3})?/);
  
  if (match) {
    let res = match[1] || '';
    if (match[2]) res += ' ' + match[2];
    if (match[3]) res += ' ' + match[3];
    return res;
  }
  return value.toUpperCase();
};

export const formatTitleCase = (value: string) => {
  if (!value) return '';
  return value
    .split(' ')
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
    .join(' ');
};
