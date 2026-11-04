import { useEffect, useMemo, useRef, useState } from "react";
import { DAY_LABELS } from "../../adapters/dayPeriod";
import { getColor } from "../../adapters/colorPalette";
import { groupKeyOf, statusKeyOf, STATUS_COLORS } from "../../adapters/colorGrouping";
import { chiaCotTheoNgay } from "../../adapters/luoiLayout";
import LessonCard from "./LessonCard";

const ROW_H = 60;
const HEADER_H = 36;
const MIN_BAR_WIDTH = 12; // px - do rong "slot" toi thieu; sau khi tru GAP se
// con lai ~10px mau thuc su nhin thay - du de di chuot/bam vao duoc
const BASE_DAY_WIDTH = 110; // px - do rong 1 ngay khi khong (hoac it) chong gio
const DETAIL_CARD_W = 180; // px - be rong CO DINH cua 1 the o che do chi tiet
const DETAIL_ROW_H = 66; // px - dung khi chua do duoc chieu cao kha dung
const MIN_FIT_ROW_H = 38; // px - san: hep hon nua thi the 1 tiet khong con doc duoc,
// luc do chap nhan cuon doc thay vi bop chu den muc vo nghia
const AUTOSCROLL_EDGE = 56; // px - vung gan bien bat dau tu cuon khi keo toi
const AUTOSCROLL_MAX_SPEED = 22; // px/frame toi da, giam dan khi cang gan mep vung

// Clone tu FE_SCHEDULE/SchedulingSystem.jsx: giu nguyen thuat toan chia cot
// khi cac buoi trung gio trong cung 1 ngay (greedy interval-scheduling, kieu
// Google Calendar) + toan dinh vi tuyet doi. Cot moi ngay dung
// "minmax(toi_thieu, 1fr)": VAN co gian lap day man hinh rong nhu truoc
// (khac voi ban px co dinh truoc do lam ca luoi bi co nho lai khong ro ly do
// tren man rong) - nhung khong bao gio hep hon muc toi thieu can de 1 thanh
// mau khong duoi MIN_BAR_WIDTH. Vi cot co the rong hon muc toi thieu (do
// 1fr gianh phan du ra), thanh mau phai tinh theo % CUA CHIEU RONG THAT cua
// o chua no (percentage tu nhien khop voi bat ky do rong grid quyet dinh),
// khong the dung px co dinh cho be rong thanh nua.
export default function LessonGridBoard({
  lessons = [], numDays, slotsPerDay, highlightedIds, colorBy, onPickProblem, detailed = false,
  // searchState: "match" = dang tim va co buoi khop (the mo khong hien popup);
  // "none" = dang tim ma khong khop buoi nao (mo toan bo luoi); null = khong tim.
  searchState = null,
  // scrollTarget: { id, seq } - seq de bam LAI dung vu do van cuon lai duoc
  // (neu chi truyen id thi lan bam thu hai khong doi gia tri, effect khong chay).
  onMoveLesson, onClearOverride, onTachHocChung, onOpenManual, scrollTarget = null,
}) {
  // Keo-tha CHI mo o che do chi tiet (toan man hinh): the ~180px la muc tieu tha
  // du lon de nham chinh xac; o che do thanh mau thuong (12-20px, co ngay tram
  // trong toi 14 the/ngay) keo-tha se rat de tha nham hang xom. "Toan man hinh"
  // da duoc dinh nghia la "ban lam viec" tu truoc, sua tay hop voi khung do.
  const dragEnabled = detailed && !!onMoveLesson;
  const [dragOverCell, setDragOverCell] = useState(null); // `${day}-${period}` dang keo qua
  const days = DAY_LABELS.slice(0, numDays);

  // wrapRef: khung cuon (.schedv2-grid-wrap) - dung chung cho ResizeObserver (do
  // chieu cao kha dung, ben duoi) VA cho tu-cuon khi keo-tha (ngay ben duoi day).
  const wrapRef = useRef(null);

  // Tu cuon khi keo toi gan bien khung nhin. HTML5 drag&drop KHONG tu cuon mot
  // div co overflow:auto khi keo toi mep no (chi trinh duyet tu cuon CA TRANG,
  // khong cuon container con) - phai tu lam bang requestAnimationFrame doc van
  // toc hien tai (scrollVelRef) moi khung hinh, thay vi chi doc 1 lan trong
  // dragover (dragover ban than da bi trinh duyet gioi han tan so goi).
  const scrollVelRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef(null);
  const draggingRef = useRef(false);

  const tickAutoScroll = () => {
    const el = wrapRef.current;
    const { x, y } = scrollVelRef.current;
    if (el && (x || y)) {
      el.scrollLeft += x;
      el.scrollTop += y;
    }
    rafIdRef.current = draggingRef.current ? requestAnimationFrame(tickAutoScroll) : null;
  };

  const updateAutoScrollVelocity = (e) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const speedAt = (dist) => AUTOSCROLL_MAX_SPEED * (1 - Math.max(0, dist) / AUTOSCROLL_EDGE);
    let x = 0, y = 0;
    if (e.clientX < r.left + AUTOSCROLL_EDGE) x = -speedAt(e.clientX - r.left);
    else if (e.clientX > r.right - AUTOSCROLL_EDGE) x = speedAt(r.right - e.clientX);
    if (e.clientY < r.top + AUTOSCROLL_EDGE) y = -speedAt(e.clientY - r.top);
    else if (e.clientY > r.bottom - AUTOSCROLL_EDGE) y = speedAt(r.bottom - e.clientY);
    scrollVelRef.current = { x, y };
    if (rafIdRef.current == null) rafIdRef.current = requestAnimationFrame(tickAutoScroll);
  };

  const stopAutoScroll = () => {
    draggingRef.current = false;
    scrollVelRef.current = { x: 0, y: 0 };
  };

  // Don rAF dang cho neu component unmount giua luc keo (vd chuyen tab/thoat
  // toan man hinh khi chua tha xong).
  useEffect(() => {
    return () => {
      draggingRef.current = false;
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Chon 1 vu trong Hop thu van de -> CUON THANG toi buoi do. Truoc day chi to
  // sang the va lam mo phan con lai, nhung luoi rong hon man hinh ca hai chieu
  // (15 chuong trinh x 7 ngay x 12 tiet) nen "to sang" mot the dang nam ngoai
  // khung nhin khong giup gi - nguoi dung van phai tu di tim.
  //
  // Tu tinh scrollLeft/scrollTop thay vi goi scrollIntoView(): scrollIntoView
  // cuon MOI to tien co the cuon, ke ca <main> cua app shell - man hinh se giat
  // ca trang. O day chi duoc phep cuon dung khung luoi (wrapRef).
  useEffect(() => {
    const id = scrollTarget?.id;
    if (id == null) return;
    let huy = false;
    let conLai = 5; // chon vu con go bo loc -> luoi ve lai; the co the chua ton tai o frame nay

    const thu = () => {
      if (huy) return;
      const el = wrapRef.current;
      const card = el?.querySelector(`[data-lesson-id="${id}"]`);
      if (!card) {
        if (conLai-- > 0) requestAnimationFrame(thu);
        return;
      }
      const r = card.getBoundingClientRect();
      const w = el.getBoundingClientRect();
      // Canh vao giua khung nhin, roi kep lai trong pham vi cuon duoc.
      const left = el.scrollLeft + (r.left - w.left) - (w.width - r.width) / 2;
      const top = el.scrollTop + (r.top - w.top) - (w.height - r.height) / 2;
      el.scrollTo({
        left: Math.max(0, Math.min(left, el.scrollWidth - el.clientWidth)),
        top: Math.max(0, Math.min(top, el.scrollHeight - el.clientHeight)),
        behavior: "smooth",
      });
    };

    requestAnimationFrame(thu);
    return () => { huy = true; };
  }, [scrollTarget]);
  const hasVisibleHighlight = !!highlightedIds?.size && lessons.some((l) => highlightedIds.has(l.id));

  const byDay = useMemo(() => {
    const map = {};
    lessons.forEach((l) => {
      if (l.day == null || l.period == null) return;
      (map[l.day] ||= []).push(l);
    });
    return map;
  }, [lessons]);

  // Chia cot cho cac buoi trung gio - THUAT TOAN nam o adapters/luoiLayout.js
  // vi file Excel xuat ra tu luoi phai co dung bo cuc nay (xem adapters/xuatLuoi.js).
  const layoutMap = useMemo(() => chiaCotTheoNgay(lessons), [lessons]);

  // Do rong PX cho tung ngay - lay theo so cot dong nhat trong ngay do.
  //
  // CHE DO THUONG: moi the toi thieu MIN_BAR_WIDTH, cot dung minmax(...,1fr) nen
  // luoi luon co gian vua be ngang - khong cuon ngang, doc "hinh dang tuan".
  //
  // CHE DO CHI TIET (toan man hinh): moi the CO DINH DETAIL_CARD_W de chua duoc
  // ma lop + mon + GV + phong, cot dung px co dinh nen luoi duoc phep rong hon
  // man hinh va cuon ngang. Day la thu duy nhat tao ra chieu rong that: rieng
  // toan man hinh khong lam duoc (chi dua the tu 14px len 19px o pham vi toan
  // khoa, vi van phai ep 7 ngay vua man).
  const dayColWidths = useMemo(() => {
    const widths = {};
    for (let di = 0; di < numDays; di++) {
      const maxCols = (byDay[di] || []).reduce((m, l) => Math.max(m, layoutMap[l.id]?.totalCols || 1), 1);
      widths[di] = detailed
        ? Math.max(DETAIL_CARD_W, maxCols * DETAIL_CARD_W)
        : Math.max(BASE_DAY_WIDTH, maxCols * MIN_BAR_WIDTH);
    }
    return widths;
  }, [byDay, layoutMap, numDays, detailed]);

  // Chieu cao hang tu co cho DU 12 TIET VUA MAN, khoi phai cuon doc. Phai do
  // that bang ResizeObserver chu khong dat 1fr duoc: the buoi hoc dinh vi tuyet
  // doi theo px (top = period * rowH) nen can con so px thuc.
  // Khong co vong lap do: .schedv2-grid-wrap.detailed lay chieu cao tu flex cha,
  // khong phu thuoc noi dung ben trong.
  const [availH, setAvailH] = useState(0);

  useEffect(() => {
    if (!detailed || !wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(([entry]) => setAvailH(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [detailed]);

  const fittedRow =
    detailed && availH > 0
      ? Math.max(MIN_FIT_ROW_H, Math.floor((availH - HEADER_H - 2) / slotsPerDay))
      : null;

  const rowH = detailed ? fittedRow ?? DETAIL_ROW_H : ROW_H;
  const totalBodyHeight = slotsPerDay * rowH;

  return (
    <div
      ref={wrapRef}
      className={`schedv2-grid-wrap ${detailed ? "detailed" : ""}`}
      // onDragOver o cap container (khong phai tung o) de bat duoc VUNG SAT MEP
      // ngoai cung cua khung nhin - cac o than luoi khong phu het toi tan bien vi
      // con header dinh (sticky) nam tren/trai chung. e.preventDefault() bat
      // buoc phai co o day, khong thi browser huy drag ngay khi ra khoi 1 o.
      onDragOver={dragEnabled ? (e) => { e.preventDefault(); updateAutoScrollVelocity(e); } : undefined}
    >
      {/* has-highlight: khi dang to sang, cac buoi CON LAI chim xuong (mo + giam
          bao hoa) de khoi can xem noi len. Lam bang 1 class o goc thay vi truyen
          prop xuong tung LessonCard.
          Chi bat khi co buoi DANG HIEN THI duoc to sang - neu luoi dang bi loc va
          buoi do khong nam trong ket qua loc thi bat lam moi thu chim het ma khong
          co gi noi len. */}
      <div
        className={`schedv2-grid-table liquid-data-grid ${hasVisibleHighlight ? "has-highlight" : ""} ${searchState === "none" ? "search-nomatch" : ""} ${
          detailed ? "detailed" : ""
        }`}
        style={{
          gridTemplateColumns: `70px ${Array.from({ length: numDays }, (_, di) =>
            detailed ? `${dayColWidths[di]}px` : `minmax(${dayColWidths[di]}px, 1fr)`,
          ).join(" ")}`,
          gridTemplateRows: `${HEADER_H}px repeat(${slotsPerDay}, ${rowH}px)`,
        }}
      >
        <div className="schedv2-grid-cell time" style={{ gridRow: 1, gridColumn: 1 }}>Tiết</div>
        {days.map((d, i) => (
          <div key={d} style={{ gridRow: 1, gridColumn: i + 2 }} className="schedv2-grid-cell day">
            {/* Nhan ngay bam theo be ngang (xem .schedv2-grid-cell.day > span
                trong styles.css): o che do chi tiet mot ngay co the rong vai
                nghin px, nhan canh giua se troi han ra ngoai khung nhin va
                cuon toi giua ngay thi khong con biet dang xem thu may. */}
            <span>{d}</span>
          </div>
        ))}

        {Array.from({ length: slotsPerDay }, (_, p) => (
          <div key={`time-${p}`} className="schedv2-grid-cell time" style={{ gridRow: p + 2, gridColumn: 1 }}>
            <strong>Tiết {p + 1}</strong>
          </div>
        ))}

        {Array.from({ length: slotsPerDay }, (_, p) =>
          days.map((_, di) => {
            const cellKey = `${di}-${p}`;
            if (!dragEnabled) {
              return <div key={cellKey} className="schedv2-grid-cell body" style={{ gridRow: p + 2, gridColumn: di + 2 }} />;
            }
            // Tha vao o nay = dat buoi bat dau tai (ngay di, tiet p) - khop dung
            // cach the dang dinh vi ben duoi (top = period * rowH).
            return (
              <div
                key={cellKey}
                className={`schedv2-grid-cell body sv-drop-cell ${dragOverCell === cellKey ? "sv-drag-over" : ""}`}
                style={{ gridRow: p + 2, gridColumn: di + 2 }}
                onDragOver={(e) => { e.preventDefault(); setDragOverCell(cellKey); }}
                onDragLeave={() => setDragOverCell((c) => (c === cellKey ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCell(null);
                  const sid = Number(e.dataTransfer.getData("text/plain"));
                  if (Number.isFinite(sid)) onMoveLesson(sid, di * slotsPerDay + p);
                }}
              />
            );
          }),
        )}

        {Object.entries(byDay).map(([diStr, dayLessons]) => {
          const di = Number(diStr);
          return (
            <div
              key={`day-host-${di}`}
              className="schedv2-day-host"
              style={{ gridRow: `2 / ${slotsPerDay + 2}`, gridColumn: di + 2, position: "relative", height: totalBodyHeight, pointerEvents: "none" }}
            >
              {dayLessons.map((lesson) => {
                const { colIndex, totalCols } = layoutMap[lesson.id] || { colIndex: 0, totalCols: 1 };
                const top = lesson.period * rowH;
                const heightPx = (lesson.duration || 1) * rowH;
                const GAP = 2;
                // GAP CO DINH, KHONG nhan theo colIndex - ban truoc (colIndex*GAP
                // luy tich ca 2 dau) khien cot cuoi trong 1 hang nhieu cot (~10+)
                // bi tru gan het be rong, con lai ~0px (da phat hien qua kiem tra
                // thuc te). Cong thuc nay giu khoang cach deu, khong bao gio phinh
                // to theo colIndex.
                const widthPct = 100 / totalCols;
                const leftPct = colIndex * widthPct;
                // TRUOC DAY co chan keo buoi GD1 ("frozen") - da bo: backend
                // (/api/move-lesson) kiem tra xung dot tren CA guestResult+
                // residentResult bat ke buoi thuoc phase nao, nen khong con ly
                // do ky thuat de chan. Moi buoi deu keo duoc nhu nhau.
                const canDrag = dragEnabled;
                return (
                  <div
                    key={lesson.id}
                    // Moc de cuon toi dung buoi khi chon mot vu trong Hop thu van
                    // de (xem scrollToLessonId ben duoi) - dat tren WRAPPER chu
                    // khong tren LessonCard vi chinh wrapper mang toa do tuyet doi.
                    data-lesson-id={lesson.id}
                    // Wrapper nay co pointerEvents:auto nen NAM TREN cac o luoi
                    // (.sv-drop-cell) ben duoi ve z-order - the buoi hoc nao dang
                    // chiem 1 o thi drop LEN CHINH THE DO se bi "nuot": browser
                    // gui drop event vao wrapper nay (vi no la element o tren
                    // cung tai diem tha), nhung wrapper truoc day KHONG co onDrop
                    // rieng nen event roi vao "ho" - bubble len day-host/grid-table
                    // (deu khong co onDrop) va mat luon, khong ai xu ly. Ket qua:
                    // tha DUNG vao 1 o dang co buoi khac se khong lam gi ca, chi
                    // tha vao o TRONG (khong the nao che) moi hoat dong.
                    // Sua: gan onDrop/onDragOver ngay tren wrapper, tu tinh lai
                    // tiet dua vao vi tri con tro so voi day-host (la .parentElement
                    // cua chinh wrapper nay) - cung cong thuc pixel->tiet ma o
                    // luoi dung, khong phu thuoc the nao dang render o do.
                    onDragOver={
                      dragEnabled
                        ? (e) => {
                            e.preventDefault();
                            updateAutoScrollVelocity(e);
                          }
                        : undefined
                    }
                    onDrop={
                      dragEnabled
                        ? (e) => {
                            e.preventDefault();
                            setDragOverCell(null);
                            const hostRect = e.currentTarget.parentElement.getBoundingClientRect();
                            const rawPeriod = Math.floor((e.clientY - hostRect.top) / rowH);
                            const period = Math.max(0, Math.min(slotsPerDay - 1, rawPeriod));
                            const sid = Number(e.dataTransfer.getData("text/plain"));
                            if (Number.isFinite(sid)) onMoveLesson(sid, di * slotsPerDay + period);
                          }
                        : undefined
                    }
                    style={{
                      position: "absolute",
                      top: `${top}px`,
                      height: `${heightPx - GAP}px`,
                      left: `${leftPct}%`,
                      width: `calc(${widthPct}% - ${GAP}px)`,
                      pointerEvents: "auto",
                      boxSizing: "border-box",
                    }}
                  >
                    <LessonCard
                      lesson={lesson}
                      isHighlighted={highlightedIds?.has(lesson.id)}
                      suppressPopover={
                        searchState === "none"
                        || (searchState === "match" && !highlightedIds?.has(lesson.id))
                      }
                      onPickProblem={onPickProblem}
                      onOpenManual={onOpenManual}
                      onClearOverride={onClearOverride}
                      onTachHocChung={onTachHocChung}
                      detailed={detailed}
                      // draggable dat NGAY TREN the (khong phai div bao ngoai) vi
                      // popover (hint) la state noi bo cua LessonCard - phai dong
                      // no o chinh onDragStart cua the, chuyen event ra ngoai wrapper
                      // roi moi bat lai thi khong con biet popover nao dang mo.
                      // Lop do don vi khac dieu phoi: khoa KHONG duoc doi gio
                      // cua ho, chi duoc nhin (xem webapp/domain/bo_qua.py).
                      canDrag={canDrag && !lesson.boQua}
                      onDragStart={
                        canDrag && !lesson.boQua
                          ? (e) => {
                              e.dataTransfer.setData("text/plain", String(lesson.id));
                              e.dataTransfer.effectAllowed = "move";
                              draggingRef.current = true;
                            }
                          : undefined
                      }
                      // dragend LUON no dung 1 lan/luot keo (dropped hay Esc huy
                      // cung vay) - noi duy nhat chan chac de tat vong lap tu-cuon,
                      // khac onDrop (chi no khi tha DUNG vao 1 o hop le).
                      onDragEnd={canDrag ? stopAutoScroll : undefined}
                      groupColor={
                        colorBy === "status"
                          ? STATUS_COLORS[statusKeyOf(lesson)]
                          : colorBy
                          ? getColor(groupKeyOf(lesson, colorBy))
                          : undefined
                      }
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
