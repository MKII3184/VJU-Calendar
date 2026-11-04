import { ChevronDown, Search } from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Dropdown lọc CHỌN NHIỀU (checkbox) - cùng kiểu trigger với FilterSelect.
 * `values` là mảng đã chọn; rỗng → hiển thị `label` (nghĩa "Tất cả").
 */
export function MultiFilterSelect({
  label,
  values,
  options,
  onChange,
  searchable = false,
  disabled = false,
  searchPlaceholder = 'Tìm…',
}) {
  const [term, setTerm] = useState('');
  const filtered =
    searchable && term.trim()
      ? options.filter((o) => o.toLowerCase().includes(term.trim().toLowerCase()))
      : options;
  const display = values.length ? values.join(', ') : label;
  const toggle = (option, checked) =>
    onChange(checked ? [...values, option] : values.filter((v) => v !== option));

  return (
    <DropdownMenu modal={false} onOpenChange={(o) => !o && setTerm('')}>
      <DropdownMenuTrigger
        aria-label={label}
        disabled={disabled}
        className={cn(
          'disabled:pointer-events-none disabled:opacity-50',
          'glass-control border-input hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none',
          values.length > 0 && 'border-primary/40',
        )}
      >
        <span
          title={values.length ? display : undefined}
          className={cn('max-w-52 truncate', !values.length && 'text-muted-foreground')}
        >
          {display}
        </span>
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        // Esc khi đang có lựa chọn: xoá hết lựa chọn (giữ list mở) thay vì đóng list
        // hay đóng popup chứa nó; hết lựa chọn thì Esc đóng list như thường.
        onEscapeKeyDown={(e) => {
          if (!values.length) return;
          e.preventDefault();
          onChange([]);
        }}
        onWheel={(event) => { event.currentTarget.scrollTop += event.deltaY; }}
        className="max-h-80 min-w-48 max-w-[calc(100vw-1.5rem)] overflow-y-auto"
      >
        {searchable && (
          <div className="sticky top-0 z-10 p-1.5 pb-1">
            <div data-slot="input-shell" className="flex items-center gap-1.5 rounded-md border px-2">
              <Search className="text-muted-foreground size-3.5 shrink-0" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className="placeholder:text-muted-foreground h-7 w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        )}
        <DropdownMenuItem
          disabled={!values.length}
          onSelect={(e) => { e.preventDefault(); onChange([]); }}
        >
          {label}
        </DropdownMenuItem>
        {filtered.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={values.includes(option)}
            onCheckedChange={(checked) => toggle(option, checked)}
            onSelect={(e) => e.preventDefault()}
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
        {searchable && filtered.length === 0 && (
          <div className="text-muted-foreground px-2 py-2 text-center text-xs">Không có kết quả</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
