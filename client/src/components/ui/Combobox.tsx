import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  allowCustom = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtered options based on query
  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Whether the typed query is a new custom value (not in options)
  const isCustomQuery =
    allowCustom &&
    query.trim().length > 0 &&
    !options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  // Build the items list: custom entry + filtered options
  const items: { label: string; value: string; isCustom?: boolean }[] = [];
  if (isCustomQuery) {
    items.push({ label: `Use "${query.trim()}"`, value: query.trim(), isCustom: true });
  }
  filtered.forEach((o) => items.push({ label: o, value: o }));

  // Click outside → close
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Reset query to current value when closing
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Reset highlighted index when items change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query, open]);

  const selectItem = (val: string) => {
    onChange(val);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const clearValue = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!open) setOpen(true);
  };

  const handleFocus = () => {
    setOpen(true);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < items.length) {
          selectItem(items[highlightedIndex].value);
        } else if (allowCustom && query.trim()) {
          selectItem(query.trim());
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  };

  // Determine what to show in the input
  const displayValue = open ? query : value;

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={value ? value : placeholder}
          className={cn(
            'w-full rounded-lg border border-navy-200 px-3 py-2.5 pr-16 text-sm text-navy-800',
            'placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500',
            'transition-colors'
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={clearValue}
              className="p-1 rounded hover:bg-navy-100 text-navy-400 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (open) {
                setOpen(false);
                setQuery('');
              } else {
                inputRef.current?.focus();
              }
            }}
            className="p-1 rounded hover:bg-navy-100 text-navy-400 cursor-pointer"
          >
            <ChevronDown
              size={14}
              className={cn('transition-transform', open && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {open && items.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-navy-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {items.map((item, idx) => (
            <li
              key={item.isCustom ? `__custom__` : item.value}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur before click fires
                selectItem(item.value);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                'px-3 py-2 text-sm cursor-pointer transition-colors',
                highlightedIndex === idx
                  ? 'bg-accent-50 text-accent-700'
                  : 'text-navy-700 hover:bg-navy-50',
                item.isCustom && 'italic border-b border-navy-100',
                item.value === value && !item.isCustom && 'font-medium'
              )}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}

      {open && items.length === 0 && query && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-navy-200 rounded-lg shadow-lg px-3 py-3 text-sm text-navy-400 text-center">
          No matches found
        </div>
      )}
    </div>
  );
}
