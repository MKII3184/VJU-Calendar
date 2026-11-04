import {
  ChevronDown,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
} from 'lucide-react';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Khoa khop voi gia tri onPick() cua RolePickerScreen.
export const ROLE_LABELS = {
  viewer: 'Xem thôi',
  staff: 'Giáo vụ / Điều phối viên',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? ROLE_LABELS.staff;
}

/**
 * Thanh điều khiển gọn: nút thu gọn/mở sidebar + tên công cụ (trái),
 * menu vai trò · đổi vai trò (phải).
 *
 * Bên reference topbar để trống bên trái, nhưng công cụ này chạy độc lập
 * (không nằm trong cổng cán bộ) nên phải tự mang danh tính — đúng như mô tả
 * "topbar trắng (nút thu gọn + brand)" trong chính admin-layout của reference.
 */
export function AppTopbar({ collapsed, onToggleSidebar, role, onChangeRole }) {
  const name = roleLabel(role);

  return (
    <header className="glass-topbar relative z-30 flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        {/* Nút thu gọn (desktop) / mở drawer (mobile) sidebar */}
        <button
          type="button"
          data-slot="button"
          data-variant="ghost"
          onClick={onToggleSidebar}
          title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-9 shrink-0 items-center justify-center rounded-md focus-visible:ring-[3px] focus-visible:outline-none"
        >
          <Menu className="size-5 lg:hidden" />
          {collapsed ? (
            <PanelLeftOpen className="hidden size-5 lg:block" />
          ) : (
            <PanelLeftClose className="hidden size-5 lg:block" />
          )}
        </button>

        <div className="min-w-0 leading-tight">
          <p className="text-muted-foreground hidden text-[10px] font-medium tracking-wide uppercase sm:block">
            Phòng Đào tạo · VJU
          </p>
          <p className="truncate text-sm font-bold">Xếp thời khoá biểu</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
      <ThemeSwitcher />
      {/* Vai trò · đổi vai trò */}
      <DropdownMenu>
        <DropdownMenuTrigger className="hover:bg-muted focus-visible:ring-ring/50 flex shrink-0 items-center gap-2 rounded-md p-1 pr-2 focus-visible:ring-[3px] focus-visible:outline-none">
          <Avatar className="bg-primary size-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
              {role === 'viewer' ? 'XT' : 'GV'}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:block">{name}</span>
          <ChevronDown className="text-muted-foreground hidden size-4 sm:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel>
            <p className="text-sm font-medium">{name}</p>
            <p className="text-muted-foreground text-xs font-normal">
              Vai trò đang dùng
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onChangeRole}>
            <Repeat className="size-4" />
            Đổi vai trò
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
