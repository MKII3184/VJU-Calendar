// Bo loc va man dang xem duoc giu tren URL (hash), khong giu trong state cuc bo.
//
// Vi sao bat buoc phai co khi gop man: sau khi gop, thu nguoi dung dang nhin
// hoan toan do BO LOC quyet dinh. Neu bo loc chi song trong state React thi
// khong gui duoc link cho nhau ("xem giup lich cua GV#3"), va bam Back/F5 la
// mat cho - luc do gop xong lai kho dung hon truoc khi gop.

import { DEFAULT_FILTER } from "./scheduleView";

const BOOL_KEYS = ["guest", "resident", "onlyProblems", "chiXemPhamVi"];
const LIST_KEYS = ["programs", "khoas"];

export function readUrlState() {
  const raw = window.location.hash.replace(/^#/, "");
  const q = new URLSearchParams(raw);
  const page = q.get("p") || null;
  const sub = q.get("s") || null;

  const filter = { ...DEFAULT_FILTER };
  for (const [k, v] of q.entries()) {
    if (k === "p" || k === "s") continue;
    if (!(k in filter)) continue;
    filter[k] = BOOL_KEYS.includes(k) ? v === "1" : LIST_KEYS.includes(k) ? v.split(",").filter(Boolean) : v;
  }

  // LINK CU: #scope=program|cohort&scopeValue=X, hoac khoa=X - chuyen sang cac o
  // loc da lua chon (programs / khoas) de link cu khong mo ra mot man khong loc gi.
  const legacy = q.get("scopeValue");
  if (legacy && q.get("scope") === "program") filter.programs = [legacy];
  if (legacy && q.get("scope") === "cohort") filter.khoas = [legacy];
  if (q.get("khoa") && !q.get("khoas")) filter.khoas = [q.get("khoa")];
  return { page, sub, filter };
}

export function writeUrlState({ page, sub, filter }) {
  const q = new URLSearchParams();
  if (page) q.set("p", page);
  if (sub) q.set("s", sub);

  // Chi ghi cai KHAC mac dinh - de URL ngan va de doc.
  for (const [k, def] of Object.entries(DEFAULT_FILTER)) {
    const v = filter?.[k];
    if (v === undefined || v === def) continue;
    if (LIST_KEYS.includes(k)) {
      if (v.length) q.set(k, v.join(","));
      continue;
    }
    q.set(k, BOOL_KEYS.includes(k) ? (v ? "1" : "0") : String(v));
  }

  const next = `#${q.toString()}`;
  if (next !== window.location.hash) {
    window.history.replaceState(null, "", next);
  }
}
