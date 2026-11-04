import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PROBLEM_META } from "../../adapters/problemInbox";

const FALLBACK_COLOR = {
  GUEST: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
  RESIDENT: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
};
const EXTERNAL_UNIT_COLOR = {
  GUEST: { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8" },
  RESIDENT: { bg: "#ccfbf1", border: "#0d9488", text: "#115e59" },
};
const POPOVER_SPACE = 322;

// Theo yeu cau: thay the day-chu-luon-hien bang 1 THANH MAU gon (toi uu dien
// tich) - chi hien CHI TIET DAY DU khi di chuot vao, qua popup dinh vi
// position:fixed (portal vao document.body, tranh bi .schedv2-grid-wrap
// overflow-x:auto cat mat). Bam vao thanh se "GIU" popup mo (khong tu dong
// dong khi roi chuot) - can thiet vi thanh qua mong, di chuot tu thanh sang
// popup de bam nut "Tu choi" de mat vi khoang ho giua 2 vung hover. Bam lai
// (hoac bam nut X trong popup) de dong. 2 kenh mau van tach rieng: nen thanh
// mau = phan loai (groupColor tu LessonGridBoard), vien do khi highlighted =
// canh bao, luon de len tren khong doi mau nen.
const LessonCard = memo(function LessonCard({
  lesson, isHighlighted, onClearOverride, onTachHocChung, groupColor, onPickProblem, onOpenManual, detailed = false,
  canDrag = false, onDragStart, onDragEnd, suppressPopover = false,
}) {
  const problems = lesson.problems ?? [];
  const barRef = useRef(null);
  const [hover, setHover] = useState(false);
  const [locked, setLocked] = useState(false);
  const [rect, setRect] = useState(null);
  const [flipLeft, setFlipLeft] = useState(false);
  const flipLeftRef = useRef(false);

  // Ma lop hoc phan (vd "CSE3003-1") de nhan dien lop - de hon "#<id noi bo>"
  // von khong noi len gi voi giao vu. Fallback ve #id khi lop nao do khong tra
  // duoc ma (khong nen xay ra, nhung tranh hien "undefined").
  const label = lesson.classCode || `#${lesson.id}`;
  const isGuest = lesson.teacherType === "GUEST";
  const teacherType = isGuest ? "GUEST" : "RESIDENT";
  const color = lesson.boQua
    ? EXTERNAL_UNIT_COLOR[teacherType]
    : groupColor || FALLBACK_COLOR[teacherType];

  const measure = (pointerX = null) => {
    if (!barRef.current) return;
    const r = barRef.current.getBoundingClientRect();
    // Neu thanh da cuon ra ngoai man hinh hoan toan, dong popup luon - de no
    // "troi" o mep man hinh khong con tro toi dau ca thi vo nghia hon.
    if (r.bottom < 0 || r.top > window.innerHeight) {
      setHover(false);
      setLocked(false);
      return;
    }
    const leftSpace = r.left;
    const rightSpace = window.innerWidth - r.right;
    let nextFlip = pointerX == null
      ? flipLeftRef.current
      : pointerX > r.left + r.width / 2;
    if (nextFlip && leftSpace < POPOVER_SPACE && rightSpace > leftSpace) nextFlip = false;
    if (!nextFlip && rightSpace < POPOVER_SPACE && leftSpace > rightSpace) nextFlip = true;
    flipLeftRef.current = nextFlip;
    setRect(r);
    setFlipLeft(nextFlip);
  };
  const showPopover = (e) => { if (suppressPopover) return; measure(e.clientX); setHover(true); };
  const keepPopover = () => { measure(); setHover(true); };
  const hidePopover = () => setHover(false);
  const toggleLock = () => {
    if (suppressPopover) return;
    measure();
    setLocked((l) => !l);
  };

  const visible = !suppressPopover && (hover || locked);

  // Dong popover NGAY khi bat dau keo - neu khong, popup mo tu truoc (do hover
  // hoac da bam giu) se troi lai giua man hinh trong luc the dang duoc keo di,
  // che khuat luoi va gay roi mat (dung 1 tay keo, 1 tay khong the tu di chuot
  // ra khoi the de trigger onMouseLeave truoc).
  const handleDragStart = (e) => {
    setHover(false);
    setLocked(false);
    onDragStart?.(e);
  };

  // Popup dung position:fixed (theo viewport) de thoat khoi overflow-x:auto
  // cua .schedv2-grid-wrap, nhung vi vay KHONG tu troi theo khi cuon trang -
  // phai tu do lai vi tri moi lan cuon (dung capture:true de bat duoc ca
  // scroll cua cac vung con cuon rieng, khong chi window).
  useEffect(() => {
    if (!visible) return;
    const onScrollOrResize = () => measure();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // KHONG con gan "dimmed" theo phase (truoc day moi buoi GD1 bi mo di vinh
  // vien mot khi da hien trong trang gop, trong luc no van keo-tha binh
  // thuong duoc - nhin nhu khoa nhung thuc ra khong khoa, mau thuan voi
  // hanh vi thuc).
  const barClass = [
    "lesson-bar",
    detailed ? "detailed" : "",
    // HOC CHUNG can dau hieu nhin thay o CA che do gon: o do khong render
    // `lb-body` nen badge "×N" ben trong khong hien, va mot the gop se trong y
    // nhu mot lop don le - giao vu dem the tren luoi roi doi chieu bang se thay
    // thieu lop ma khong hieu vi sao.
    lesson.hocChung ? "hoc-chung" : "",
    // BUOI THAM CHIEU: lop do don vi khac dieu phoi (Phòng Đào tạo, JLE...) đã có
    // giờ. Khoa không xếp nó nhưng sinh viên khóa đó ĐANG học lúc đó, nên nó phải
    // nằm trên lưới để không ai xếp môn khác đè vào (xem webapp/domain/bo_qua.py).
    // Vẽ khác đi vì nó KHÔNG kéo-thả được — nhìn giống thẻ thường mà kéo không
    // nhúc nhích thì người dùng tưởng hỏng.
    lesson.boQua ? "don-vi-khac" : "",
    isHighlighted ? "highlighted" : "",
    lesson.pendingSave ? "pending-save" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardStyle = {
    "--lesson-color": color.border,
    "--lesson-soft": color.bg,
    "--lesson-text": color.text,
    color: color.text,
  };

  // Chu thich day du cua thanh - dung chung cho title (tooltip he thong) va
  // aria-label (nguoi dung ban phim/doc man hinh nghe duoc dung noi dung nay).
  const nhanThe =
    (lesson.boQua ? "[Đơn vị khác điều phối — khoa không xếp] " : "")
    + (lesson.hocChung
      ? `HỌC CHUNG ${lesson.hocChung.count} môn: `
        + lesson.hocChung.members
            .map((m) => `${m.classCode || `#${m.id}`} ${m.courseName}`)
            .join(" + ")
        + (lesson.hocChung.tongSV ? ` — tổng ${lesson.hocChung.tongSV} SV` : "")
      : `${label} ${lesson.courseName}`)
    + (problems.length > 0
      ? ` — ${problems.map((p) => PROBLEM_META[p.type].label).join(", ")}`
      : "");

  return (
    <>
      <div
        ref={barRef}
        className={barClass}
        style={{ ...cardStyle, cursor: canDrag ? "grab" : undefined }}
        data-short={detailed ? String(lesson.duration || 1) : undefined}
        draggable={canDrag}
        onDragStart={canDrag ? handleDragStart : undefined}
        onDragEnd={canDrag ? onDragEnd : undefined}
        // Tooltip he thong: doc duoc ngay ca truoc khi popover kip hien, va la
        // duong doc du phong khi khong dung duoc chuot.
        title={nhanThe}
        // BAN PHIM: thanh la div nen tu no khong focus duoc. Tab den -> popover
        // hien nhu hover; Enter/Space -> "giu" popup mo (nhu click); Esc -> dong.
        role="button"
        tabIndex={0}
        aria-label={nhanThe}
        aria-expanded={locked}
        onFocus={() => { if (!suppressPopover) { measure(); setHover(true); } }}
        onBlur={() => setHover(false)}
        onKeyDown={(e) => {
          if (suppressPopover) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault(); // Space mac dinh cuon trang
            toggleLock();
          } else if (e.key === "Escape" && locked) {
            setLocked(false);
          }
        }}
        onMouseEnter={showPopover}
        onMouseLeave={hidePopover}
        onClick={toggleLock}
        onDoubleClick={() => onOpenManual?.(lesson)}
      >
        {detailed && (
          <span className="lb-body">
            {/* Toan bo thong tin dong thanh MOT KHOI o dinh the. Truoc day ten GV
                bi day xuong day (margin-top:auto) nen the 3 tiet co mot khoang
                trong lon o giua - nhin nhu loi chu khong nhu chu y. */}
            <span className="lb-top">
              <span className="lb-code">
                {label}
                {lesson.isPinned && <span className="lb-pin" aria-label="đã ghim">📌</span>}
                {problems.length > 0 && <span className="lb-warn" aria-label="có vấn đề">!</span>}
                {/* HOC CHUNG: the nay la MOT buoi cho nhieu ma mon - phai noi ra,
                    khong thi giao vu thay mot the ma bang lai co N lop va tuong
                    he thong bo sot. */}
                {lesson.hocChung && (
                  <span className="lb-hc" aria-label={`học chung ${lesson.hocChung.count} môn`}>
                    ×{lesson.hocChung.count}
                  </span>
                )}
              </span>
              <span className="lb-room">{lesson.roomType}</span>
            </span>
            <span className="lb-course">
              {lesson.hocChung
                ? lesson.hocChung.members.map((m) => m.courseName).join(" + ")
                : lesson.courseName}
            </span>
            <span className="lb-teacher">{lesson.teacherName}</span>
            {/* Neo o day the: giai thich vi sao the cao chung nay. */}
            <span className="lb-dur">{lesson.duration || 1} tiết</span>
          </span>
        )}
      </div>
      {visible && rect && createPortal(
        <div
          className={`lesson-popover ${flipLeft ? "flip-left" : ""} ${locked ? "interactive" : "pass-through"}`}
          style={{
            top: rect.top + rect.height / 2,
            left: flipLeft ? undefined : rect.right + 10,
            right: flipLeft ? window.innerWidth - rect.left + 10 : undefined,
            transform: "translateY(-50%)",
          }}
          onMouseEnter={keepPopover}
          onMouseLeave={hidePopover}
        >
          {locked && (
            <button type="button" className="tt-close-btn" onClick={() => setLocked(false)} aria-label="Đóng">×</button>
          )}
          <div className="tt-row-top">
            <span className="tt-major" style={{ background: color.bg, color: color.text }}>
              {isGuest ? "THỈNH GIẢNG" : "CƠ HỮU"}
            </span>
            <span className="tt-section">{label}</span>
            {/* Truoc day co them badge "[da chot GD1]" o day, nhung no LUON
                trung voi pill THINH GIANG/CO HUU ngay ben canh (moi buoi
                thinh giang la GD1, moi buoi co huu la GD2 - khong co truong
                hop khac) nen la thong tin lap lai, da bo. */}
            {lesson.boQua && <span className="lesson-dvk-badge">ĐƠN VỊ KHÁC</span>}
            {lesson.isCoTeaching && <span className="lesson-shared-badge">ĐỒNG GIẢNG</span>}
            {lesson.hocChung && (
              <span className="lesson-hc-badge">HỌC CHUNG {lesson.hocChung.count} MÔN</span>
            )}
          </div>
          <div className="tt-name">
            {lesson.hocChung
              ? lesson.hocChung.members.map((m) => m.courseName).join(" + ")
              : lesson.courseName}
          </div>

          {/* Vi sao the nay khong keo-tha duoc, noi ngay tren the thay vi de nguoi
              dung thu keo roi tu doan. */}
          {lesson.boQua && (
            <div className="tt-dvk">
              Đơn vị khác điều phối — khoa không xếp và không đổi giờ lớp này. Giờ đã chốt
              nên nó vẫn nằm đây để không ai xếp môn khác của khóa này đè vào.
            </div>
          )}

          {/* HOC CHUNG: mot buoi day, nhieu ma mon. Ke ro tung mon kem si so de
              giao vu biet phong phai chua bao nhieu nguoi - day la ly do chinh de
              gop chu khong chi de do bao trung gio. */}
          {lesson.hocChung && (
            <div className="tt-hc">
              <div className="tt-label">Các lớp học chung buổi này</div>
              {lesson.hocChung.members.map((m) => (
                <div key={m.id} className="tt-hc-row">
                  <span className="tt-hc-code">{m.classCode || `#${m.id}`}</span>
                  <span className="tt-hc-name">{m.courseName}</span>
                  <span className="tt-hc-sv">
                    {m.expectedStudents != null ? `${m.expectedStudents} SV` : "— SV"}
                  </span>
                </div>
              ))}
              {lesson.hocChung.tongSV != null && (
                <div className="tt-hc-tong">
                  Tổng <strong>{lesson.hocChung.tongSV} sinh viên</strong> — phòng phải chứa đủ
                </div>
              )}
              {/* TACH NHOM: dat ngay trong khoi dang liet ke nhom - do la cho
                  nguoi dung dang xem nhom nen cung la cho ho quyet dinh bo no,
                  giong cach nut "Bo ghim" nam trong khoi ghim ben duoi. */}
              {onTachHocChung && (
                <button
                  type="button"
                  className="tt-hc-btn"
                  title={
                    "Tách nhóm: các lớp trở lại độc lập. Từ lần Giải sau hệ thống "
                    + "lại xếp chúng riêng và báo trùng giảng viên nếu vẫn cùng giờ."
                  }
                  onClick={() => { onTachHocChung(lesson.hocChung.id); setLocked(false); }}
                >
                  Tách nhóm — không học chung nữa
                </button>
              )}
            </div>
          )}

          {/* Thanh mau do bao "co van de" - nhung mau khong noi duoc VAN DE GI.
              Popover phai tra loi cau do, neu khong thi mau chi la bao dong suong. */}
          {problems.length > 0 && (
            <div className="tt-problems">
              {problems.map((p) => {
                const meta = PROBLEM_META[p.type];
                // Ma lop hoc phan (vd "CSE3003-1") de hien THAY CHO "#<id noi
                // bo>" - p.sections da duoc buildProblemInbox() gan san
                // classCode cho tung buoi, chi can tra theo sectionId.
                const codeById = new Map(
                  (p.sections ?? []).map((s) => [s.sectionId ?? s.id, s.classCode]),
                );
                const other = (p.sectionIds?.filter((sid) => sid !== lesson.id) ?? [])
                  .map((sid) => codeById.get(sid) || `#${sid}`);
                const dropped = p.unplacedIds?.includes(lesson.id);
                return (
                  <div key={p.id} className={`tt-problem ${meta.cls}`}>
                    <div className="tt-problem-hd">
                      <span className="tt-problem-dot" aria-hidden="true" />
                      {meta.label}
                    </div>
                    <div className="tt-problem-body">
                      {/* Moi loai mot cach dien dat rieng: nhom "chua co gio" gom
                          theo DIEU PHOI VIEN, cac buoi trong nhom KHONG dung nhau
                          - viet "dung voi" o day la sai. */}
                      {p.type === "MISSING_HOURS" ? (
                        <>
                          Chưa có khung giờ nào được báo cho buổi này — giờ đang thấy trên lưới là do
                          thuật toán tự chọn trong cả tuần, chưa phải giờ điều phối viên xác nhận.
                        </>
                      ) : (
                        <>
                          {other.length > 0 && (
                            <>Đụng với <strong>{other.join(", ")}</strong>{p.when ? ` tại ${p.when}` : ""}. </>
                          )}
                          {dropped && <strong>Buổi này bị bỏ lại, không có trên lịch cuối.</strong>}
                        </>
                      )}
                    </div>
                    <div className="tt-problem-fix">{meta.fix}</div>
                    {onPickProblem && (
                      <button
                        type="button"
                        className="tt-problem-btn"
                        onClick={() => { onPickProblem(p); setLocked(false); }}
                      >
                        Mở trong hộp thư vấn đề →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="tt-teacher-row">
            <span className="tt-label">Giảng viên</span>
            <strong>{lesson.teacherName}</strong>
          </div>
          <div className="tt-details">
            <div className="tt-detail-col">
              <span className="tt-label">Chương trình</span>
              <span className="tt-val">{lesson.programLabel}</span>
            </div>
            <div className="tt-detail-col">
              <span className="tt-label">Phòng</span>
              <span className="tt-val">{lesson.roomType}</span>
            </div>
          </div>
          {/* ĐỊA ĐIỂM (cơ sở) — hai cơ sở Hòa Lạc / Mỹ Đình cách nhau rất xa,
              một giảng viên không đi kịp trong ngày. Phải hiện ở đây để giáo vụ
              đối chiếu ngay được; `khacCoSo` là cảnh báo đã tính sẵn cho đúng
              ngày đó (xem adapters/problemInbox.js: scanKhacCoSo). */}
          {lesson.location && (
            <div className="tt-room-row">
              <span className="tt-label">Địa điểm</span>
              <span className="tt-val">
                {lesson.location}
                {lesson.khacCoSo && (
                  <strong className="text-amber-700">
                    {" "}
                    — ⚠ giảng viên còn dạy ở {lesson.khacCoSo} cùng ngày
                  </strong>
                )}
              </span>
            </div>
          )}
          <div className="tt-room-row">
            <span className="tt-label">Thời lượng</span>
            <span className="tt-val">{lesson.duration || 1} tiết{lesson.usedWindowLabel ? ` · ${lesson.usedWindowLabel}` : ""}</span>
          </div>

          {/* Buoi da bi keo-tha sua tay (ghim). Thay cho nut "Tu choi - luan
              chuyen" cu - gio keo-tha sang o khac lam viec do, popup nay chi con
              hien TRANG THAI ghim + cho bo ghim. */}
          {lesson.override && (
            <div className={`tt-pin-box ${lesson.override.problem ? "warn" : ""}`}>
              <div className="tt-pin-head">
                <span aria-hidden="true">📌</span> Đã ghim (sửa tay)
                {lesson.override.pinFailed && <span className="tt-pin-failed">— bị bỏ lại khi giải lại</span>}
              </div>
              {lesson.override.reason && <div className="tt-pin-reason">“{lesson.override.reason}”</div>}
              {lesson.override.problem?.teacherClashIds?.length > 0 && (
                <div className="tt-pin-conflict">
                  Đang trùng giờ với #{lesson.override.problem.teacherClashIds.join(", #")}
                </div>
              )}
              {lesson.override.problem?.roomFull && (
                <div className="tt-pin-conflict">
                  Hết phòng ({lesson.override.problem.sameRoomCount}/{lesson.override.problem.pool})
                </div>
              )}
              {onClearOverride && (
                <button
                  type="button"
                  className="tt-unpin-btn"
                  // Bo ghim = THA LOP RA cho he thong xep lai - ke ca khi gio nay
                  // la gio da chot trong file. Noi ro o title vi khong the doan
                  // duoc tu chu "Bo ghim": lop van dung yen cho den lan giai sau.
                  title="Thả lớp này ra để hệ thống xếp lại ở lần giải kế tiếp (kể cả giờ đã chốt trong file). Vị trí hiện tại chưa đổi ngay."
                  onClick={() => { onClearOverride(lesson.id); setLocked(false); }}
                >
                  Bỏ ghim — để hệ thống xếp lại
                </button>
              )}
            </div>
          )}

          {!locked && <div className="tt-hint">Bấm để giữ popup này mở</div>}
        </div>,
        document.body,
      )}
    </>
  );
});

export default LessonCard;
