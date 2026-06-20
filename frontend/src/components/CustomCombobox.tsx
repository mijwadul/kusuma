import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface ComboboxOption {
  value: string | number;
  label: string; // Force string label for easier filtering
}

export interface CustomComboboxProps {
  value: string | number;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export default function CustomCombobox({
  value,
  onChange,
  options,
  placeholder = "Ketik atau pilih...",
  disabled = false,
  className = "",
  required = false,
}: CustomComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter options based on what's typed
  const filteredOptions = useMemo(() => {
    const stringValue = String(value).toLowerCase();
    if (!stringValue) return options;

    return options.filter(
      (opt) =>
        String(opt.label).toLowerCase().includes(stringValue) ||
        String(opt.value).toLowerCase().includes(stringValue)
    );
  }, [value, options]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={String(value)}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true); // Open dropdown when typing
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full flex items-center justify-between pl-3 pr-10 py-2 border rounded-lg text-left transition-all ${
            disabled
              ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
              : isOpen
              ? "bg-white border-blue-500 ring-2 ring-blue-500/20"
              : "bg-white border-gray-300 hover:border-gray-400"
          }`}
          autoComplete="off" // Prevent native browser autocomplete
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            if (!disabled) setIsOpen(!isOpen);
          }}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 hover:text-gray-700"
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <ul className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500 text-center">
                Tekan Enter untuk input nilai manual
              </li>
            ) : (
              filteredOptions.map((option) => (
                <li
                  key={option.value}
                  onClick={() => {
                    onChange(String(option.value));
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm ${
                    String(option.value) === String(value)
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="block truncate">{option.label}</span>
                  {String(option.value) === String(value) && (
                    <Check size={16} className="text-blue-600" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
