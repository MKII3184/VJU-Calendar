import { Eye, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

// Thay LoginScreen gốc (JWT thật) — công cụ demo này không có hệ thống tài
// khoản, nên "đăng nhập" chỉ là chọn vai trò để giới hạn các màn hình được
// vào (tránh 1 người xem vô tình bấm giải lại/nạp đè dữ liệu người khác đang
// xem, vì STATE phía Flask là dùng chung 1 phiên duy nhất).
//
// Dung style man dang nhap cua app Nhap hoc: nen do dam (token --sidebar - bo
// token nay o reference CHI dung cho man dang nhap, khong phai cho sidebar),
// khoi thuong hieu o giua, the trang do bong.
export default function RolePickerScreen({ onPick }) {
  return (
    <div className="liquid-role-canvas relative flex min-h-dvh items-center justify-center p-4">
      <ThemeSwitcher className="absolute top-3 right-3" />
      <div className="w-full max-w-sm">
        {/* Thương hiệu */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="glass-brand-mark flex size-12 items-center justify-center rounded-xl text-sm font-bold tracking-tight text-white">
            VJU
          </span>
          <div>
            <p className="text-foreground text-lg font-semibold">Xếp thời khoá biểu</p>
            <p className="text-muted-foreground text-sm">Phòng Đào tạo</p>
          </div>
        </div>

        {/* Thẻ chọn vai trò */}
        <div className="glass-hero-card rounded-2xl border p-6">
          <h1 className="text-lg font-semibold">Vào công cụ xếp TKB</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Không cần tài khoản — chọn vai trò phù hợp với việc bạn cần làm.
          </p>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Button
                type="button"
                className="h-11 w-full"
                onClick={() => onPick("staff")}
              >
                <Users className="size-4" />
                Giáo vụ / Điều phối viên
              </Button>
              <p className="text-muted-foreground text-xs">
                Toàn quyền: nạp dữ liệu, nộp giờ, giải Giai đoạn 1 &amp; 2, từ
                chối/luân chuyển.
              </p>
            </div>

            <div className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                onClick={() => onPick("viewer")}
              >
                <Eye className="size-4" />
                Xem thôi
              </Button>
              <p className="text-muted-foreground text-xs">
                Chỉ tra cứu lịch giảng viên, xem check trùng và nhật ký — không
                sinh/giải lại dữ liệu.
              </p>
            </div>
          </div>

          <p className="bg-muted/60 text-muted-foreground mt-4 flex items-start gap-1.5 rounded-md p-2 text-xs">
            <TriangleAlert className="mt-px size-3.5 shrink-0" />
            <span>
              Công cụ nội bộ, <span className="text-foreground font-medium">
              không dùng để vận hành chính thức</span>. Kết quả chỉ mang tính
              tham khảo cho giáo vụ khoa.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
