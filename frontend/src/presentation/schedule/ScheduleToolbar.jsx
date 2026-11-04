import { useState } from "react";
import { Download, LayoutGrid, Maximize2, Minimize2, RotateCcw, Rows3, Save, SlidersHorizontal, X } from "lucide-react";
import { coPhamVi, moTa as moTaPhamVi } from "../../adapters/phamVi";
import { COLOR_BY_OPTIONS } from "../../adapters/colorGrouping";
import { MultiFilterSelect } from "@/components/shared/multi-filter-select";
import { ListSearch } from "@/components/shared/list-search";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

// THANH LOC + HANH DONG cua man thoi khoa bieu. Mot khoi thuan giao dien: nhan
// bo loc hien tai, tra ve bo loc moi qua set(); khong tu doc AppDataContext,
// khong biet gi ve luoi hay hop thu.

// mm:dd/mm cua moc hoan tac - " lúc 14:32 ngày 05/08".
function nhanGio(at) {
  return at ? ` lúc ${at.slice(11, 16)} ngày ${at.slice(8, 10)}/${at.slice(5, 7)}` : "";
}

export default function ScheduleToolbar({ f, set, view, mode, phamVi }) {
  const [extraOpen, setExtraOpen] = useState(false);
  const setXem = (patch) => set({ ...patch, chiXemPhamVi: false });
  const extraFilterCount = [
    !f.guest || !f.resident,
    f.onlyProblems,
    f.chiXemPhamVi && coPhamVi(phamVi),
    mode === "grid" && f.colorBy !== "status",
  ].filter(Boolean).length;

  return (
    <div className={cn("glass-panel relative rounded-xl border p-2.5", extraOpen && "z-40")}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Xem theo chuong trinh + khoa, chon nhieu. Rong = khong loc ("Tat ca").
            "FTH · VJU2024" la mot nhom nguoi hoc that; danh sach khoa da duoc
            buildScheduleView loc theo cac chuong trinh dang chon. */}
        <Label className="text-muted-foreground text-xs font-medium">Xem</Label>
        <MultiFilterSelect
          label="Tất cả chương trình"
          searchable
          values={f.programs}
          options={view.programs}
          // Doi chuong trinh thi bo cac khoa khong con thuoc chuong trinh moi - de
          // lai la luoi trong ma nhin van nhu dang co bo loc hop le.
          onChange={(programs) => {
            const hopLe = view.cohortsFor(programs);
            setXem({ programs, khoas: f.khoas.filter((k) => hopLe.includes(k)) });
          }}
        />
        <MultiFilterSelect
          label="Tất cả khoá"
          searchable
          values={f.khoas}
          options={view.cohorts}
          onChange={(khoas) => setXem({ khoas })}
        />

        <ListSearch
          value={f.search}
          onChange={(v) => setXem({ search: v })}
          placeholder="Tìm môn, giảng viên, #id"
          className="w-full min-w-48 flex-1 lg:max-w-md"
        />

        <div className="relative w-full sm:w-auto">
          <Button
            type="button"
            variant={extraOpen ? "secondary" : "outline"}
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setExtraOpen((open) => !open)}
            aria-expanded={extraOpen}
            aria-controls="schedule-extra-filters"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Bộ lọc thêm
            {extraFilterCount > 0 && (
              <span className="bg-primary/10 text-primary rounded-full px-1.5 text-xs tabular-nums">
                {extraFilterCount}
              </span>
            )}
          </Button>
          {extraOpen && (
            <div
              id="schedule-extra-filters"
              className="glass-popover schedule-filter-popover absolute top-full right-0 z-50 mt-2 flex max-h-[min(70vh,24rem)] w-[min(46rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto rounded-xl border p-3 shadow-xl"
            >
              <div className="flex items-center justify-between gap-3 border-b pb-2">
                <div>
                  <div className="text-sm font-semibold">Bộ lọc hiển thị</div>
                  <div className="text-muted-foreground text-xs">Các lựa chọn này chỉ thay đổi nội dung đang xem.</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setExtraOpen(false)}
                  aria-label="Đóng bộ lọc thêm"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">Lớp</span>
                  <Label htmlFor="sv-guest" className="text-sm font-normal">
                    <Checkbox
                      id="sv-guest"
                      checked={f.guest}
                      onCheckedChange={(v) => setXem({ guest: v === true })}
                    />
                    Thỉnh giảng
                  </Label>
                  <Label htmlFor="sv-resident" className="text-sm font-normal">
                    <Checkbox
                      id="sv-resident"
                      checked={f.resident}
                      onCheckedChange={(v) => setXem({ resident: v === true })}
                    />
                    Cơ hữu
                  </Label>
                </div>

                <Label htmlFor="sv-problems" className="text-sm font-normal">
                  <Checkbox
                    id="sv-problems"
                    checked={f.onlyProblems}
                    onCheckedChange={(v) => setXem({ onlyProblems: v === true })}
                  />
                  Chỉ buổi có vấn đề
                </Label>

                {/* Chi hien khi DANG xep cho mot chuong trinh - khong co pham vi thi o tick
                    nay khong co nghia gi. Vua xep xong thi bam mot cai la thay dung phan
                    minh vua xep, khong phai tu do lai bo loc "Xem" o dau thanh. */}
                {coPhamVi(phamVi) && (
                  <Label htmlFor="sv-phamvi" className="text-sm font-normal">
                    <Checkbox
                      id="sv-phamvi"
                      checked={f.chiXemPhamVi}
                      onCheckedChange={(v) => set({ chiXemPhamVi: v === true })}
                    />
                    Chỉ phạm vi đang xếp ({moTaPhamVi(phamVi)})
                  </Label>
                )}

                {mode === "grid" && (
                  <NativeSelect
                    aria-label="Cách tô màu"
                    value={f.colorBy}
                    onChange={(e) => set({ colorBy: e.target.value })}
                  >
                    {COLOR_BY_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>Tô màu: {o.label}</option>
                    ))}
                  </NativeSelect>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScheduleActions({
  data, view, canEdit, loading, guestResult, residentResult,
  mode, onModeChange, fullscreen, onFullscreenChange, onSaveSchedule, onHoanTac,
  onXuatLuoi,
}) {
  const moc = data.hoanTac;

  return (
    <div className="glass-panel flex w-full min-w-0 items-center rounded-xl border p-2 lg:ml-auto lg:w-fit lg:max-w-full">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (guestResult || residentResult) && (
          <Button
            size="sm"
            disabled={loading}
            onClick={() => {
              if (window.confirm(
                "Ghi đè Thứ, Tiết bắt đầu/kết thúc và Trạng thái của TOÀN BỘ lớp đang xếp vào Dữ liệu học phần?",
              )) {
                onSaveSchedule();
              }
            }}
            title="Cập nhật Thứ, Tiết bắt đầu/kết thúc và trạng thái vào Dữ liệu học phần"
          >
            <Save className="size-4" />
            Lưu thời khoá biểu
          </Button>
        )}
        {/* XUAT LUOI ra Excel - dung cai dang hien, dung bo cuc dang hien.
            Khong gioi han o canEdit: nguoi chi co quyen xem van can in/gui lich
            cua chuong trinh minh di. */}
        <Button
          variant="outline"
          size="sm"
          disabled={loading || view.lessons.length === 0}
          onClick={onXuatLuoi}
          title={view.lessons.length
            ? `Xuất ${view.lessons.length} buổi đang hiện ra .xlsx, đúng bố cục lưới này`
            : "Bộ lọc hiện tại không còn buổi nào để xuất"}
        >
          <Download className="size-4" />
          Xuất lưới
        </Button>

        {/* HUY THAY DOI - cap doi cua "Luu": tra CA MAN ve dung lan luu gan
            nhat. Khac "Bo ghim" (mot buoi) va nut "Huy" o banner keo-tha (mot
            buoi CHUA luu). Mo khi chua co moc nao. */}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !moc}
            onClick={() => {
              if (!moc) return;
              if (window.confirm(
                `Huỷ mọi thay đổi và quay về ${moc.nhan}${nhanGio(moc.at)}?`
                + "\n\nGiờ của mọi lớp, các ghim tay, trạng thái chốt lịch, nhóm học chung "
                + "và lưới đang hiện đều trở về đúng lúc đó. Không hoàn tác lại được.",
              )) {
                onHoanTac();
              }
            }}
            title={moc
              ? `Quay về ${moc.nhan}${moc.at ? ` lúc ${moc.at.slice(11, 16)}` : ""}`
                + " — giờ, ghim, chốt lịch, nhóm học chung và lưới đều trở về đúng lúc đó."
              : "Chưa có mốc nào để quay về. Mốc được ghi khi nạp file và mỗi lần lưu thời khoá biểu."}
          >
            <RotateCcw className="size-4" />
            Huỷ thay đổi
          </Button>
        )}
        {/* Bo chuyen che do dang segmented - cung ngon ngu voi TabsList. */}
        <div className="glass-segmented inline-flex h-9 items-center rounded-lg border p-0.75">
          {[
            { key: "grid", label: "Lưới", icon: LayoutGrid },
            { key: "table", label: "Bảng", icon: Rows3 },
          ].map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => onModeChange(m.key)}
              aria-pressed={mode === m.key}
              className={cn(
                "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                mode === m.key
                  ? "glass-segmented-active text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <m.icon className="size-4" />
              {m.label}
            </button>
          ))}
        </div>

        {mode === "grid" && (
          <Button
            variant={fullscreen ? "default" : "outline"}
            size="sm"
            onClick={() => onFullscreenChange(!fullscreen)}
            title={
              canEdit
                ? "Toàn màn hình — thẻ hiện đủ thông tin, kéo-thả được để sửa tay"
                : "Toàn màn hình — thẻ hiện đủ mã lớp, môn, giảng viên, phòng"
            }
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            {fullscreen ? "Thoát" : "Toàn màn hình"}
          </Button>
        )}
      </div>
    </div>
  );
}
