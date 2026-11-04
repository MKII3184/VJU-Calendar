import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  NAV_HOME,
  PAGE_LABELS,
  VIEWER_ALLOWED_KEYS,
  firstSubKey,
  subLabel,
} from "./constants/nav";
import { EventLogProvider } from "./context/EventLogContext";
import { AppDataProvider } from "./context/AppDataContext";
import Footer from "./presentation/Footer";
import RolePickerScreen from "./presentation/RolePickerScreen";
import DataPage from "./presentation/pages/DataPage";
import SchedulePage from "./presentation/pages/SchedulePage";
import HistoryPage from "./presentation/pages/HistoryPage";
import ManualEntryPage from "./presentation/pages/ManualEntryPage";
import GuidePage from "./presentation/pages/GuidePage";
import { readUrlState, writeUrlState } from "./adapters/urlState";

const PAGES = {
  data: DataPage,
  schedule: SchedulePage,
  history: HistoryPage,
  manual: ManualEntryPage,
  guide: GuidePage,
};

// "Dang nhap" o day chi la chon vai trò (xem RolePickerScreen) - truoc day
// role song trong React state THUAN, khong luu o dau ca, nen bam F5 la mat:
// toan cay component (ke ca AppShell) mount lai tu dau, role ve lai null ->
// hien RolePickerScreen, du activePage/sub/filter van con nho dung nho URL
// hash (xem urlState.js). Luu vao localStorage - cung pattern voi SIDEBAR_KEY
// o app-layout.jsx - de F5 giu duoc vai tro dang chon, giong cach cac trang
// khac giu duoc vi tri dang xem.
const ROLE_KEY = "tkb_role";

function loadRole() {
  if (typeof window === "undefined") return null;
  try {
    const r = localStorage.getItem(ROLE_KEY);
    return r === "staff" || r === "viewer" ? r : null;
  } catch {
    return null;
  }
}

function saveRole(r) {
  try {
    if (r) localStorage.setItem(ROLE_KEY, r);
    else localStorage.removeItem(ROLE_KEY);
  } catch {
    /* ignore */
  }
}

// getAllowedGroups() chi loc MUC hien tren sidebar - no khong chan viec render
// PAGES[activePage]. Neu khong kep lai, mot vai tro "Xem thoi" co the lot vao
// trang co the sua (vd dang o "data" roi bam "Doi vai tro" -> chon lai "Xem
// thoi": activePage van la "data" tu truoc, muc da an nhung trang van hien
// nguyen vi khong ai reset activePage). Kep o DUY NHAT 1 cho khi role doi, thay
// vi rai kiem tra o tung trang.
function clampPageForRole(page, role) {
  if (role !== "viewer") return page;
  return VIEWER_ALLOWED_KEYS.includes(page) ? page : "schedule";
}

// "Du lieu hoc phan" la bang mirror 29 cot Excel - rong hon man hinh ngay ca o
// man rong nhat. Cho no tran sat mep vung noi dung thay vi ngoi trong the co
// padding: moi px be ngang deu dang gia. Cac trang con lai giu padding chuan.
const BLEED_PAGES = new Set(["manual"]);

// Trang TU LO cuon doc thay vi de <main> cuon ca trang (xem `fullHeight` trong
// AppLayout). "Du lieu hoc phan" can dieu nay de DONG BANG hang tieu de 2 tang +
// 5 cot dau cua bang: sticky chi bam duoc vao khung cuon gan nhat, nen chinh
// khung cuon cua bang phai la thu cuon doc.
const FULL_HEIGHT_PAGES = new Set(["manual"]);

function AppShell() {
  const [role, setRoleState] = useState(loadRole);
  const setRole = (r) => {
    setRoleState(r);
    saveRole(r);
  };
  const initial = readUrlState();
  const [activePage, setActivePage] = useState(initial.page || "data");
  const [sub, setSub] = useState(initial.sub);
  const [filter, setFilter] = useState(initial.filter);
  const [manualViewState, setManualViewState] = useState();
  const [manualFocusRequest, setManualFocusRequest] = useState(null);

  // Ghi lai SAFE PAGE (sau kep), khong ghi activePage tho - neu khong URL co the
  // noi "p=data" trong luc noi dung dang hien thuc te la "schedule" (da bi kep
  // vi role viewer), gay lech giua URL va man dang thay.
  useEffect(() => {
    writeUrlState({ page: clampPageForRole(activePage, role), sub, filter });
  }, [activePage, sub, filter, role]);

  if (!role) {
    return (
      <RolePickerScreen
        onPick={(r) => {
          setRole(r);
          // CA HAI vai tro deu vao thang "Thoi khoa bieu". Truoc day Giao vu roi
          // vao "Khung gio da bao" - mot man GIUA quy trinh, va khong con khop
          // voi thu tu sidebar sau khi xep lai. Man Thoi khoa bieu moi la cho
          // dung: thanh tien trinh tren do noi ro dang thieu buoc nao (thu gio
          // bao nhieu, da giai chua), tu no dan nguoi dung di tiep.
          const next = clampPageForRole(initial.page || NAV_HOME.key, r);
          setActivePage(next);
          setSub(initial.sub ?? firstSubKey(next));
        }}
      />
    );
  }

  // Kep lai ngay ca khi role da co san (vd URL doi hash trong luc dang xem, hoac
  // component nay re-mount) - khong chi luc chon role o RolePickerScreen.
  const safePage = clampPageForRole(activePage, role);
  const ActivePageComponent = PAGES[safePage] || DataPage;

  // Sidebar cap 2 truyen ca (page, sub). Bam vao NHOM (sub = null) thi rot ve
  // muc con dau tien - nhom khong co man rieng, no chi la cai vo.
  const goto = (pageKey, subKey) => {
    setActivePage(pageKey);
    setSub(subKey ?? firstSubKey(pageKey));
  };

  const openManualSections = (targets) => {
    setManualFocusRequest((current) => ({ targets, seq: (current?.seq ?? 0) + 1 }));
    goto("manual");
  };

  const currentSubLabel = subLabel(safePage, sub);

  return (
    <AppLayout
      page={safePage}
      sub={sub}
      role={role}
      // Co muc con -> ten muc con lam tieu de, ten nhom lam duong dan phia tren.
      title={currentSubLabel ?? PAGE_LABELS[safePage]}
      crumbs={currentSubLabel ? PAGE_LABELS[safePage] : null}
      bleed={BLEED_PAGES.has(safePage)}
      fullHeight={FULL_HEIGHT_PAGES.has(safePage)}
      onNavigate={goto}
      onChangeRole={() => setRole(null)}
      footer={<Footer />}
    >
      <ActivePageComponent
        role={role}
        sub={sub}
        onSubChange={setSub}
        filter={filter}
        onFilterChange={setFilter}
        viewState={manualViewState}
        onViewStateChange={setManualViewState}
        focusRequest={manualFocusRequest}
        onFocusHandled={(seq) => setManualFocusRequest((request) => request?.seq === seq ? null : request)}
        onOpenManualSections={openManualSections}
      />
    </AppLayout>
  );
}

export default function App() {
  return (
    <EventLogProvider>
      <AppDataProvider>
        <AppShell />
      </AppDataProvider>
    </EventLogProvider>
  );
}
