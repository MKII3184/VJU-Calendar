import { Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Ba buoc cua quy trinh, gom thanh MOT DONG. Truoc day moi buoc la mot tab rieng
// voi header 90px cua no - nhung Giai doan 1 va 2 khong phai hai khung nhin, chung
// la hai buoc cua cung mot san pham. Buoc thi thuoc ve thanh tien trinh.
export default function WorkflowStrip({ steps, canEdit, loading }) {
  return (
    <div className="grid gap-3">
      {steps.map((s, i) => {
        const done = s.state === "done";
        const problem = s.state === "blocked" || s.state === "partial" || s.state === "error";
        return (
          <div
            key={s.key}
            data-state={s.state}
            className={cn(
              "glass-panel flex items-start gap-3 rounded-xl border p-3",
              done && "border-emerald-500/50 bg-emerald-500/10",
              problem && "border-red-500/50 bg-red-500/10",
              // Buoc co canh bao (vd nghiem GD2 vua bi huy) phai NHIN RA duoc,
              // khong the chi doi mot con so o dong `value`.
              //
              // CHI doi vien + do day vien, KHONG dat nen amber: cn() la
              // tailwind-merge, no coi `bg-amber-500/5` xung dot voi `bg-card` va
              // XOA bg-card di - the mat nen card, thanh trong suot tren nen
              // trang. Vien 2px + chu amber da du nhin ra ma khong pha nen.
              s.hint && "border-2 border-amber-500/60",
            )}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                done
                  ? "bg-emerald-600 text-white"
                  : problem
                    ? "bg-red-600 text-white"
                    : "bg-muted text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {i + 1}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {s.label}
                <span className={cn(
                  "inline-flex items-center gap-1 text-[11px]",
                  done ? "text-emerald-800" : problem ? "font-bold text-black" : "text-muted-foreground",
                )}>
                  {done ? <Check className="size-3.5" /> : problem ? <TriangleAlert className="size-3.5" /> : null}
                  {done ? "Hoàn tất" : problem ? (s.state === "partial" ? "Chưa hoàn tất" : "Bị chặn") : "Sẵn sàng"}
                </span>
              </span>
              <span className="text-muted-foreground block text-xs tabular-nums">
                {s.value}
              </span>
              {/* `note` = chu thich trung tinh (vd "can xep thinh giang truoc"),
                  `hint` = CANH BAO (vd nghiem GD2 vua bi huy). Hai muc do khac
                  nhau nen mau khac nhau, khong gop lam mot. */}
              {s.note && (
                <span className={cn(
                  "mt-0.5 block text-[11px] leading-snug",
                  problem ? "font-bold text-black" : "text-muted-foreground",
                )}>
                  {s.note}
                </span>
              )}
              {s.hint && (
                <span className={cn(
                  "mt-0.5 block text-[11px] leading-snug",
                  problem ? "font-bold text-black" : "text-amber-700",
                )}>
                  {s.hint}
                </span>
              )}
            </span>

            {s.action && canEdit && (
              <Button
                size="sm"
                variant={done ? "outline" : "default"}
                disabled={loading || s.disabled}
                onClick={s.action}
              >
                {loading ? "Đang chạy…" : s.actionLabel}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
