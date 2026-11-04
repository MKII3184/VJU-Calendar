import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * Một dòng nhãn–ô nhập, bố cục 2 cột trên màn rộng và xếp chồng trên màn hẹp.
 *
 * Reference xếp chồng (`space-y-2` + Label + Input) vì form bên đó ngắn. Ngăn kéo
 * "Sửa lớp" ở đây có ~20 trường — xếp chồng hết thì phải cuộn rất dài, nên dùng
 * 2 cột cho gọn, đúng như `.form-row` cũ vẫn làm.
 *
 * `children` nhận một hàm `(id) => node` để nhãn gắn đúng vào ô nhập; truyền
 * node thẳng cũng được khi ô nhập tự lo nhãn (vd nhóm 2 ô LT/TH).
 */
export function FormRow({ label, hint, error, required, children, className }) {
  const id = useId();

  return (
    <div
      className={cn(
        'grid items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]',
        className,
      )}
    >
      <Label htmlFor={id} className="text-foreground/80 text-sm font-medium">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="min-w-0 space-y-1">
        {typeof children === 'function' ? children(id) : children}
        {error && <p role="alert" className="text-destructive text-xs">{error}</p>}
        {hint && <p className="text-foreground/70 text-xs">{hint}</p>}
      </div>
    </div>
  );
}
