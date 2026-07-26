'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const base =
  'w-full rounded border border-rule-strong bg-white px-3 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-ink-faint focus:border-dusk focus:outline-none focus:ring-2 focus:ring-dusk/20 disabled:cursor-not-allowed disabled:bg-chalk';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, 'h-10', className)} {...props} />
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, 'py-2 leading-relaxed', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      base,
      'h-10 appearance-none pr-8',
      'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' stroke=\'%235A6070\' stroke-width=\'2\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")] bg-[length:14px] bg-[right_10px_center] bg-no-repeat',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[13px] font-medium text-ink">{label}</label>
      {children}
      {error ? (
        <p className="text-[12px] text-bad">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Choose one',
  className,
}: {
  value: string | number;
  onChange: (val: string) => void;
  options: (string | { value: string | number; label: string })[];
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const activeLabel = normalizedOptions.find((opt) => String(opt.value) === String(value))?.label || placeholder;

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded border border-rule-strong bg-white px-3 text-left text-sm text-ink transition-colors hover:border-ink-faint focus:border-dusk focus:outline-none focus:ring-2 focus:ring-dusk/20'
        )}
      >
        <span className={cn(!value && 'text-ink-faint')}>{activeLabel}</span>
        <ChevronDown className={cn('h-4 w-4 text-ink-faint transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded border border-rule bg-white p-1 shadow-lg focus:outline-none scroll-thin">
          <li
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className={cn(
              'relative cursor-pointer select-none rounded px-3 py-2 text-sm transition-colors',
              !value ? 'bg-dusk-soft text-dusk font-medium' : 'text-ink-muted hover:bg-chalk hover:text-ink'
            )}
          >
            {placeholder}
          </li>
          {normalizedOptions.map((option) => {
            const isSelected = String(value) === String(option.value);
            return (
              <li
                key={String(option.value)}
                onClick={() => {
                  onChange(String(option.value));
                  setIsOpen(false);
                }}
                className={cn(
                  'relative cursor-pointer select-none rounded px-3 py-2 text-sm transition-colors',
                  isSelected ? 'bg-dusk text-white font-medium' : 'text-ink hover:bg-chalk hover:text-ink'
                )}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TimeSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate 15-minute options
  const options: string[] = [];
  for (let h = 0; h <= 24; h++) {
    const hh = String(h).padStart(2, '0');
    if (h === 24) {
      options.push('24:00');
    } else {
      options.push(`${hh}:00`);
      options.push(`${hh}:15`);
      options.push(`${hh}:30`);
      options.push(`${hh}:45`);
    }
  }

  useEffect(() => {
    if (isOpen) {
      const activeEl = containerRef.current?.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-9 w-[104px] items-center justify-between rounded border border-rule-strong bg-white px-3 font-mono text-[13px] text-ink transition-colors hover:border-ink-faint focus:border-dusk focus:outline-none focus:ring-2 focus:ring-dusk/20'
        )}
      >
        <span>{value}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
      </button>

      {isOpen && (
        <ul className="absolute z-50 mt-1 max-h-48 w-[104px] overflow-auto rounded border border-rule bg-white p-1 shadow-lg focus:outline-none scroll-thin">
          {options.map((opt) => {
            const isActive = value === opt;
            return (
              <li
                key={opt}
                data-active={isActive}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={cn(
                  'cursor-pointer select-none rounded px-2 py-1 text-center font-mono text-[13px] transition-colors',
                  isActive ? 'bg-dusk text-white font-semibold' : 'text-ink hover:bg-chalk hover:text-ink'
                )}
              >
                {opt}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DateSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedDate = value ? new Date(value + 'T12:00:00Z') : new Date();
  const [currentYear, setCurrentYear] = useState(parsedDate.getUTCFullYear() || new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(parsedDate.getUTCMonth() || new Date().getMonth());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const days: number[] = [];
  for (let i = 1; i <= totalDays; i++) {
    days.push(i);
  }

  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const selectDay = (day: number) => {
    const yyyy = currentYear;
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const displayValue = value ? (() => {
    const parts = value.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return value;
  })() : 'Select date';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-[140px] items-center justify-between rounded border border-rule-strong bg-white px-3 font-mono text-[13px] text-ink transition-colors hover:border-ink-faint focus:border-dusk focus:outline-none focus:ring-2 focus:ring-dusk/20"
      >
        <span>{displayValue}</span>
        <Calendar className="h-3.5 w-3.5 text-ink-faint" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-[260px] rounded border border-rule bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-rule pb-2 mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="rounded p-1 hover:bg-chalk transition-colors text-ink-muted hover:text-ink"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[12px] font-bold text-ink">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="rounded p-1 hover:bg-chalk transition-colors text-ink-muted hover:text-ink"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-ink-faint mb-1">
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
            <span>Su</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: startOffset }).map((_, idx) => (
              <span key={`prev-${idx}`} className="text-[11px] text-rule-strong/40 py-1 select-none font-mono">
                {prevMonthDays - startOffset + idx + 1}
              </span>
            ))}

            {days.map((day) => {
              const mm = String(currentMonth + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const dateStr = `${currentYear}-${mm}-${dd}`;
              const isSelected = value === dateStr;
              const isToday = (() => {
                const today = new Date();
                return today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
              })();

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    'text-[11px] rounded py-1 transition-colors hover:bg-chalk select-none font-mono',
                    isSelected && 'bg-dusk text-white hover:bg-dusk font-bold',
                    isToday && !isSelected && 'border border-dusk text-dusk font-semibold'
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
