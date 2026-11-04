import { useEffect, useRef, useState } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppTopbar } from '@/components/layout/app-topbar';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { cn } from '@/lib/utils';

const SIDEBAR_KEY = 'tkb_sidebar_collapsed';
// Khop `duration-200` cua <aside> trong app-sidebar.jsx.
const SIDEBAR_ANIMATION_MS = 200;

/**
 * Man "Thoi khoa bieu" chua luoi tuan + hop thu van de, "Du lieu hoc phan" chua
 * bang mirror 29 cot Excel - ca hai can toan bo be ngang. Sidebar mo (256px) an
 * mat cho, nen vao hai trang nay thanh ben tu thu ve rail icon (64px).
 */
const WIDE_PAGES = new Set(['schedule', 'manual']);

function loadCollapsed() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * App-shell phong cach e-gov (dong bo app Nhap hoc VJU):
 * topbar trang -> [sidebar 2 cap | page header + noi dung].
 */
export function AppLayout({
  page,
  sub,
  role,
  title,
  crumbs,
  actions,
  onNavigate,
  onChangeRole,
  children,
  footer,
  // Bo padding quanh vung noi dung cho trang tu lo bo cuc sat mep. Dung cho man
  // co bang rong hon man hinh (bang mirror 29 cot): moi px be ngang deu dang gia,
  // ngoi trong the co padding chi lam no phai cuon ngang som hon can thiet.
  bleed = false,
  // Trang CHIEM TRON chieu cao con lai va TU LO cuon doc, thay vi de <main> cuon
  // ca trang. Can cho man co bang "dong bang" hang tieu de / cot dau (freeze
  // panes): `position: sticky` luon bam vao KHUNG CUON GAN NHAT, ma khung cuon
  // ngang cua bang (overflow-x) da la mot khung cuon roi - neu cuon doc van do
  // <main> lo thi thead sticky se bam nham vao khung cuon cua bang (khung do
  // khong bao gio cuon doc) va khong dinh duoc gi ca.
  //
  // Doi lai, trang phai tu chia: khoi nao dung yen, khoi nao cuon. Xem
  // ManualEntryPage - thanh cong cu thanh flex item co dinh, bang lay
  // `min-h-0 flex-1`.
  fullHeight = false,
}) {
  const [collapsed, setCollapsedState] = useState(loadCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const wide = WIDE_PAGES.has(page);
  // Lua chon cua nguoi dung RIENG cho trang rong hien tai; doi trang thi quen di,
  // de roi trang rong la sidebar tro lai dung thoi quen thuong ngay cua ho.
  const [wideOverride, setWideOverride] = useState(null);
  useEffect(() => setWideOverride(null), [page]);

  const effectiveCollapsed = wide ? (wideOverride ?? true) : collapsed;

  // Trang Thoi khoa bieu co hang tram o kinh (backdrop-filter) ma be ngang doi
  // moi khung hinh khi sidebar truot -> trinh duyet phai lam mo lai tung o moi
  // frame nen giat. Chi trong luc sidebar dang chuyen dong, theme.css tam bo
  // blur o VUNG NOI DUNG (sidebar/topbar van kinh); xong thi kinh tro lai.
  const [sidebarMoving, setSidebarMoving] = useState(false);
  const movingTimer = useRef(null);
  useEffect(() => () => clearTimeout(movingTimer.current), []);
  function markSidebarMoving() {
    setSidebarMoving(true);
    clearTimeout(movingTimer.current);
    movingTimer.current = setTimeout(() => setSidebarMoving(false), SIDEBAR_ANIMATION_MS + 60);
  }

  function setCollapsed(v) {
    if (page === 'schedule' && v !== effectiveCollapsed) markSidebarMoving();
    // Chi ghi nho thoi quen o trang thuong. Thu gon tu dong o trang rong la do
    // bo cuc bat buoc, khong phai y muon cua nguoi dung - ghi lai se lam ho bi
    // sidebar thu gon o moi trang khac ma khong hieu tai sao.
    if (wide) {
      setWideOverride(v);
      return;
    }
    setCollapsedState(v);
    try {
      localStorage.setItem(SIDEBAR_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  // Dong drawer khi dieu huong hoac khi phong len desktop.
  useEffect(() => setMobileOpen(false), [page, sub]);
  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  // Nut topbar: desktop -> thu gon rail; mobile -> mo/dong drawer.
  const onToggleSidebar = () =>
    isDesktop ? setCollapsed(!effectiveCollapsed) : setMobileOpen((o) => !o);

  // Do chieu cao THAT cua page header roi phoi ra bien --page-header-h, de trang
  // con muon dinh them mot thanh nua (vd thanh cong cu cua bang) chi can
  // `sticky top-[var(--page-header-h)]`.
  //
  // Phai DO chu khong hard-code: chieu cao doi theo breakpoint (pt-4 -> md:pt-5,
  // text-xl -> md:text-2xl) va theo viec trang do co crumbs hay khong. Hard-code
  // mot con so se lech o dung mot trong bon to hop do.
  const headerRef = useRef(null);
  const [headerH, setHeaderH] = useState(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) {
      setHeaderH(0);
      return;
    }
    const measure = () => setHeaderH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [title, crumbs]);

  return (
    <div
      className="liquid-canvas liquid-shell flex h-dvh flex-col"
      data-sidebar-moving={sidebarMoving ? 'true' : undefined}
    >
      <AppTopbar
        collapsed={effectiveCollapsed}
        onToggleSidebar={onToggleSidebar}
        role={role}
        onChangeRole={onChangeRole}
      />
      <div className="flex min-h-0 flex-1">
        {/* Nền mờ khi mở drawer trên mobile (bấm để đóng) */}
        {mobileOpen && (
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-x-0 top-12 bottom-0 z-40 bg-black/40 lg:hidden"
          />
        )}
        <AppSidebar
          page={page}
          sub={sub}
          role={role}
          collapsed={isDesktop ? effectiveCollapsed : false}
          mobileOpen={mobileOpen}
          onSetCollapsed={setCollapsed}
          onNavigate={onNavigate}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main
            className={cn(
              'flex-1',
              fullHeight
                ? 'flex min-h-0 flex-col overflow-hidden'
                : 'overflow-y-auto',
            )}
            style={{ '--page-header-h': `${headerH}px` }}
          >
            {title && (
              <div
                ref={headerRef}
                className="glass-page-header sticky top-0 z-20 flex flex-wrap items-end justify-between gap-3 border-b px-4 pt-4 pb-3 md:px-6 md:pt-5"
              >
                <div>
                  {crumbs && (
                    <p className="text-muted-foreground text-xs">{crumbs}</p>
                  )}
                  <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                    {title}
                  </h1>
                </div>
                {actions && (
                  <div className="flex flex-wrap items-center gap-2">
                    {actions}
                  </div>
                )}
              </div>
            )}
            <div
              className={cn(
                !bleed && 'p-4 pt-3 md:p-6 md:pt-4',
                fullHeight && 'flex min-h-0 flex-1 flex-col',
              )}
            >
              {children}
            </div>
            {/* Trang full-height khong co cho cho footer: <main> khong cuon nua
                nen footer se bi dan cung o day man hinh o MOI luc, an mat mot
                dai chieu cao ma man bang can. Noi dung footer la chu thich tinh
                (thuat toan, nguon du lieu) - khong mat gi khi vang o day. */}
            {!fullHeight && footer}
          </main>
        </div>
      </div>
    </div>
  );
}
