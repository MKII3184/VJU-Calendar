import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Wand2, X } from "lucide-react";
import { DAY_LABELS } from "../../adapters/dayPeriod";
import { submissionToWindowSlots, windowSlotsToSelectedCellsMap } from "../../adapters/submissionAdapter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Luoi khai "gio co the day" trong tuan. Hai che do RO RANG, khong nhap lam mot:
//
//   readOnly  - chi hien gio DA LUU tren server. Khong bam duoc, khong co nut.
//   sua       - lam viec tren mot ban NHAP rieng; chi khi bam "Lưu" moi goi API,
//               "Hủy" tra ve dung trang thai da luu.
//
// Ban truoc luon o che do sua nen khong phan biet duoc dau la du lieu that, dau
// la thao tac dang do: o chon GV ghi "8 ô rảnh" trong khi luoi ghi "Đã chọn 0"
// (vi vua bam "Xóa tất cả" ma chua luu) - nhin vao khong biet tin cai nao.
//
// Mau o da chon giu xanh la (emerald) - day la "co the day", khong phai mau
// thuong hieu; do da danh cho canh bao/trung gio o cac luoi khac.
//
// allowEmpty: cho phep LUU danh sach rong. Mac dinh tat vi o man "Khung giờ đã
// báo" nop rong la vo nghia (khong con lua chon nao de solver xep). Rieng trang
// "Giờ rảnh GV" thi can bat: giao vu phai xoa duoc gio da khai nham cua 1 GV.
// teachingSlots: cac o giang vien DANG THUC SU DAY, suy tu cac lop da chot gio.
// Hien bang kinh xanh nuoc bien nhat va KHONG tick san: day la BANG CHUNG "day
// duoc luc nay", con kinh xanh la nhat la gio DA KHAI - von la GIOI HAN CUNG khi
// xep cac lop chua co gio. Tron hai thu lam mot thi khai xong cac lop chua co
// gio cua ho chi duoc xep vao dung nhung o DA BI CHIEM -> khong xep duoc.
// onGenerateAvailability: CO tac dung ("Tự động khai giờ rảnh") chi khi duoc
// truyen vao - man "Khung gio da bao" (SubmissionsPage) va ClassTimeSlotPicker
// khong truyen prop nay nen khong hien nut, tranh dung nham noi khong co API
// tuong ung. Nut tu goi API sinh+luu ngay o backend (khong tu random ben FE) -
// xem webapp/domain/availability_generator.py.
export default function SubmissionWindowGrid({
  numDays,
  slotsPerDay,
  initialSlots = [],
  teachingSlots = [],
  onSave,
  onCancel,
  onGenerateAvailability,
  saving,
  disabled,
  readOnly = false,
  allowEmpty = false,
  saveLabel,
  gridClassName,
  showInstructions = true,
}) {
  const [grid, setGrid] = useState({});
  // Keo chuot quet mot VUNG CHU NHAT: giao vu thuong ranh nguyen buoi ("T2-T6
  // tiet 1-4"), bat tung o mot la 20 cu click. Giu trong ref vi doi lien tuc
  // theo con tro, khong can re-render moi lan.
  const dragRef = useRef(null);
  const [dragBox, setDragBox] = useState(null);

  const locked = readOnly || disabled || saving;

  // Set de tra cuu nhanh trong lucRender tung o.
  // Khoa theo NOI DUNG: caller hay truyen `x || []` (mang moi moi lan render),
  // neu khoa theo tham chieu thi ban nhap bi reset lien tuc.
  const teachingKey = teachingSlots.join(",");
  const dangDay = useMemo(() => new Set(teachingSlots), [teachingKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // O DANG DAY khong bao gio la gio ranh: khong chon, khong luu, va neu du lieu
  // cu lo co o trung thi bo no khoi ban nhap.
  const isTeaching = useCallback((d, p) => dangDay.has(d * slotsPerDay + p), [dangDay, slotsPerDay]);
  const initialKey = initialSlots.join(",");
  const savedSlots = useMemo(() => initialSlots.filter((s) => !dangDay.has(s)), [initialKey, dangDay]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setGrid(windowSlotsToSelectedCellsMap(savedSlots, slotsPerDay));
  }, [savedSlots, slotsPerDay]);

  const days = DAY_LABELS.slice(0, numDays).map((label, idx) => ({
    idx,
    label,
    short: label.replace("Thứ ", "T").replace("Chủ nhật", "CN"),
  }));
  const periods = Array.from({ length: slotsPerDay }, (_, i) => i);

  const commitDrag = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragBox(null);
    if (!drag) return;
    const { anchor, head, value } = drag;
    setGrid((prev) => {
      const next = { ...prev };
      for (let d = Math.min(anchor.d, head.d); d <= Math.max(anchor.d, head.d); d++) {
        for (let p = Math.min(anchor.p, head.p); p <= Math.max(anchor.p, head.p); p++) {
          if (!isTeaching(d, p)) next[`${d}-${p}`] = value;
        }
      }
      return next;
    });
  }, [isTeaching]);

  // Nha chuot NGOAI luoi van phai chot vung dang quet - neu chi nghe pointerup
  // tren o thi keo ra ngoai roi tha se ket dinh o trang thai dang keo.
  useEffect(() => {
    if (!dragBox) return;
    window.addEventListener("pointerup", commitDrag);
    window.addEventListener("pointercancel", commitDrag);
    return () => {
      window.removeEventListener("pointerup", commitDrag);
      window.removeEventListener("pointercancel", commitDrag);
    };
  }, [dragBox, commitDrag]);

  const startDrag = (d, p) => {
    if (locked || isTeaching(d, p)) return;
    const value = !grid[`${d}-${p}`];
    dragRef.current = { anchor: { d, p }, head: { d, p }, value };
    setDragBox({ d0: d, p0: p, d1: d, p1: p, value });
  };

  const extendDrag = (d, p) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.head = { d, p };
    setDragBox({
      d0: Math.min(drag.anchor.d, d), p0: Math.min(drag.anchor.p, p),
      d1: Math.max(drag.anchor.d, d), p1: Math.max(drag.anchor.p, p),
      value: drag.value,
    });
  };

  // Ban phim khong co "keo" - Space/Enter bat-tat DUNG o dang focus. Khong tai
  // dung startDrag o day vi no mo mot vung dang quet ma khong bao gio co
  // pointerup de chot lai.
  const toggleCell = (d, p) => {
    if (locked || isTeaching(d, p)) return;
    setGrid((prev) => ({ ...prev, [`${d}-${p}`]: !prev[`${d}-${p}`] }));
  };

  // Bam nhan hang/cot = bat-tat ca hang/cot do. "Rảnh cả ngày thứ 4" hoac "kín
  // tiết 1 mọi ngày" la hai kieu khai pho bien nhat, khong nen bat nguoi dung
  // keo tay tung lan.
  const toggleDay = (d) => {
    if (locked) return;
    const free = periods.filter((p) => !isTeaching(d, p));
    const allOn = free.every((p) => grid[`${d}-${p}`]);
    setGrid((prev) => {
      const next = { ...prev };
      free.forEach((p) => { next[`${d}-${p}`] = !allOn; });
      return next;
    });
  };

  const togglePeriod = (p) => {
    if (locked) return;
    const free = days.filter((d) => !isTeaching(d.idx, p));
    const allOn = free.every((d) => grid[`${d.idx}-${p}`]);
    setGrid((prev) => {
      const next = { ...prev };
      free.forEach((d) => { next[`${d.idx}-${p}`] = !allOn; });
      return next;
    });
  };

  const cellOn = (d, p) => {
    if (isTeaching(d, p)) return false;
    if (dragBox && d >= dragBox.d0 && d <= dragBox.d1 && p >= dragBox.p0 && p <= dragBox.p1) {
      return dragBox.value;
    }
    return !!grid[`${d}-${p}`];
  };

  const selectedCount = useMemo(() => {
    let n = 0;
    for (const d of days) for (const p of periods) if (cellOn(d.idx, p)) n++;
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, dragBox, numDays, slotsPerDay]);

  // So SANH TAP HOP chu khong so dem: bo 1 o roi tick 1 o khac van la co thay
  // doi chua luu, du tong van bang nhau.
  const dirty = useMemo(() => {
    if (readOnly) return false;
    const saved = new Set(savedSlots);
    if (saved.size !== selectedCount) return true;
    for (const d of days) {
      for (const p of periods) {
        if (cellOn(d.idx, p) && !saved.has(d.idx * slotsPerDay + p)) return true;
      }
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, savedSlots, grid, dragBox, selectedCount, numDays, slotsPerDay]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span className="availability-glass-cell size-3 rounded-[3px] border" aria-hidden="true" />
          {readOnly ? "Không rảnh" : "Chưa chọn"}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span className="availability-glass-available size-3 rounded-[3px] border" aria-hidden="true" />
          Có thể dạy
        </span>
        {dangDay.size > 0 && (
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span
              className="availability-glass-teaching size-3 rounded-[3px] border"
              aria-hidden="true"
            />
            Đang dạy (giờ đã chốt)
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-2">
          {dirty && (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700">
              chưa lưu
            </span>
          )}
          <span className="font-medium text-emerald-700 tabular-nums">
            {selectedCount} ô
          </span>
        </span>
      </div>

      <div className="overflow-x-auto">
        <div
          className={cn(
            "availability-glass-grid grid min-w-max overflow-hidden rounded-lg border select-none",
            gridClassName,
            !locked && "cursor-pointer",
          )}
          style={{ gridTemplateColumns: `3.5rem repeat(${numDays}, minmax(2.75rem, 1fr))` }}
        >
          <div className="availability-glass-header text-muted-foreground border-b px-2 py-1.5 text-[11px] font-semibold">
            Tiết
          </div>
          {days.map((d) => (
            <button
              key={d.idx}
              type="button"
              disabled={locked}
              title={locked ? undefined : `Bật/tắt cả ${d.label}`}
              onClick={() => toggleDay(d.idx)}
              className={cn(
                "availability-glass-header text-muted-foreground border-b border-l px-1 py-1.5 text-center text-[11px] font-semibold",
                !locked && "hover:bg-muted hover:text-foreground",
              )}
            >
              {d.short}
            </button>
          ))}

          {periods.map((p) => (
            <RowCells
              key={p}
              period={p}
              days={days}
              slotsPerDay={slotsPerDay}
              dangDay={dangDay}
              cellOn={cellOn}
              locked={locked}
              onTogglePeriod={togglePeriod}
              onToggleCell={toggleCell}
              onStartDrag={startDrag}
              onExtendDrag={extendDrag}
              lastRow={p === slotsPerDay - 1}
            />
          ))}
        </div>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          {showInstructions && (
            <p className="text-muted-foreground text-xs">
              Kéo để quét cả vùng · bấm nhãn <strong className="text-foreground">T2…CN</strong> hoặc{" "}
              <strong className="text-foreground">số tiết</strong> để bật/tắt cả hàng
            </p>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {onGenerateAvailability && (
              <GenerateAvailabilityButton disabled={locked} saving={saving} onConfirm={onGenerateAvailability} />
            )}
            <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => setGrid({})}>
              <X className="size-4" />
              Bỏ chọn hết
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" size="sm" disabled={saving} onClick={onCancel}>
                Hủy
              </Button>
            )}
            {!disabled && (
              <Button
                type="button"
                size="sm"
                disabled={saving || (!allowEmpty && selectedCount === 0)}
                onClick={() => onSave(submissionToWindowSlots(grid, slotsPerDay).filter((s) => !dangDay.has(s)))}
              >
                {saving
                  ? "Đang lưu…"
                  : saveLabel
                    ? saveLabel(selectedCount)
                    : `Nộp ${selectedCount} khung giờ`}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RowCells({ period, days, slotsPerDay, dangDay, cellOn, locked, onTogglePeriod, onToggleCell, onStartDrag, onExtendDrag, lastRow }) {
  return (
    <>
      <button
        type="button"
        disabled={locked}
        title={locked ? undefined : `Bật/tắt tiết ${period + 1} cả tuần`}
        onClick={() => onTogglePeriod(period)}
        className={cn(
          "availability-glass-header text-muted-foreground px-2 py-1 text-left text-[11px] tabular-nums",
          !lastRow && "border-b",
          !locked && "hover:bg-muted hover:text-foreground",
        )}
      >
        Tiết {period + 1}
      </button>
      {days.map((d) => {
        const on = cellOn(d.idx, period);
        const day = dangDay?.has(d.idx * slotsPerDay + period);
        return (
          <div
            key={d.idx}
            role="checkbox"
            tabIndex={locked || day ? -1 : 0}
            aria-checked={on}
            aria-disabled={day || undefined}
            aria-label={`${d.label} tiết ${period + 1}${day ? " — đang dạy" : ""}`}
            title={day ? "Đang dạy ở giờ này (lớp đã chốt giờ)" : undefined}
            onPointerDown={(e) => {
              if (locked || day) return;
              e.preventDefault();
              onStartDrag(d.idx, period);
            }}
            onPointerEnter={() => onExtendDrag(d.idx, period)}
            onKeyDown={(e) => {
              if (locked || day || (e.key !== " " && e.key !== "Enter")) return;
              e.preventDefault();
              onToggleCell(d.idx, period);
            }}
            className={cn(
              "availability-glass-cell flex h-7 touch-none items-center justify-center border-l transition-[filter,background-color]",
              !lastRow && "border-b",
              day
                ? "availability-glass-teaching"
                : on
                  ? "availability-glass-available"
                  : "",
              !locked && (day || on) && "hover:brightness-[.97]",
              !locked && !day && !on && "hover:bg-emerald-50/70",
              (locked || day) && "cursor-default",
            )}
          />
        );
      })}
    </>
  );
}

// Nut "Tu dong khai gio ranh" + hop thoai xac nhan - LUON hoi truoc vi thao tac
// XOA TOAN BO gio ranh hien co roi sinh lai (xem
// PROMPT-THEM-CHUC-NANG-GIO-RANH-GIANG-VIEN.md muc 4). Tu quan ly trang thai
// "dang xu ly" rieng (busy) thay vi chi dua vao `saving` cua cha: bam "Xác nhận
// sinh lại" phai khoa ngay hop thoai nay, khong doi cho cha re-render voi
// saving=true (co do tre 1 nhip qua onGenerateAvailability -> runAction).
function GenerateAvailabilityButton({ disabled, saving, onConfirm }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = disabled || saving || busy;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // Loi da duoc Notice/Nhat ky o man cha hien roi (xem AppDataContext.runAction)
      // - giu hop thoai MO de nguoi dung biet thao tac CHUA xong, khong lam nhu
      // da thanh cong va khong lam mat gio ranh cu tren giao dien.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={locked}>
          <Wand2 className="size-4" />
          Tự động khai giờ rảnh
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tự động khai giờ rảnh?</DialogTitle>
          <DialogDescription>
            Toàn bộ giờ rảnh hiện tại của giảng viên này sẽ bị <strong>xóa</strong> và thay bằng kết
            quả sinh tự động mới theo khung sáng/chiều/tối. Giờ đang dạy (theo lớp đã chốt) sẽ được
            giữ nguyên, không bị đánh dấu là giờ rảnh.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Hủy
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={busy}>
            {busy ? "Đang sinh…" : "Xác nhận sinh lại"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Nut "Chỉnh sửa" dung chung cho cac man dat luoi nay o che do readOnly. */
export function EditAvailabilityButton({ onClick, disabled, children = "Chỉnh sửa" }) {
  return (
    <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onClick}>
      <Pencil className="size-4" />
      {children}
    </Button>
  );
}
