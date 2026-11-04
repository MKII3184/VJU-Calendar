import { useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckSquare,
  FileSpreadsheet,
  Info,
  LayoutGrid,
  ListOrdered,
} from 'lucide-react';
import { Notice } from '@/components/shared/notice';
import { Pill, TONE_DOT } from '@/components/shared/pill';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

/** Nhan vai tro dung lai xuyen suot trang huong dan. */
const ROLE_MAP = {
  staff: { label: 'Giáo vụ / Điều phối viên', tone: 'violet' },
  viewer: { label: 'Xem thôi', tone: 'slate' },
  tester: { label: 'Tester', tone: 'blue' },
};
function RoleTag({ role, className }) {
  const cfg = ROLE_MAP[role];
  return (
    <Pill tone={cfg.tone} dot className={cn('px-2.5 py-1', className)}>
      {cfg.label}
    </Pill>
  );
}

/**
 * The le doc rieng cho trang nay - Panel dung chung qua nho (text-sm title) cho
 * mot the KPI/bang gon, khong hop voi noi dung doc dai. Card ~700-760px de dong
 * chu khong qua rong, tieu de lon hon han than bai de mat de quet muc.
 */
function Card({ title, description, children, className }) {
  return (
    <section className={cn('glass-panel rounded-xl border p-5 sm:p-6', className)}>
      {title && (
        <h3 className="text-base font-bold tracking-tight">{title}</h3>
      )}
      {description && (
        <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
      )}
      <div className={cn('text-[15px] leading-relaxed', (title || description) && 'mt-3')}>
        {children}
      </div>
    </section>
  );
}

const SECTIONS = [
  { key: 'tong-quan', label: 'Tổng quan', icon: Info },
  { key: 'luong', label: 'Luồng làm việc', icon: ListOrdered },
  { key: 'man-hinh', label: 'Màn hình chính', icon: LayoutGrid },
  { key: 'excel', label: 'Nhập từ Excel', icon: FileSpreadsheet },
  { key: 'thuat-ngu', label: 'Thuật ngữ', icon: BookOpenCheck },
  { key: 'checklist', label: 'Checklist kiểm thử', icon: CheckSquare },
  { key: 'gioi-han', label: 'Giới hạn & FAQ', icon: AlertTriangle },
];

const WORKFLOW_STEPS = [
  {
    title: 'Nhập dữ liệu học phần',
    desc: 'Tại "Dữ liệu học phần": gõ tay từng lớp, hoặc "Nhập từ Excel" để nạp nhanh từ file kế hoạch giảng dạy kỳ trước.',
  },
  {
    title: 'Thu khung giờ giảng viên',
    desc: 'Tại "Chuẩn bị dữ liệu": mỗi giảng viên báo khung giờ có thể dạy. Lớp chưa có giờ ở trạng thái chờ, chưa được đưa vào giải.',
  },
  {
    title: 'Giải Giai đoạn 1 — xếp thỉnh giảng',
    desc: 'Xếp giảng viên thỉnh giảng (GUEST) trước, theo đúng khung giờ đã báo — nhóm này ít linh hoạt về giờ nên ưu tiên xếp trước.',
  },
  {
    title: 'Giải Giai đoạn 2 — ghép cơ hữu',
    desc: 'Xếp tiếp giảng viên cơ hữu (RESIDENT), hệ thống xếp phần còn lại xung quanh những gì Giai đoạn 1 đã cố định.',
  },
  {
    title: 'Kiểm tra & sửa tay',
    desc: 'Xem lưới Thời khoá biểu, mở hộp thư "Vấn đề" để rà trùng lịch, kiểm tra tab "Chưa xếp được". Kéo-thả sửa trực tiếp tạo một "ghim" giữ nguyên khi giải lại.',
    testerToo: true,
  },
  {
    title: 'Xuất kết quả',
    desc: '"Xuất file" để tải thời khoá biểu theo khuôn FATE, hoặc "Lưu thời khoá biểu" để ghi kết quả đang xếp trở lại vào dữ liệu học phần.',
  },
];

const SCREENS = [
  {
    icon: '📅',
    title: 'Thời khoá biểu',
    desc: 'Trang chủ. Lưới tuần hiển thị toàn bộ buổi học đã xếp.',
    items: [
      'Thanh tiến trình 3 bước: Thu giờ → Xếp thỉnh giảng → Ghép cơ hữu',
      'Hộp thư "Vấn đề" — báo trùng lịch giảng viên/phòng',
      'Tab "Chưa xếp được" (xem mục Thuật ngữ)',
      'Kéo-thả một buổi để sửa giờ/phòng thủ công',
    ],
  },
  {
    icon: '📋',
    title: 'Dữ liệu học phần',
    desc: 'Bảng nhập liệu chính — mirror đúng 29 cột của file Excel gốc.',
    items: [
      'Thêm/sửa từng lớp bằng tay',
      'Nhập từ Excel · Xuất file',
      'Xóa giờ hàng loạt',
      'Bắt đầu học kỳ mới (xóa sạch để làm lại)',
    ],
  },
  {
    icon: '🗂️',
    title: 'Chuẩn bị dữ liệu',
    desc: '2 tab con, dùng trước khi giải.',
    items: [
      '"Học phần" — việc cần làm theo lớp: chưa có giảng viên (bấm "Phân công giảng viên") hay đã có giảng viên nhưng chưa khai giờ (bấm "Nhập giờ")',
      '"Giảng viên" — danh sách giảng viên (cơ hữu/thỉnh giảng), sửa thông tin và khai giờ có thể dạy',
    ],
  },
  {
    icon: '🕓',
    title: 'Nhật ký & bản lưu',
    desc: '2 tab con, dùng để tra cứu / đối chiếu.',
    items: [
      '"Nhật ký thao tác" — lịch sử hành động trong phiên',
      '"Bản đã lưu" — các thời khoá biểu đã "Lưu" trước đó',
    ],
  },
];

const EXCEL_RULES = [
  ['Ô gộp dọc theo học phần', 'đổi tên học phần thì mọi giá trị kế thừa (mã HP, LT, TH…) bị cắt và đọc lại từ dòng mới — tránh học phần sau "ăn ké" dữ liệu học phần trước.'],
  ['Một ô nhiều buổi/tuần', 'cột Thứ / Tiết đầu / Tiết cuối có thể chứa nhiều dòng giá trị trong cùng một ô — mỗi dòng ghép thành một buổi, mỗi buổi tách thành một lớp riêng cùng mã lớp.'],
  ['Hai nguồn giờ song song', 'có file vừa có cột giờ dạng cấu trúc (Thứ/Tiết) vừa có cột text tự do — khi hai cột lệch nhau, hệ thống ưu tiên cột text.'],
  ['Gộp giảng viên theo tên', 'không theo tên + đơn vị, vì cùng một người hay bị ghi đơn vị khác nhau giữa các dòng. Hệ quả: hai người trùng họ tên thật sẽ bị gộp làm một (hiếm, chấp nhận được).'],
  ['Lớp chưa phân công GV vẫn được nạp', 'đánh dấu "(Chưa phân công)", mỗi lớp giữ một bản ghi placeholder riêng để tránh báo trùng lịch giả giữa các lớp chưa phân công với nhau.'],
  ['Bản xem trước gom theo nhóm lý do', 'ví dụ "32 dòng không được nạp vì ô GV ghi tên đơn vị điều phối", kèm số dòng Excel gốc để đối chiếu — không phải danh sách phẳng.'],
];

const GLOSSARY = [
  {
    term: 'Giai đoạn 1 / Giai đoạn 2',
    tone: 'blue',
    def: 'Không phải hai màn hình khác nhau, mà là hai lượt chạy của cùng một thuật toán giải: Giai đoạn 1 xếp giảng viên thỉnh giảng (GUEST) theo đúng khung giờ đã báo; Giai đoạn 2 xếp tiếp giảng viên cơ hữu (RESIDENT) xung quanh kết quả đó.',
  },
  {
    term: 'Quy tắc ngày dạy',
    tone: 'amber',
    def: 'Giảng viên thỉnh giảng (GUEST) được xếp dạy đến hết Thứ 7; giảng viên cơ hữu (RESIDENT) chỉ được xếp đến hết Thứ 6. Riêng khi nạp từ Excel, một buổi vi phạm quy tắc này chỉ bị bỏ giờ (và cảnh báo), không làm rớt cả lớp.',
  },
  {
    term: 'Tab "Chưa xếp được"',
    tone: 'red',
    def: 'Nằm trong hộp thư "Vấn đề" ở màn Thời khoá biểu. Chỉ liệt kê những buổi đã có giờ cụ thể nhưng bị trùng lịch hoặc hết phòng — không bao gồm các lớp còn ở trạng thái chờ vì giảng viên chưa nộp giờ.',
  },
  {
    term: 'Ghim (override)',
    tone: 'violet',
    def: 'Khi kéo-thả sửa tay một buổi học, hệ thống lưu lại lựa chọn đó như một ràng buộc riêng. Lần giải lại sau đó vẫn giữ nguyên buổi đã ghim, không bị thuật toán xếp đè lên.',
  },
  {
    term: 'Nhập 2 bước',
    tone: 'emerald',
    def: 'Quy trình nhập Excel tách rời bước đọc/xem trước (không ghi gì) và bước xác nhận nạp (xóa dữ liệu cũ, ghi dữ liệu mới, không hoàn tác).',
  },
  {
    term: 'Hiển thị mã lớp',
    tone: 'slate',
    def: 'Các thẻ và hộp thoại liên quan đến lịch hiện mã lớp học phần (ví dụ CS101-01) thay vì mã số nội bộ, để nhận diện lớp nhanh hơn.',
  },
  {
    term: '(Chưa phân công)',
    tone: 'slate',
    def: 'Nhãn cho lớp nạp từ Excel nhưng ô giảng viên bị bỏ trống hoặc chỉ ghi tên đơn vị điều phối. Có cờ nội bộ riêng để không bị tính nhầm trùng lịch, bị lọc khỏi màn "Giảng viên", và hiện riêng trong nhóm "Chưa phân công giảng viên" ở tab "Học phần" — bấm "Phân công giảng viên" để chọn người thật.',
  },
];

const CHECKLIST_GROUPS = [
  {
    group: 'Vai trò & điều hướng',
    items: [
      'Vai trò "Xem thôi" không vào được các trang nhập liệu — chỉ Thời khoá biểu, Nhật ký & bản lưu, Hướng dẫn sử dụng.',
      'Đổi vai trò không cần khởi động lại app — dữ liệu hiển thị phải giống nhau giữa hai vai trò vì dùng chung trạng thái server.',
    ],
  },
  {
    group: 'Nhập dữ liệu học phần',
    items: [
      'Bước xem trước Excel không thay đổi dữ liệu hiện có (đếm số lớp trước/sau khi mở hộp thoại, chưa xác nhận).',
      'Số liệu bản xem trước khớp số liệu sau khi nạp (tổng số lớp, học phần, giảng viên).',
      'File có ô gộp dọc đổi tên học phần giữa chừng không bị "ăn ké" dữ liệu dòng trước.',
      'Lớp nhiều buổi/tuần trong cùng một ô Excel được tách đúng số dòng, cùng mã lớp.',
      'Sửa tay một lớp vừa nhập từ Excel vẫn được (không bị khoá nút sửa).',
      '"Bắt đầu học kỳ mới" xóa sạch, không còn dữ liệu học kỳ cũ ở bất kỳ màn nào.',
    ],
  },
  {
    group: 'Giải thuật toán',
    items: [
      'Lớp chưa nộp giờ giảng viên không xuất hiện trong kết quả giải.',
      'Không có GUEST bị xếp sau Thứ 7, không có RESIDENT bị xếp sau Thứ 6.',
      'Giải lại Giai đoạn 2 không xoá kết quả Giai đoạn 1 đã có.',
      'Buổi đã "ghim" bằng kéo-thả giữ nguyên sau khi giải lại.',
      'Không có giảng viên nào bị xếp 2 buổi trùng giờ trong kết quả cuối.',
    ],
  },
  {
    group: 'Kiểm tra kết quả & xuất file',
    items: [
      'Tab "Chưa xếp được" chỉ liệt kê buổi đã có giờ nhưng trùng/hết phòng, không lẫn lớp đang chờ giờ.',
      'Xuất file cho ra đúng khuôn FATE, mở lại được bằng Excel.',
      '"Lưu thời khoá biểu" ghi đúng kết quả đang xếp vào dữ liệu học phần, xem lại được ở "Bản đã lưu".',
    ],
  },
];

const LIMITATIONS = [
  'Không có tài khoản đăng nhập thật — vai trò chỉ là lựa chọn cục bộ, không kiểm soát bằng mật khẩu.',
  'Dữ liệu nhập liệu được tự động lưu vào file JSON snapshot và CSDL MySQL (vju_calendar); không bị mất khi khởi động lại backend.',
  'Một người dùng tại một thời điểm — chưa xử lý tình huống nhiều người sửa dữ liệu cùng lúc.',
  'Đồng giảng khi nhập Excel: chỉ tự động lấy người đầu tiên làm giảng viên chính; đồng giảng còn lại phải bổ sung bằng tay.',
  'Nhập Excel hỗ trợ cả hai chế độ: Gộp thêm vào dữ liệu đang có (Merge) hoặc Xóa dữ liệu cũ nạp mới (Replace).',
];

const FAQ = [
  {
    q: 'Bấm "Xếp thỉnh giảng" mà bị chặn, báo còn lớp chưa sẵn sàng?',
    a: 'Vào "Chuẩn bị dữ liệu → Học phần", xử lý hết mục "Chưa phân công giảng viên" (chọn người thật thay cho chỗ trống) và "Có giảng viên, chưa khai giờ" (bấm "Nhập giờ"). Hệ thống chặn giải cho tới khi xong cả hai, để không xếp theo giờ giả định.',
  },
  {
    q: 'Sửa tay một buổi xong, giải lại thì bị mất thay đổi?',
    a: 'Sửa tay qua kéo-thả cần tạo "ghim" mới được giữ khi giải lại. Nếu sửa bằng cách khác (ví dụ sửa trực tiếp trong "Dữ liệu học phần") thì không có cơ chế ghim, cần giải lại từ đầu.',
  },
  {
    q: 'Có hoàn tác được sau khi nhập Excel không?',
    a: 'Không. Bước xác nhận nạp sẽ xoá sạch dữ liệu học phần hiện có. Luôn đối chiếu số liệu ở bước xem trước trước khi xác nhận.',
  },
  {
    q: 'Cần báo lỗi/khác biệt tìm thấy thì làm sao?',
    a: 'Ghi lại: vai trò đang dùng, các bước đã thao tác theo đúng thứ tự, file Excel đầu vào (nếu có), và ảnh chụp hộp thư "Vấn đề" hoặc tab "Chưa xếp được" nếu liên quan đến kết quả giải.',
  },
];

export default function GuidePage() {
  const [section, setSection] = useState('tong-quan');

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Tài liệu tra cứu tĩnh cho hệ thống xếp TKB — không thao tác lên dữ liệu
          đang xếp.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <RoleTag role="staff" />
          <RoleTag role="viewer" />
          <span className="text-muted-foreground">— cả hai đều xem được trang này</span>
        </div>
      </div>

      <div className="mb-5 lg:hidden">
        <NativeSelect
          value={section}
          onChange={(e) => setSection(e.target.value)}
          aria-label="Chọn mục"
        >
          {SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex items-start gap-8">
        <nav className="hidden w-56 shrink-0 lg:block" aria-label="Mục lục hướng dẫn">
          <div className="sticky top-(--page-header-h) space-y-0.5 pt-1">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                data-slot="button"
                data-variant="ghost"
                onClick={() => setSection(key)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  section === key
                    ? 'glass-nav-active text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 max-w-3xl flex-1 space-y-4 pb-12">
          {section === 'tong-quan' && (
            <>
              <Card title="Hệ thống này dùng để làm gì">
                <p>
                  Công cụ tự động xếp lịch giảng dạy theo giờ, dùng thuật toán{' '}
                  <strong>CP-SAT</strong> (ràng buộc tổ hợp) thay vì xếp tay từng
                  lớp. Hệ thống nhận vào danh sách <strong>lớp học phần</strong>{' '}
                  (môn, giảng viên, số buổi/tuần, loại phòng cần) cùng{' '}
                  <strong>khung giờ giảng viên báo có thể dạy</strong>, rồi giải
                  bài toán xếp giờ sao cho không giảng viên nào bị trùng lịch,
                  đúng số buổi mỗi lớp cần, và đúng quy tắc ngày dạy theo loại
                  giảng viên.
                </p>
              </Card>

              <Card
                title="Phạm vi bản demo"
                description="Khác với quy trình đầy đủ ngoài đời"
              >
                <p>
                  Quy trình đầy đủ ngoài đời có 3 vai trò (GĐCT → Giáo vụ Khoa →
                  Phòng Đào Tạo), xếp giờ trước rồi gán phòng sau. Bản demo hiện
                  tại <strong>gộp mọi việc vào một giao diện</strong> với 2 vai
                  trò cục bộ, và xếp giờ + phòng trong cùng một lượt giải — dùng
                  để kiểm thử thuật toán và luồng nhập liệu, chưa phản ánh việc
                  chia nhiều khoa/phòng ban dùng chung hệ thống.
                </p>
              </Card>

              <Card title="Vai trò trong demo" description="Không có đăng nhập thật">
                <div className="divide-y">
                  <div className="grid grid-cols-1 gap-2 py-3 first:pt-0 sm:grid-cols-[180px_1fr]">
                    <RoleTag role="staff" className="h-fit" />
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm">
                        Toàn bộ điều hướng.
                      </p>
                      <p className="text-sm">
                        Nhập/sửa dữ liệu học phần, nộp khung giờ giảng viên, chạy
                        giải Giai đoạn 1 &amp; 2, kéo-thả sửa tay, xuất file, lưu
                        bản đã xếp.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 py-3 last:pb-0 sm:grid-cols-[180px_1fr]">
                    <RoleTag role="viewer" className="h-fit" />
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm">
                        Chỉ Thời khoá biểu, Nhật ký &amp; bản lưu, và trang này.
                      </p>
                      <p className="text-sm">
                        Chỉ xem kết quả đã có sẵn — không nạp lại dữ liệu, không
                        giải lại, không sửa.
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                  Vai trò chỉ đổi những gì hiện ra trên giao diện, không phải một
                  tài khoản riêng — dữ liệu cả hai vai trò nhìn thấy là chung một
                  trạng thái phía server. Muốn thử cả hai góc nhìn trên cùng dữ
                  liệu, quay lại màn chọn vai trò và chọn lại là được.
                </p>
              </Card>

              <Card title="Chạy hệ thống (dành cho tester)">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="bg-muted/40 rounded-lg border border-dashed p-3.5">
                    <p className="mb-1 text-sm font-semibold">Terminal 1 — Backend</p>
                    <p className="text-muted-foreground mb-2 text-xs">
                      webapp/app.py · Flask
                    </p>
                    <pre className="bg-card overflow-x-auto rounded-md border p-2.5 text-xs leading-relaxed">
                      {'cd webapp\npy app.py'}
                    </pre>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Địa chỉ: <code>http://127.0.0.1:5055</code>
                    </p>
                  </div>
                  <div className="bg-muted/40 rounded-lg border border-dashed p-3.5">
                    <p className="mb-1 text-sm font-semibold">Terminal 2 — Giao diện</p>
                    <p className="text-muted-foreground mb-2 text-xs">
                      frontend/ · React + Vite
                    </p>
                    <pre className="bg-card overflow-x-auto rounded-md border p-2.5 text-xs leading-relaxed">
                      {'cd frontend\nnpm install   # lần đầu\nnpm run dev'}
                    </pre>
                    <p className="text-muted-foreground mt-2 text-xs">
                      Địa chỉ: <code>http://localhost:5173</code>
                    </p>
                  </div>
                </div>
                <Notice tone="amber" icon={AlertTriangle} className="mt-3">
                  Dữ liệu lớp và giảng viên đã nhập được tự động lưu lại vào snapshot và CSDL MySQL (vju_calendar);
                  riêng kết quả chạy xếp lịch cần chạy lại nếu chưa bấm Lưu.
                </Notice>
              </Card>
            </>
          )}

          {section === 'luong' && (
            <Card
              title="Trình tự thao tác chuẩn"
              description="Từ danh sách lớp học phần đến thời khoá biểu hoàn chỉnh"
            >
              <ol className="space-y-5">
                {WORKFLOW_STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-3.5">
                    <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 space-y-1.5 pt-0.5">
                      <p className="text-[15px] font-semibold">{step.title}</p>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {step.desc}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <RoleTag role="staff" />
                        {step.testerToo && <RoleTag role="tester" />}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {section === 'man-hinh' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {SCREENS.map((s) => (
                <Card key={s.title} title={`${s.icon}  ${s.title}`} description={s.desc}>
                  <ul className="text-muted-foreground list-inside list-disc space-y-1.5 text-sm">
                    {s.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}

          {section === 'excel' && (
            <>
              <Card title="Cách dùng">
                <p className="font-medium">
                  Dữ liệu học phần → Nhập từ Excel → chọn file .xlsx → xem bản xem
                  trước → "Xóa dữ liệu cũ và nạp N lớp".
                </p>
                <Notice tone="amber" icon={AlertTriangle} className="mt-3">
                  Bước xác nhận sẽ <strong>xóa toàn bộ dữ liệu học phần đang
                  có</strong> rồi nạp dữ liệu mới — không có nút undo. Bước xem
                  trước phía trước hoàn toàn không ghi gì, dùng để đối chiếu số
                  liệu trước khi quyết định.
                </Notice>
              </Card>

              <Card
                title="Định dạng file được nhận diện tự động"
                description="Theo tên sheet trong file Excel"
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-120 text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
                        <th className="py-2 pr-4 font-semibold">Tên sheet</th>
                        <th className="py-2 pr-4 font-semibold">Ví dụ file</th>
                        <th className="py-2 font-semibold">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="py-2.5 pr-4">
                          <code>FATE</code>
                        </td>
                        <td className="py-2.5 pr-4">FATE.TKB.HK2_2025-2026.xlsx</td>
                        <td className="py-2.5">Cấu trúc chuẩn, dùng cho các kỳ sau</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 pr-4">
                          <code>Giảng dạy cho FATE</code>
                        </td>
                        <td className="py-2.5 pr-4">FATE.TKB.HK1 2026-2027.xlsx</td>
                        <td className="py-2.5">Cấu trúc cũ</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card
                title="Quy tắc xử lý cần biết khi kiểm thử"
                description="Nơi nhiều logic ngầm nhất của luồng nhập liệu"
              >
                <ul className="space-y-3 text-sm">
                  {EXCEL_RULES.map(([t, d]) => (
                    <li key={t} className="flex gap-2.5">
                      <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                      <span>
                        <strong>{t}:</strong>{' '}
                        <span className="text-muted-foreground">{d}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}

          {section === 'thuat-ngu' && (
            <Card description="Các khái niệm đặc thù của hệ thống này — không phải thuật ngữ chuẩn ngành.">
              <dl className="divide-y">
                {GLOSSARY.map((g) => (
                  <div key={g.term} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                    <span
                      className={cn('mt-1.5 size-2 shrink-0 rounded-full', TONE_DOT[g.tone])}
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-[15px] font-semibold">{g.term}</dt>
                      <dd className="text-muted-foreground mt-1 text-sm leading-relaxed">
                        {g.def}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {section === 'checklist' && (
            <div className="space-y-4">
              {CHECKLIST_GROUPS.map((g) => (
                <Card key={g.group} title={g.group}>
                  <ul className="space-y-2.5">
                    {g.items.map((it) => (
                      <li key={it} className="flex items-start gap-2.5 text-sm">
                        <CheckSquare className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}

          {section === 'gioi-han' && (
            <>
              <Card title="Giới hạn đã biết của bản demo">
                <ul className="space-y-2.5 text-sm">
                  {LIMITATIONS.map((it) => (
                    <li key={it} className="flex items-start gap-2.5">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="text-muted-foreground">{it}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Câu hỏi thường gặp">
                <div className="divide-y">
                  {FAQ.map(({ q, a }) => (
                    <div key={q} className="space-y-1.5 py-4 text-sm first:pt-0 last:pb-0">
                      <p className="font-semibold">{q}</p>
                      <p className="text-muted-foreground leading-relaxed">{a}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
