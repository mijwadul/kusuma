export const MATERIAL_TYPES = ['Limestone (urugan)', 'Dolomite', 'Boulder', 'Clay'];
export const VEHICLE_TYPES = ['Colt Diesel', 'Tronton'];
export const UNITS = ['ritase', 'm3', 'ton'];

export default function MaterialBadge({ type }: { type?: string }) {
  let bg = 'bg-emerald-50';
  let text = 'text-emerald-700';
  let dot = 'bg-emerald-400';
  if (type === 'Limestone (urugan)') {
    bg = 'bg-amber-50';
    text = 'text-amber-700';
    dot = 'bg-amber-400';
  }
  if (type === 'Dolomite') {
    bg = 'bg-blue-50';
    text = 'text-blue-700';
    dot = 'bg-blue-400';
  }
  if (type === 'Boulder') {
    bg = 'bg-stone-50';
    text = 'text-stone-700';
    dot = 'bg-stone-400';
  }
  if (type === 'Clay') {
    bg = 'bg-orange-50';
    text = 'text-orange-700';
    dot = 'bg-orange-400';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {type || 'Unknown'}
    </span>
  );
}
