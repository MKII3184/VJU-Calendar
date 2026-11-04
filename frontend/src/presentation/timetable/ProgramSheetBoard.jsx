// "BANG CHUONG TRINH" trong toan man hinh - bo cuc giong sheet TKB giay khoa
// van dung: hang = (Ngay | Tiet | Gio), cot = chuong trinh gom theo khoa, mot
// buoi nhieu tiet gop DOC. Nguoi dung doc cot cua mot chuong trinh y nhu doc
// cot nganh tren sheet giay, thay vi phai quet ngang 7 cot ngay day thanh mau.
//
// Du lieu do adapters/programSheet.js dung (gom o, gop doc, chong gio).
// Keo-tha van hoat dong: tha vao o bat ky = dat buoi bat dau tai (ngay, tiet)
// cua hang do - cot chuong trinh chi la cach nhom de nhin, khong doi ngu nghia.
import { useMemo, useState } from "react";
import { Pin, TriangleAlert } from "lucide-react";
import { getColor } from "../../adapters/colorPalette";
import { groupKeyOf, statusKeyOf, STATUS_COLORS } from "../../adapters/colorGrouping";
import { dungSheetChuongTrinh, gioTiet } from "../../adapters/programSheet";
import { cn } from "@/lib/utils";

// Be rong 3 cot dinh ben trai (Ngay | Tiet | Gio) - khop --stick-l-* trong
// styles.css; doi thi doi ca hai cho.
const W_NGAY = 54;
const W_TIET = 46;
const W_GIO = 88;

function mauCuaBuoi(lesson, colorBy) {
  return (
    (colorBy === "status" ? STATUS_COLORS[statusKeyOf(lesson)] : null)
    ?? getColor(groupKeyOf(lesson, colorBy))
  );
}

function SheetLesson({ lesson, colorBy, dim, dragEnabled }) {
  const mau = mauCuaBuoi(lesson, colorBy);
  const phong = [lesson.roomType, lesson.location].filter(Boolean).join(" · ");
  const tietCuoi = (lesson.period ?? 0) + (lesson.duration || 1);
  const nhan =
    `${lesson.classCode ? `[${lesson.classCode}] ` : ""}${lesson.courseName}`
    + `${lesson.hocChung ? ` (+${lesson.hocChung.count - 1} môn học chung)` : ""}`
    + ` — ${lesson.teacherName || "Chưa phân công"}`
    + `${phong ? ` — ${phong}` : ""}`
    + ` — Tiết ${(lesson.period ?? 0) + 1}–${tietCuoi}`
    + (lesson.boQua ? " — do đơn vị khác điều phối" : "")
    + (lesson.hasProblem ? " — có vấn đề" : "");

  return (
    <div
      className={cn(
        "prog-cell-card",
        lesson.hasProblem && "has-problem",
        lesson.boQua && "bo-qua",
        lesson.pendingSave && "pending",
        dim && "dimmed",
      )}
      style={{ "--acc": mau.border }}
      title={nhan}
      // Ban phim: doc duoc nhan day du qua aria-label nhu thanh tren luoi.
      tabIndex={0}
      role="button"
      aria-label={nhan}
      // Lop do don vi khac dieu phoi: khoa KHONG duoc doi gio - chi duoc nhin
      // (cung luat voi thanh tren luoi, xem webapp/domain/bo_qua.py).
      draggable={dragEnabled && !lesson.boQua}
      onDragStart={
        dragEnabled && !lesson.boQua
          ? (e) => {
              e.dataTransfer.setData("text/plain", String(lesson.id));
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
    >
      <span className="prog-cell-flags" aria-hidden="true">
        {lesson.isPinned && <Pin className="size-2.5" />}
        {lesson.hasProblem && <TriangleAlert className="size-2.5" />}
      </span>
      <span className="prog-cell-name">{lesson.courseName}</span>
      <span className="prog-cell-sub">
        {lesson.teacherName}
        {phong ? ` — ${phong}` : ""}
      </span>
    </div>
  );
}

export default function ProgramSheetBoard({
  lessons = [],
  numDays = 7,
  slotsPerDay = 12,
  highlightedIds,
  colorBy = "status",
  searchState = null,
  onMoveLesson,
}) {
  const dragEnabled = !!onMoveLesson;
  const [dragOver, setDragOver] = useState(null); // `${day}-${period}`
  const sheet = useMemo(
    () => dungSheetChuongTrinh(lessons, numDays, slotsPerDay),
    [lessons, numDays, slotsPerDay],
  );
  // It cot (loc ve 1-vai chuong trinh): moi cot gian rat rong - bat "roomy" de
  // hang cao hon, chu lon hon, doc nhu sheet giay cho 1 nganh thay vi bang mat
  // do toan khoa.
  const roomy = sheet.columns.length <= 4;
  const hasHighlight = !!highlightedIds?.size;

  const dropHandlers = (di, p) =>
    dragEnabled
      ? {
          onDragOver: (e) => {
            e.preventDefault();
            setDragOver(`${di}-${p}`);
          },
          onDragLeave: () => setDragOver((c) => (c === `${di}-${p}` ? null : c)),
          onDrop: (e) => {
            e.preventDefault();
            setDragOver(null);
            const sid = Number(e.dataTransfer.getData("text/plain"));
            if (Number.isFinite(sid)) onMoveLesson(sid, di * slotsPerDay + p);
          },
        }
      : {};

  return (
    <div className="prog-sheet-wrap">
      <table className={cn("prog-sheet", roomy && "roomy")}>
        <colgroup>
          <col style={{ width: W_NGAY }} />
          <col style={{ width: W_TIET }} />
          <col style={{ width: W_GIO }} />
          {sheet.columns.map((c) => (
            <col key={c.key} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="stick-l stick-t corner" colSpan={3} rowSpan={2}>
              Ngày · Tiết · Giờ
            </th>
            {sheet.khoas.map((k) => (
              <th key={k.cohort} className="stick-t cohort" colSpan={k.programs.length}>
                Khóa {k.cohort}
              </th>
            ))}
          </tr>
          <tr>
            {sheet.columns.map((c) => (
              <th key={c.key} className="stick-t prog">
                {c.program}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.days.map((tenNgay, di) =>
            Array.from({ length: slotsPerDay }, (_, p) => (
              <tr key={`${di}-${p}`}>
                {p === 0 && (
                  <td className="stick-l day-label" rowSpan={slotsPerDay}>
                    {tenNgay}
                  </td>
                )}
                <td className="stick-l tiet">Tiết {p + 1}</td>
                <td className="stick-l gio">{gioTiet(p)}</td>
                {sheet.columns.map((col) => {
                  if (sheet.covered.has(`${col.key}|${di}|${p}`)) return null;
                  const cKey = sheet.cellKey(col, di, p);
                  const cell = sheet.cells.get(cKey);
                  return (
                    <td
                      key={col.key}
                      rowSpan={cell ? sheet.rowspan.get(cKey) : 1}
                      className={cn(
                        "prog-cell",
                        dragOver === `${di}-${p}` && "drag-over",
                      )}
                      {...dropHandlers(di, p)}
                    >
                      <div className="prog-cell-stack">
                        {cell?.lessons.map((l) => (
                          <SheetLesson
                            key={l.id}
                            lesson={l}
                            colorBy={colorBy}
                            dragEnabled={dragEnabled}
                            dim={
                              searchState === "none"
                              || (searchState === "match" && hasHighlight && !highlightedIds.has(l.id))
                            }
                          />
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
