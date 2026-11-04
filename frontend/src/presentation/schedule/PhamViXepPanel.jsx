import { useMemo } from "react";
import { Target, X } from "lucide-react";
import {
  chuanHoa,
  coPhamVi,
  danhSachChuongTrinh,
  danhSachKhoa,
  demPhamVi,
} from "../../adapters/phamVi";
import { MultiFilterSelect } from "@/components/shared/multi-filter-select";
import { Pill } from "@/components/shared/pill";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// CHỌN PHẠM VI XẾP — "lần bấm Xếp này áp cho chương trình nào".
//
// Vì sao là một khối riêng chứ không nhét vào thanh lọc: thanh lọc quyết định
// NHÌN THẤY gì, khối này quyết định hệ thống ĐƯỢC PHÉP ĐỔI GIỜ của lớp nào —
// hai việc khác hẳn nhau và nhầm lẫn thì hậu quả cũng khác hẳn. Đặt ngay trên
// thanh tiến trình để đọc theo đúng thứ tự: "xếp cho ai" rồi mới tới "bấm gì".
//
// Cả chương trình lẫn khóa đều chọn NHIỀU: "FTH + BCSE, khóa 2026, 2025 và 2024"
// trong cùng một lần xếp. Backend (domain/pham_vi.py) đã nhận danh sách.
export default function PhamViXepPanel({ data, phamVi, onChange, disabled, ketQuaPhamVi }) {
  const programs = danhSachChuongTrinh(data);
  const chuongTrinh = phamVi?.programs ?? [];
  const khoaDaChon = phamVi?.cohorts ?? [];

  // Khóa hiện ra ĐI THEO các chương trình đang chọn — xem adapters/phamVi.js.
  const khoas = useMemo(() => danhSachKhoa(data, chuongTrinh), [data, chuongTrinh]);
  const dem = useMemo(() => demPhamVi(data, phamVi), [data, phamVi]);
  const dangCoPhamVi = coPhamVi(phamVi);

  // Đổi chương trình thì bỏ các khóa không còn thuộc chương trình mới: để lại là
  // phạm vi rỗng lớp mà nhìn vẫn như có chọn.
  const datChuongTrinh = (ds) => {
    const hopLe = danhSachKhoa(data, ds);
    onChange(chuanHoa({ programs: ds, cohorts: khoaDaChon.filter((k) => hopLe.includes(k)) }));
  };
  const datKhoa = (ds) => onChange(chuanHoa({ programs: chuongTrinh, cohorts: ds }));

  return (
    <div
      className={cn(
        "glass-panel flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3",
        // Đang xếp cho một phạm vi là trạng thái ĐẶC BIỆT (nút Xếp sẽ không đụng
        // tới phần còn lại của khoa) — phải nhìn ra ngay, không để lẫn với thanh
        // lọc bên dưới. Chỉ đổi viền, không đặt nền: cn() là tailwind-merge, đặt
        // bg-* sẽ xóa mất bg-card (xem chú thích cùng loại ở WorkflowStrip).
        dangCoPhamVi && "border-2 border-violet-500/60",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Target className="text-muted-foreground size-4" aria-hidden="true" />
        Xếp cho
      </span>

      <MultiFilterSelect
        label="Toàn khoa"
        searchable
        values={chuongTrinh}
        disabled={disabled}
        options={programs}
        onChange={datChuongTrinh}
      />

      {/* Không chọn khóa nào = MỌI khóa của chương trình. Phải nói ra, không thì
          giáo vụ tưởng chưa chọn gì là chưa xếp được. */}
      <MultiFilterSelect
        label="Mọi khoá"
        searchable
        values={khoaDaChon}
        disabled={disabled}
        options={khoas}
        onChange={datKhoa}
      />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {dangCoPhamVi ? (
          <>
            <Pill tone="violet">
              {dem.tong} lớp · {dem.chuaCoGio} chưa có giờ
            </Pill>
            {/* Lớp có ô CTĐT ghép ("FTH.ESAS") nằm trong phạm vi của CẢ HAI
                chương trình — đến lượt bên kia bấm Xếp, họ có quyền đổi giờ của
                nó. Muốn giữ cứng thì phải "Chốt lịch theo học phần". */}
            {dem.dungChung > 0 && (
              <Pill tone="amber">{dem.dungChung} lớp dùng chung CTĐT khác</Pill>
            )}
            {/* "Bỏ ghim" một lớp ngoài phạm vi = hai ý muốn ngược nhau của cùng
                một người. Phạm vi thắng (xem webapp/domain/pham_vi.py) nhưng
                không được im lặng, nếu không giáo vụ bấm Bỏ ghim rồi Xếp mà lớp
                đó vẫn đứng yên thì tưởng nút hỏng. */}
            {/* Lời hứa DUY NHẤT của tính năng này vừa bị phá — kêu to nhất. */}
            {ketQuaPhamVi?.ngoaiPhamViBiDoiGio > 0 && (
              <Pill tone="red">
                ⚠ {ketQuaPhamVi.ngoaiPhamViBiDoiGio} buổi ngoài phạm vi bị đổi giờ — báo lỗi
              </Pill>
            )}
            {/* Giờ đang có của các chương trình khác đã xung đột sẵn với nhau
                (thường do file có dòng nhập trùng), nên lần xếp này buộc phải
                đè lên. Không được im lặng. */}
            {ketQuaPhamVi?.ngoaiPhamViMatCho?.length > 0 && (
              <Pill tone="red">
                {ketQuaPhamVi.ngoaiPhamViMatCho.length} buổi của CTĐT khác mất chỗ (
                {ketQuaPhamVi.ngoaiPhamViMatCho.slice(0, 3).map((id) => `#${id}`).join(", ")}
                {ketQuaPhamVi.ngoaiPhamViMatCho.length > 3 ? "…" : ""})
              </Pill>
            )}
            {ketQuaPhamVi?.dongBangBiDay?.length > 0 && (
              <Pill tone="red">
                {ketQuaPhamVi.dongBangBiDay.length} buổi của CTĐT khác bị đè (
                {ketQuaPhamVi.dongBangBiDay.slice(0, 3).map((id) => `#${id}`).join(", ")}
                {ketQuaPhamVi.dongBangBiDay.length > 3 ? "…" : ""})
              </Pill>
            )}
            {ketQuaPhamVi?.boGhimNgoaiPhamVi > 0 && (
              <Pill tone="slate">
                {ketQuaPhamVi.boGhimNgoaiPhamVi} lớp đã bỏ ghim nằm ngoài phạm vi — vẫn giữ chỗ
              </Pill>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              <X className="size-4" aria-hidden="true" />
              Bỏ phạm vi
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground text-xs">
            Đang xếp cho toàn khoa — chọn một chương trình để chỉ xếp phần của
            chương trình đó, lớp của các chương trình khác giữ nguyên giờ.
          </span>
        )}
      </div>
    </div>
  );
}
