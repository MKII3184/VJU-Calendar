# Chạy dự án

Cách chạy của repo là **`py main.py` tại thư mục gốc** — một lệnh lo toàn bộ:
kiểm tra cấu hình, cài thư viện còn thiếu, build giao diện, rồi khởi động song
song **Flask** (API + thuật toán CP-SAT, cổng 5055) và **Vite** (giao diện React,
cổng do Vite in ra — thường là 5173). Người dùng **không cần** chạy `pip install`
hay `npm install` thủ công.

## Thiết lập lần đầu

### 1. Cài sẵn môi trường

**Python 3.10 trở lên** và **Node.js 18 trở lên** — `main.py` tự kiểm tra và
dừng với thông báo rõ ràng nếu thiếu hoặc bản quá cũ.

### 2. Tạo hai file cấu hình

Hai file cục bộ đều nằm trong `config/` tại gốc dự án và bị Git bỏ qua riêng từng
file. Thư mục `config/` đã có sẵn hai file mẫu để sao chép:

- `config/backend.json` ← mẫu `config/backend-example.json`: cấu hình lịch học,
  phòng và solver cho Flask. Giải thích từng mục xem
  `doc/GIAI-THICH-CAU-HINH-BACKEND.md`.
- `config/frontend.json` ← mẫu `config/frontend-example.json`: cấu hình proxy Vite
  (`devServer.apiProxy` gồm `path`, `target`, `changeOrigin`). Không đặt secret ở đây.

### 3. Chạy

```
py main.py
```

Xong. Lệnh tự cài thư viện còn thiếu (Python theo `webapp/requirements.txt`;
frontend dùng `npm ci` khi có `package-lock.json`, ngược lại `npm install`),
build lại `frontend/dist` rồi mở cả hai dịch vụ.

Nếu thiếu một hoặc cả hai file cấu hình, launcher tạo **tất cả** file còn thiếu
dưới dạng rỗng rồi dừng **trước** khi cài dependency, build hay mở dịch vụ; điền
JSON theo hai file mẫu rồi chạy lại.

## `py main.py` làm gì mỗi lần chạy

Tuần tự: xóa `webapp/config.json` cũ nếu còn sót (file cấu hình đã dời về
`config/` từ lâu) → kiểm tra hai file cấu hình → kiểm tra phiên bản Python/Node
→ cài dependency còn thiếu → build lại `frontend/dist` → khởi chạy song song
Flask và Vite.

- Mở **http://127.0.0.1:5055** để dùng bản giao diện vừa build do Flask phục vụ.
- Hoặc mở đúng địa chỉ Vite in ra (thường `http://localhost:5173`) nếu đang phát
  triển và muốn hot-reload.
- `Ctrl+C` dừng cả hai tiến trình.

`frontend/dist` bị Git bỏ qua nên `git pull` không cập nhật nó — bước build tự
động trong `main.py` bảo đảm cổng 5055 không phục vụ bundle cũ sau khi mã nguồn
frontend thay đổi. Vì vậy **đừng dùng lại tiến trình `main.py` cũ sau khi kéo mã
mới**: dừng và chạy lại để bản build được cập nhật.

## Chạy riêng từng phần (nâng cao)

Khi chỉ cần một phía, hoặc đang debug. Quy tắc tạo config chia theo lệnh: chạy
`py app.py` trực tiếp trong `webapp/` chỉ tạo `config/backend.json` nếu thiếu;
các lệnh Vite (`npm run dev`, `npm run build`, `npm run preview`, `npm test`
trong `frontend/`) chỉ tạo `config/frontend.json` nếu thiếu. Mỗi lệnh dừng ngay
sau khi tạo file rỗng, không tự điền mặc định. File đã tồn tại không bị ghi đè;
file rỗng, sai cú pháp hoặc sai schema cũng làm lệnh dừng và báo đường
dẫn/trường lỗi. Vite luôn nạp frontend config khi chạy dev, build, preview và
test, kể cả khi proxy không được dùng.

### Chỉ dùng app (một cửa sổ)

Flask tự phục vụ giao diện đã build ở `frontend/dist`, xem `webapp/api/frontend.py`.

```
cd frontend
npm run build      # chỉ chạy lại khi frontend/src có thay đổi

cd ../webapp
py app.py
```

Mở **http://127.0.0.1:5055**.

### Sửa giao diện (hai cửa sổ)

Có hot-reload: sửa file trong `frontend/src` là trình duyệt tự cập nhật.

**Cửa sổ 1 — backend:**

```
cd webapp
py app.py
```

**Cửa sổ 2 — frontend:**

```
cd frontend
npm run dev
```

Mở cổng mà **Vite in ra**, không phải cổng nhớ trong đầu. Với cấu hình mẫu
`config/frontend-example.json`, `/api/*` được Vite proxy sang `127.0.0.1:5055`;
`vite.config.js` đọc `path`, `target`, `changeOrigin` từ `config/frontend.json`,
không chứa giá trị proxy dự phòng. Backend không cần cấu hình CORS khi proxy trỏ
đúng backend.

> **Cổng 5173 hay bị chiếm.** Máy này có app khác (Laravel) giữ 5173, Vite lặng lẽ
> nhảy sang 5174/5175 và vẫn chạy bình thường. Vào nhầm 5173 sẽ thấy app khác —
> đó không phải lỗi của dự án này. Proxy trỏ đúng 5055 dù Vite nằm ở cổng nào.

## Kiểm tra nhanh backend

```
curl http://127.0.0.1:5055/api/state
```

| Trả về | Nghĩa là |
|---|---|
| `{"hasData":true,...}` | Chạy tốt, đã có dữ liệu. |
| `{"error":"Chưa có dữ liệu..."}` kèm mã 400 | Chạy tốt nhưng chưa nạp Excel. **Đúng hành vi**, không phải lỗi. |
| Không kết nối được | Flask chưa chạy. |

## Bộ test API tự động

`test/runtests.py` chạy tuần tự 96 test case (TC-01 → TC-96) qua Flask test
client, không cần mở cổng. Script **tự backup** `manual_state_snapshot.json` và
`moc_hoan_tac.json` trước khi test rồi khôi phục lại sau, nên chạy được ngay cả
khi đang có dữ liệu thật — nhưng vẫn nên chạy lúc Flask không hoạt động:

```
py test/runtests.py
```

Mỗi test in một dòng `[PASS]`/`[FAIL]` kèm mã TC và mô tả; dòng `[FAIL]` có thêm
chi tiết để đối chiếu.

## Kiểm tra "xếp theo phạm vi"

Tính năng xếp riêng một chương trình đào tạo có bài đo chạy trên dữ liệu thật —
những sai lệch nó bắt (lớp ngoài phạm vi bị xê dịch, trùng giờ giảng viên, vượt
pool phòng) đều **không nhìn thấy được trên giao diện**. Không cần Flask chạy:

```
cd webapp
py kiem_tra_pham_vi.py                                  # phạm vi mặc định
py kiem_tra_pham_vi.py FTH VJU2026 VJU2025 VJU2024      # chỉ định CTĐT × Khóa
```

Chạy lại sau mỗi lần nâng `ortools` — mô hình CP-SAT ở `scheduler_core.py` là chỗ
dễ vỡ nhất khi lên bản mới.

## Kiểm tra "không trùng lịch sinh viên"

Một **nhóm sinh viên** là một cặp (CTĐT, Khóa) — `FTH/VJU2023` — và một người
không ngồi được hai lớp cùng lúc. Ràng buộc này **mềm** (`scheduler_core.
_rang_buoc_nhom_sinh_vien`) vì giờ đã chốt trong file vốn đã có sẵn một số vụ
trùng mà hệ thống không có quyền đổi, nên phép đo là **mức tăng thêm**:

```
cd webapp
py kiem_tra_nhom_sinh_vien.py --bo-chan               # đo trên dữ liệu thật
py kiem_tra_nhom_sinh_vien.py --bo-chan --doi-chung   # chạy thêm bản TẮT ràng buộc để so
```

| Dòng kết quả | Đọc thế nào |
|---|---|
| `[1] Vụ phát sinh thêm, TRÁNH ĐƯỢC` | **Phải bằng 0.** Khác 0 là lỗi của mô hình: lớp đó còn khung giờ khác không đâm vào ai mà solver vẫn xếp chồng. |
| `[2] Vụ phát sinh thêm, BẾ TẮC` | Mọi khung giờ giảng viên đã khai đều đâm vào lớp cùng nhóm — bế tắc của **dữ liệu**, phải khai thêm giờ hoặc đổi lớp đã chốt. |
| `[3] Vụ cả hai bên đã chốt giờ` | Có sẵn trong file, solver không được đổi. |
| `[4] Lớp chưa ghi cột Khóa` | **Không được kiểm** — điền cột Khóa là kiểm được ngay. |

`--doi-chung` in thêm một dòng so sánh (đo gần nhất trên dữ liệu thật: **45 vụ**
khi tắt ràng buộc, **28 vụ** khi bật). Nếu hai con số bằng nhau thì đường truyền
`cap_can_ne` từ `api/solve.py` xuống `scheduler_core.py` đã đứt.

Ba trường hợp cùng giờ **không** bị báo: nhóm **học chung** (một buổi dạy vật lý),
**lớp song song** của cùng một học phần (CSE3013-1 / -2 — sinh viên chia đôi), và
**lớp trực tuyến** — ô "Hình thức" ghi `Trực tuyến` / `Online` / `LMS`. Lớp trực
tuyến là môn linh động, lên thời khóa biểu chỉ để có trong danh sách đăng ký nên
nó không giữ chân sinh viên; chỉ cần **một** bên trực tuyến là cặp đó được miễn.
Ô ghi cả `Online` lẫn `Trực tiếp` thì **không** miễn — lớp đó có buổi học thật.

Miễn theo TỪNG LỚP chứ không theo học phần: một môn ba buổi mà chỉ một buổi ghi
"Trực tuyến" thì hai buổi kia vẫn bị kiểm. Điền đủ ô "Hình thức" ở "Dữ liệu học
phần" (hoặc ở file gốc) cho cả ba.

### Vụ đã chốt lịch — không tính là vấn đề

Một vụ trùng mà **MỌI lớp liên quan đều thuộc học phần đã chốt** thì không còn
việc gì để làm: hệ thống từ chối mọi thao tác đổi giờ cho tới khi có người bấm
"Bỏ chốt học phần". Những vụ đó bị **hạ cấp**, không xóa:

- không tính vào số vấn đề, không tô dấu "!" lên thẻ trên lưới;
- nằm trong mục thu gọn **"Đã chốt — không tính là vấn đề"** cuối hộp thư, bấm vào
  vẫn nhảy tới buổi tương ứng để tra cứu.

Điều kiện là **mọi** lớp chứ không phải một lớp: còn một bên chưa chốt thì vẫn đổi
giờ bên đó được, tức vẫn là việc phải làm. Trên dữ liệu thật đây đúng là ranh giới
đáng kể — 26 vụ trùng lịch sinh viên tách thành **21 vụ cả hai đã chốt** và **5 vụ
còn gỡ được**; 5 vụ đó mới là thứ đáng hiện lên đỏ.

Chỉ áp cho các vụ "hai buổi đụng nhau" (trùng giảng viên, trùng lịch sinh viên,
hai cơ sở trong một ngày). **Không** áp cho "nghi trùng lặp dữ liệu" (chốt lịch
không làm một dòng thừa bớt thừa đi) và "không xếp được / chưa có giờ" (việc chưa
xong, không phải cam kết đã xong).

> Lưu ý: nạp file xong, `pinning.chot_hoc_phan_du_gio_tu_file()` tự đánh dấu
> **"Chốt theo file"** cho mọi học phần đã đủ giờ trong file — đo trên dữ liệu
> thật: 126/126 học phần đã chốt đều là chốt-theo-file, phủ 225/294 lớp. Nên "đã
> chốt" ở đây phần lớn nghĩa là "giờ đã ghi sẵn trong file kế hoạch", chứ không
> phải "có người vừa bấm nút Chốt".

### Lớp do đơn vị khác điều phối

Nút **"Bỏ qua N lớp"** ở "Dữ liệu học phần" loại các lớp do đơn vị khác điều phối
(Phòng Đào tạo, JLE…) khỏi bài toán — khoa không xếp chúng. Nhưng **bỏ qua không
có nghĩa là vô hình**: lớp nào **đã có giờ chốt** thì vẫn nằm trên lưới thời khóa
biểu và vẫn **chiếm chỗ của nhóm sinh viên**, vì sinh viên khóa đó đang thật sự
ngồi học lúc đó. Trên dữ liệu thật: 65/80 lớp được đề xuất bỏ qua đã có giờ, phủ
15 nhóm (CTĐT × Khóa), riêng BCSE/VJU2026 13 lớp.

| | Lớp bỏ qua ĐÃ có giờ | Lớp bỏ qua CHƯA có giờ |
|---|---|---|
| Hiện trên lưới | ✔ (thẻ sọc chéo, viền đứt, nhãn "ĐƠN VỊ KHÁC") | ✘ |
| Chiếm chỗ nhóm sinh viên | ✔ — solver né, hộp thư báo trùng | ✘ |
| Vào model CP-SAT / kéo-thả được | ✘ — `/api/move-lesson` trả 409 | ✘ |
| Tính trùng giảng viên / chiếm phòng | ✘ — ô giảng viên là một ĐƠN VỊ, không phải người | ✘ |
| Cộng vào `placedCount` (tiến độ của khoa) | ✘ | ✘ |

Ranh giới nằm ở `webapp/domain/bo_qua.py: van_len_luoi()`.

Cùng một luật gom nhóm được viết ở **hai nơi** — `webapp/domain/nhom_sinh_vien.py`
cho solver, `frontend/src/adapters/nhomSinhVien.js` cho Hộp thư vấn đề. Sửa một
bên thì phải sửa bên kia, nếu không màn hình sẽ báo một đằng còn solver né một nẻo.

## Dừng

Với `py main.py`: `Ctrl+C` một lần dừng cả Flask lẫn Vite. Với cách chạy riêng:
`Ctrl+C` ở từng cửa sổ. Nếu lỡ đóng mất cửa sổ mà tiến trình còn sống:

```
netstat -ano | findstr :5055
taskkill /PID <pid> /F
```

## Dữ liệu nằm ở đâu

Hai file **dữ liệu runtime** dưới đây nằm trong `webapp/`, khác với hai file **cấu hình** `config/backend.json` và `config/frontend.json` ở gốc dự án. Đường dẫn dữ liệu neo theo vị trí file `.py` (`__file__`), còn các file cấu hình neo theo vị trí mã nguồn backend/Vite; không phụ thuộc thư mục hiện tại khi chạy lệnh.

| File | Là gì |
|---|---|
| `manual_state_snapshot.json` | **Nguồn dữ liệu chính** — toàn bộ công nhập liệu. Ghi lại sau mỗi thao tác `/api/manual/*`. Mất file này là mất hết. |
| `moc_hoan_tac.json` | Mốc để nút "Huỷ thay đổi" quay về. |

Cả hai đều **gitignore** và **tự nạp lại** khi Flask khởi động — tắt app không mất
dữ liệu. Riêng kết quả giải (Giai đoạn 1 & 2) **không** được lưu: mở lại app phải
bấm Giải lại.

## Lỗi hay gặp

| Triệu chứng | Nguyên nhân |
|---|---|
| Báo vừa tạo `config/backend.json` hoặc `config/frontend.json` | File còn thiếu đã được tạo rỗng; điền JSON theo mẫu `config/backend-example.json` / `config/frontend-example.json` rồi chạy lại. Với `main.py`, kiểm tra cả hai file. |
| Báo file cấu hình đang trống | File đã có nhưng chưa có nội dung; bổ sung cấu hình đúng schema trước khi chạy lại. |
| Báo JSON không hợp lệ | Kiểm tra cú pháp: dấu ngoặc, dấu phẩy, dấu nháy kép. File lỗi không bị sửa tự động. |
| Báo thiếu trường hoặc sai schema | Xem đường dẫn và trường trong lỗi; backend cần các nhóm tham số lịch/phòng/solver (giải thích ở `doc/GIAI-THICH-CAU-HINH-BACKEND.md`), frontend cần `devServer.apiProxy` và `path`, `target`, `changeOrigin` đúng kiểu. |
| `ModuleNotFoundError: No module named 'flask'` | Chưa cài thư viện ở phần "Thiết lập lần đầu", hoặc đang chạy bằng bản Python khác bản đã cài. |
| Cổng 5055 báo đang bận | Còn một Flask cũ chạy nền — dùng `taskkill` ở trên. |
| Nhiều lớp hiện CTĐT "Chung" và bỏ trống cột Khóa | Dữ liệu nạp bằng **bản cũ** của trình đọc file: dòng chỉ điền ô Họ tên (giảng viên đồng giảng viết xuống dòng riêng) bị đọc thành một lớp riêng. Nay đã gộp vào lớp ngay trên — **nạp lại file Excel** thì 43 lớp ma đó biến mất. |
| Trang 5055 hiện "Chưa build giao diện" | Thiếu `frontend/dist/index.html` — chạy lại `py main.py`, hoặc chạy `npm run build` nếu chỉ khởi động Flask riêng. |
| Trang 5055 có giao diện cũ hoặc thiếu Liquid Glass sau `git pull` | `frontend/dist` là bản build cục bộ bị Git bỏ qua. Dừng tiến trình cũ và chạy lại `py main.py`; nếu chạy Flask riêng thì chạy `npm run build` trong `frontend/` trước. |
| Giao diện lên nhưng mọi màn đều trống | Backend chưa chạy hoặc sai cổng — mở DevTools xem tab Network, các lời gọi `/api/*` trả gì. |
