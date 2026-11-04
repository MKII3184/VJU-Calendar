import { DAY_LABELS } from "../../adapters/dayPeriod";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Picker gio CHOT cho 1 LOP - khac SubmissionWindowGrid (chon nhieu ngay/nhieu o
// roi rac cho "khung gio ranh cua GV"): o day 1 lop = DUNG 1 Thu + 1 khoang Tiet
// LIEN TUC, dai dung "So tiet / buoi". value: {day, periodStart, periodEnd} | null.
export default function ClassTimeSlotPicker({
  numDays,
  slotsPerDay,
  duration,
  maxDayIndex,
  value,
  onChange,
  disabled,
}) {
  const days = Array.from({ length: numDays }, (_, day) => ({
    day,
    label: DAY_LABELS[day] || `Ngày ${day + 1}`,
  }));
  const periods = Array.from({ length: slotsPerDay }, (_, i) => i + 1);
  const length = Number(duration);
  const validDuration = Number.isInteger(length) && length > 0 && length <= slotsPerDay;
  const lastAllowedDay = Math.min(numDays - 1, maxDayIndex ?? numDays - 1);
  const selectedLength = value == null ? 0 : value.periodEnd - value.periodStart + 1;
  const selectedOutsideRules = value != null && (
    value.day < 0
    || value.day >= numDays
    || value.day > lastAllowedDay
    || value.periodStart < 1
    || value.periodEnd > slotsPerDay
    || selectedLength !== length
  );

  const selectStart = (day, periodStart) => {
    if (disabled || !validDuration || day > lastAllowedDay || periodStart + length - 1 > slotsPerDay) return;
    onChange({ day, periodStart, periodEnd: periodStart + length - 1 });
  };

  const clear = () => onChange(null);

  return (
    <div className="bg-muted/30 space-y-2.5 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span className="availability-glass-cell size-3 rounded-[3px] border" aria-hidden="true" />
          Có thể bắt đầu
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span className="availability-glass-available size-3 rounded-[3px] border" aria-hidden="true" />
          Dải tiết đã chọn
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border bg-slate-200/70 opacity-60" aria-hidden="true" />
          Không hợp lệ
        </span>
      </div>

      <div className="overflow-x-auto">
        <div
          className="availability-glass-grid liquid-data-grid grid min-w-max overflow-hidden rounded-lg border"
          style={{ gridTemplateColumns: `3.5rem repeat(${numDays}, minmax(2.75rem, 1fr))` }}
        >
          <div className="availability-glass-header text-muted-foreground border-b px-2 py-1.5 text-[11px] font-semibold">
            Tiết
          </div>
          {days.map(({ day, label }) => (
            <div
              key={day}
              className={cn(
                "availability-glass-header text-muted-foreground border-b border-l px-1 py-1.5 text-center text-[11px] font-semibold",
                day > lastAllowedDay && "bg-slate-200/60 opacity-60",
              )}
              title={day > lastAllowedDay ? `${label} nằm ngoài giới hạn chọn tay của nhóm giảng viên` : label}
            >
              {label.replace("Thứ ", "T").replace("Chủ nhật", "CN")}
            </div>
          ))}

          {periods.map((period) => (
            <div key={period} className="contents">
              <div className="availability-glass-header text-muted-foreground border-b px-2 py-1 text-left text-[11px] tabular-nums">
                Tiết {period}
              </div>
              {days.map(({ day, label }) => {
                const selected = value != null
                  && value.day === day
                  && period >= value.periodStart
                  && period <= value.periodEnd;
                const invalidStart = !validDuration
                  || day > lastAllowedDay
                  || period + length - 1 > slotsPerDay;
                const locked = disabled || invalidStart;
                const reason = !validDuration
                  ? "Số tiết / buổi không hợp lệ"
                  : day > lastAllowedDay
                    ? `${label} nằm ngoài giới hạn chọn tay của nhóm giảng viên`
                    : period + length - 1 > slotsPerDay
                      ? `Không đủ ${length} tiết liên tiếp trong ngày`
                      : disabled
                        ? "Giờ của lớp đã chốt, chỉ có thể xem"
                        : `Chọn ${label}, tiết ${period}–${period + length - 1}`;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={locked}
                    aria-label={`${label} tiết ${period}: ${reason}`}
                    aria-pressed={selected}
                    title={reason}
                    onClick={() => selectStart(day, period)}
                    className={cn(
                      "availability-glass-cell flex h-7 items-center justify-center border-b border-l text-[10px] transition-colors",
                      selected && "availability-glass-available font-semibold",
                      invalidStart && !selected && "cursor-not-allowed bg-slate-200/60 opacity-50",
                      !locked && !selected && "hover:bg-emerald-50/70",
                      disabled && !selected && "cursor-default",
                    )}
                  >
                    {selected ? "•" : ""}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn("text-xs", selectedOutsideRules ? "text-amber-700" : "text-muted-foreground")}>
          {!validDuration
            ? "Nhập Số tiết / buổi hợp lệ trước khi chọn giờ."
            : value == null
              ? `Bấm một ô để chọn đủ ${length} tiết liên tiếp trong cùng ngày.`
              : value.day >= 0 && value.day < numDays
                ? `${selectedOutsideRules ? "Giờ gốc: " : "Đã chọn: "}${days[value.day].label}, tiết ${value.periodStart}–${value.periodEnd}${selectedOutsideRules ? " (ngoài quy tắc chọn tay hiện tại)" : ""}`
                : `Giờ gốc: ngày ${value.day + 1}, tiết ${value.periodStart}–${value.periodEnd} (ngoài khung lịch hiện tại)`}
        </span>
        {value && !disabled && (
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Xóa giờ
          </Button>
        )}
      </div>
    </div>
  );
}
