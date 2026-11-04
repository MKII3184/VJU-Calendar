import { Droplets, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

function ThemeButton({ icon: Icon, label, pressed, onClick }) {
  return (
    <button
      type="button"
      data-theme-button
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'theme-switch-btn focus-visible:ring-ring/50 inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-[3px] focus-visible:outline-none',
        pressed
          ? 'theme-switch-btn-active text-primary'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

/** Ba nút giao diện: Sáng / Tối (chọn một) và Liquid Glass (bật/tắt độc lập). */
export function ThemeSwitcher({ className }) {
  const { mode, glass, setMode, toggleGlass } = useTheme();
  return (
    <div
      role="group"
      aria-label="Giao diện"
      className={cn('theme-switch inline-flex items-center gap-0.5 rounded-lg border p-0.5', className)}
    >
      <ThemeButton icon={Sun} label="Giao diện sáng" pressed={mode === 'light'} onClick={() => setMode('light')} />
      <ThemeButton icon={Moon} label="Giao diện tối" pressed={mode === 'dark'} onClick={() => setMode('dark')} />
      <ThemeButton icon={Droplets} label="Hiệu ứng Liquid Glass" pressed={glass} onClick={toggleGlass} />
    </div>
  );
}
