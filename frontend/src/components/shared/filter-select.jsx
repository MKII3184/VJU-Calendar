import { Check, ChevronDown, Search } from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** Option co the la chuoi (value===label) hoac cap {value,label}. */
function normalize(opt) {
  return typeof opt === 'string' ? { value: opt, label: opt } : opt;
}

/**
 * Dropdown lọc dùng chung (Khoa / Chương trình / Trạng thái…).
 * `value === null` → hiển thị nhãn mặc định (nghĩa "Tất cả").
 *
 * - `searchable` — hiện ô tìm trong dropdown (cho danh sách dài như Khoa/Giảng viên).
 * - `full`       — trigger chiếm hết chiều ngang (dùng trong form dialog cho đồng bộ với input).
 * - `modal`      — đặt `false` khi dropdown nằm trong popover/panel tự quản: modal=true
 *                  làm Radix gán pointer-events:none lên <body>, click kế tiếp rơi ra
 *                  ngoài panel → panel bị đóng oan.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  searchable = false,
  full = false,
  modal = true,
  id,
  emptyLabel = 'Tất cả',
  searchPlaceholder = 'Tìm…',
}) {
  const items = options.map(normalize);
  const selectedLabel = items.find((o) => o.value === value)?.label ?? label;
  const [term, setTerm] = useState('');
  const filtered =
    searchable && term.trim()
      ? items.filter((o) =>
          o.label.toLowerCase().includes(term.trim().toLowerCase()),
        )
      : items;

  return (
    <DropdownMenu modal={modal} onOpenChange={(o) => !o && setTerm('')}>
      <DropdownMenuTrigger
        id={id}
        className={cn(
          'glass-control border-input hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none',
          value && 'border-primary/40',
          full && 'flex w-full justify-between',
        )}
      >
        <span
          title={value ? selectedLabel : undefined}
          className={cn(
            'truncate',
            full ? 'flex-1 text-left' : 'max-w-52',
            !value && 'text-muted-foreground',
          )}
        >
          {selectedLabel}
        </span>
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onWheel={modal ? undefined : (event) => {
          event.currentTarget.scrollTop += event.deltaY;
        }}
        className={cn(
          'max-h-80 min-w-48 max-w-[calc(100vw-1.5rem)] overflow-y-auto',
          full && 'w-[var(--radix-dropdown-menu-trigger-width)]',
        )}
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
                autoFocus
                className="placeholder:text-muted-foreground h-7 w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        )}
        <DropdownMenuItem onSelect={() => onChange(null)}>
          <span className="flex-1 break-words whitespace-normal">{emptyLabel}</span>
          {value === null && <Check className="size-4 shrink-0" />}
        </DropdownMenuItem>
        {filtered.map((opt) => (
          <DropdownMenuItem key={opt.value} onSelect={() => onChange(opt.value)}>
            <span className="flex-1 break-words whitespace-normal">
              {opt.label}
            </span>
            {value === opt.value && <Check className="size-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
        {searchable && filtered.length === 0 && (
          <div className="text-muted-foreground px-2 py-2 text-center text-xs">
            Không có kết quả
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
