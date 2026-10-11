import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  badgeLimit?: number;
}

export default function MultiSelect({
  values,
  onChange,
  options,
  placeholder = '-- Semua Nopol --',
  searchPlaceholder = 'Cari nopol / supir...',
  disabled = false,
  className = '',
  badgeLimit = 2,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const toggleOption = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const handleSelectAll = () => {
    const allAvailable = filteredOptions.filter((o) => !o.disabled).map((o) => o.value);
    const newValues = Array.from(new Set([...values, ...allAvailable]));
    onChange(newValues);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange([]);
  };

  const selectedCount = values.length;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-xl text-left text-xs sm:text-sm transition-all min-h-[38px] ${
          disabled
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
            : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
        }`}
      >
        <div className="flex-1 flex flex-wrap gap-1 items-center min-w-0 pr-1">
          {selectedCount === 0 ? (
            <span className="text-gray-500 truncate">{placeholder}</span>
          ) : (
            <>
              {values.slice(0, badgeLimit).map((v) => {
                const opt = options.find((o) => o.value === v);
                const displayLabel = opt ? opt.label : v;
                return (
                  <span
                    key={v}
                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-md px-1.5 py-0.5 text-[11px] font-semibold max-w-[130px] truncate"
                  >
                    <span className="truncate">{displayLabel}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOption(v);
                      }}
                      className="hover:text-blue-900 rounded-full"
                    >
                      <X size={11} />
                    </button>
                  </span>
                );
              })}
              {selectedCount > badgeLimit && (
                <span className="text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-bold">
                  +{selectedCount - badgeLimit} lainnya
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 text-gray-400 shrink-0 ml-1">
          {selectedCount > 0 && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear()}
              className="p-1 hover:text-red-500 rounded-md cursor-pointer transition-colors"
              title="Reset pilihan"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-w-sm sm:max-w-none">
          {/* Search Bar */}
          <div className="p-2 border-b border-gray-100 bg-slate-50 flex items-center gap-2">
            <Search size={14} className="text-gray-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Action Toolbar */}
          <div className="px-3 py-1.5 bg-slate-50/70 border-b border-gray-100 flex items-center justify-between text-[11px]">
            <span className="text-gray-500 font-medium">
              {selectedCount > 0 ? (
                <strong className="text-blue-600">{selectedCount} nopol dipilih</strong>
              ) : (
                'Semua nopol (tanpa filter)'
              )}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
              >
                Pilih Semua
              </button>
              <span className="text-gray-300">•</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-500 hover:text-red-600 font-medium hover:underline"
              >
                Kosongkan
              </button>
            </div>
          </div>

          {/* List of Options */}
          <ul className="max-h-56 overflow-y-auto divide-y divide-gray-50 py-1 text-xs">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-4 text-center text-gray-400 text-xs">
                {searchQuery ? 'Tidak ada nopol yang sesuai pencarian' : 'Tidak ada nopol'}
              </li>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = values.includes(opt.value);
                return (
                  <li
                    key={opt.value}
                    onClick={() => !opt.disabled && toggleOption(opt.value)}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                      opt.disabled
                        ? 'opacity-50 cursor-not-allowed bg-gray-50'
                        : isChecked
                        ? 'bg-blue-50/60 text-blue-900 font-semibold'
                        : 'hover:bg-slate-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check size={11} strokeWidth={3} />}
                      </div>
                      <div className="min-w-0">
                        <span className="truncate block font-medium">{opt.label}</span>
                        {opt.subLabel && (
                          <span className="text-[10px] text-gray-400 block truncate font-normal">
                            {opt.subLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Done Button Bar */}
          <div className="p-2 border-t border-gray-100 bg-slate-50 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
