import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * `<select>` gốc, khoác đúng bộ class của `Input` (h-9, border-input, ring 3px).
 *
 * Reference (BE_Enrollment) KHÔNG có component này — mọi chỗ lọc bên đó đều dùng
 * `FilterSelect` (dropdown Radix có ô tìm). Ở đây vẫn cần select gốc cho vài bộ
 * chọn 2–4 lựa chọn cố định (phạm vi xem, cách tô màu): `FilterSelect` luôn chèn
 * mục "Tất cả" và dựa trên `value === null`, sai ngữ nghĩa với những chỗ bắt buộc
 * phải có giá trị. Danh sách dài (chương trình, giảng viên) thì vẫn dùng
 * `FilterSelect` vì ô tìm ở đó mới có tác dụng thật.
 */
export function NativeSelect({ className, containerClassName, children, ...props }) {
  return (
    <div className={cn('relative inline-flex min-w-0', containerClassName)}>
      <select
        data-slot="native-select"
        className={cn(
          'border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full min-w-0 appearance-none rounded-md border py-1 pr-8 pl-3 text-sm transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" />
    </div>
  );
}
