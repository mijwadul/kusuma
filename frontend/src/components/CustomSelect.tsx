import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string | number;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  placeholder?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  disabled = false,
  className = "",
  required = false,
}: CustomSelectProps) {
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

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-left transition-all ${
          disabled
            ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
            : isOpen
            ? "bg-white border-blue-500 ring-2 ring-blue-500/20"
            : "bg-white border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className={`block truncate ${!selectedOption && "text-gray-500"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Hidden input for form submission & native validation if needed */}
      <input
        type="hidden"
        required={required}
        value={value}
        onChange={() => {}} // Dummy handler to avoid warning
      />

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <ul className="max-h-60 overflow-y-auto py-1">
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500 text-center">Tidak ada pilihan</li>
            ) : (
              options.map((option) => (
                <li
                  key={option.value}
                  onClick={() => {
                    if (!option.disabled) {
                      onChange(option.value);
                      setIsOpen(false);
                    }
                  }}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm ${
                    option.disabled
                      ? "text-gray-400 bg-gray-50 cursor-not-allowed"
                      : option.value === value
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="block truncate">{option.label}</span>
                  {option.value === value && <Check size={16} className="text-blue-600" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
