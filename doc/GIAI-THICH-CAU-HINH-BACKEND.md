# Giải thích các mục trong cấu hình backend

Cứ hình dung `config/backend.json` giống như **bảng "luật chơi"** mà cả hệ thống phải tuân theo. Dưới đây là ý nghĩa của từng dòng trong file mẫu [`config/backend-example.json`](../config/backend-example.json), giải thích theo kiểu dễ hiểu nhất có thể.

## `calendar` — Lịch tuần trông như thế nào

| Tham số | Giá trị mẫu | Nói nôm na là... |
|---|---|---|
| `numDays` | `7` | Một tuần hiển thị trên lịch có 7 ngày (từ Thứ 2 đến Chủ nhật). |
| `slotsPerDay` | `13` | Mỗi ngày được chia nhỏ ra thành 13 "ô giờ" (gọi là **tiết**) để xếp lớp vào, giống như 1 ngày có 13 khung giờ trống trên thời khóa biểu. |
| `defaultDuration` | `2` | Nếu một lớp không ghi rõ học mấy tiết, hệ thống cứ mặc định coi là học 2 tiết một buổi. |
| `maxImportedPeriod` | `16` | Khi đọc file Excel, tiết học lớn nhất được chấp nhận là tiết 16 (phòng trường hợp có lớp học muộn) — cao hơn cả 13 để không bị báo lỗi "sai dữ liệu" một cách oan uổng. |
| `dayLabels` | `Thứ 2 → Chủ nhật` | Tên các ngày hiển thị cho người dùng xem trên giao diện. |
| `slotDayNames` | `Thu 2 → Chu nhat` | Tên ngày không dấu, dùng ở phía sau hậu trường (ghi log, xuất file) — người dùng bình thường không cần để ý mục này. |

## `rooms` — Trường có bao nhiêu phòng học

| Tham số | Giá trị mẫu | Nói nôm na là... |
|---|---|---|
| `ltPool` | `60` | Cùng một lúc, trường có tối đa 60 phòng học lý thuyết (phòng học bình thường) có thể dùng. |
| `labPool` | `40` | Cùng một lúc, trường có tối đa 40 phòng thực hành/phòng máy có thể dùng. |

Hệ thống sẽ không bao giờ xếp nhiều lớp lý thuyết/thực hành hơn số phòng này diễn ra cùng một giờ.

## `teacherDayLimits` — Giảng viên được dạy tới ngày nào trong tuần

| Tham số | Giá trị mẫu | Nói nôm na là... |
|---|---|---|
| `GUEST` | `5` | Giảng viên **thỉnh giảng** (mời từ ngoài trường) chỉ được máy tự xếp lịch tới hết ngày này. |
| `RESIDENT` | `4` | Giảng viên **cơ hữu** (biên chế của trường) chỉ được máy tự xếp lịch tới hết ngày này. |

Cách đếm hơi khác thói quen một chút: `0` là Thứ 2, `1` là Thứ 3, ... nên `5` = Thứ 7 và `4` = Thứ 6. Nói cách khác: thỉnh giảng có thể được xếp đến hết Thứ 7, còn cơ hữu chỉ đến hết Thứ 6 — không ai bị máy tự xếp vào Chủ nhật cả.

## `campuses` — Quy tắc riêng theo từng cơ sở (Hòa Lạc / Mỹ Đình)

- `priority`: thứ tự cơ sở mà hệ thống **ưu tiên gom lịch gọn gàng hơn**. Ví dụ `["hoa lac", "my dinh"]` nghĩa là hệ thống cố gắng giảm số ngày một giảng viên phải chạy tới Hòa Lạc trước, rồi mới tính đến Mỹ Đình — vì Hòa Lạc thường xa hơn, đi lại vất vả hơn.
- `sessionBlocks`: mỗi cơ sở có "khối buổi học" riêng — tức là một buổi học không được phép bắt đầu ở buổi sáng rồi kết thúc lấn qua giờ nghỉ trưa. Ví dụ ở Hòa Lạc, buổi sáng là tiết `2` đến `5`, còn lại từ tiết `6` đến `13` được coi là buổi chiều/tối; một lớp 3 tiết có thể học tiết 2-4 hoặc 6-8, nhưng không thể học tiết 4-6 vì sẽ "vắt" qua giờ nghỉ trưa.

## `solver` — Cài đặt cho "bộ tính toán tự động xếp lịch"

| Tham số | Giá trị mẫu | Nói nôm na là... |
|---|---|---|
| `timeLimitSeconds` | `30` | Mỗi lần bấm nút "Xếp lịch tự động", máy được cho tối đa 30 giây để suy nghĩ. Hết giờ mà chưa xong thì máy sẽ lấy phương án tốt nhất đã tìm được, không đứng chờ mãi. |
| `numSearchWorkers` | `8` | Cho máy tính "mượn" 8 luồng xử lý để cùng lúc thử nhiều cách xếp khác nhau, giống như nhờ 8 người cùng ngồi tính một bài toán để ra kết quả nhanh hơn. |
| `crossProgramCombinationLimit` | `5000` | Giới hạn số cặp lớp học được đem ra so sánh chéo giữa các chương trình đào tạo với nhau, để máy không bị "đơ" khi dữ liệu quá nhiều. |

## `legacyDataParams` — Chỉ dùng khi tạo dữ liệu giả để thử nghiệm

Nhóm này **không ảnh hưởng đến dữ liệu thật**, chỉ có tác dụng khi lập trình viên tạo dữ liệu mẫu để kiểm tra hệ thống.

| Tham số | Giá trị mẫu | Nói nôm na là... |
|---|---|---|
| `seed` | `0` | Một "con số khởi đầu" để lần nào tạo dữ liệu giả cũng ra đúng y hệt kết quả cũ — giúp việc kiểm tra dễ so sánh hơn. |
| `pctPreSubmitted` | `100` | Trong dữ liệu giả, có bao nhiêu phần trăm giảng viên được coi như "đã khai báo sẵn giờ rảnh" (100 = tất cả). |
| `numForcedConflicts` | `0` | Cố tình tạo ra bao nhiêu vụ trùng lịch trong dữ liệu giả, để xem hệ thống có phát hiện và cảnh báo đúng không. |

## `availabilityGenerator` — Tự động khai giờ rảnh cho giảng viên

Đây là phần cài đặt cho nút **"Tự động khai giờ rảnh"** ở màn hình sửa thông tin giảng viên: chỉ cần bấm 1 nút, hệ thống tự "đoán hộ" giảng viên rảnh vào những giờ nào trong tuần, thay vì phải tick tay từng ô trên lưới giờ. Áp dụng chung cho cả giảng viên thỉnh giảng lẫn cơ hữu.

- **`sessionBlocks`** — chia một ngày thành 3 "khung giờ lớn" để chọn: buổi sáng (`morning`, tiết 2-5), buổi chiều (`afternoon`, tiết 6-9), buổi tối (`evening`, tiết 10-12). Từ `selectionGroup` chỉ là cái tên nhóm để gộp sáng và chiều lại chung một rổ "ban ngày" (`daytime`) khi tính tỷ lệ ở bên dưới; buổi tối được xếp riêng vào rổ `evening`.
- **`selectionGroupWeights`** — tỷ lệ ưu tiên giữa "ban ngày" và "buổi tối" khi máy chọn ngẫu nhiên một khung giờ để gán làm giờ rảnh. `daytime: 90, evening: 10` nghĩa là cứ 100 lần chọn thì trung bình 90 lần rơi vào ban ngày (sáng hoặc chiều), chỉ 10 lần rơi vào buổi tối — máy sẽ ưu tiên gợi ý giờ rảnh vào ban ngày nhiều hơn hẳn buổi tối.
- **`generationChanceByBlockStage`** — cơ hội (tính theo %) để máy sinh thêm **một khung giờ rảnh nữa** trong cùng một ngày, tùy vào ngày đó giảng viên đã "kín" bao nhiêu khung rồi (kể cả giờ đang dạy sẵn):
  - `"0": 100` — ngày đó chưa dạy/chưa rảnh khung nào → chắc chắn 100% sẽ được gợi ý 1 khung rảnh.
  - `"1": 35` — ngày đó đã có 1 khung bận rồi → chỉ có 35% cơ hội máy gợi ý thêm 1 khung rảnh nữa.
  - `"2": 10` — đã có 2 khung bận → chỉ còn 10% cơ hội gợi ý thêm.
  - `"3OrMore": 0` — đã bận cả 3 khung (sáng, chiều, tối) → không gợi ý thêm gì nữa, vì cả ngày coi như kín lịch.
- **`maxGeneratedBlocksPerDay`** — mỗi ngày, nút "Tự động khai giờ rảnh" chỉ được phép tự thêm tối đa bao nhiêu khung giờ mới. Mặc định là `1` (mỗi ngày chỉ gợi ý thêm nhiều nhất 1 khung).
- **`replaceExistingAvailability`** — khi bấm nút tự động, hệ thống có xóa sạch giờ rảnh cũ để thay bằng kết quả mới hay không. Tham số này luôn phải để `true` (bắt buộc xóa và thay mới hoàn toàn); **giờ đang dạy thì không bao giờ bị đụng tới**, dù giá trị này là gì.

> 📝 **Nếu chưa quen đọc file cấu hình:** Bạn không cần hiểu hết ngay tất cả các dòng ở trên. Muốn dùng thử hệ thống, cứ giữ nguyên các giá trị mặc định — chúng đã được chọn sẵn để phù hợp với cách vận hành thực tế của VJU. Chỉ khi nào cần đổi số phòng, đổi giờ nghỉ trưa hay chỉnh tỷ lệ gợi ý giờ rảnh thì mới cần quay lại sửa đúng dòng liên quan.

> ℹ️ File cũ tạo trước khi có mục `availabilityGenerator` vẫn chạy được bình thường — hệ thống sẽ tự dùng các giá trị mặc định ở trên. Nhưng nếu bạn **đã** thêm mục này vào rồi mà gõ sai (ví dụ tổng `selectionGroupWeights` không bằng 100, hoặc để `replaceExistingAvailability: false`), hệ thống sẽ **dừng khởi động** và báo lỗi rõ ràng thay vì âm thầm bỏ qua, để tránh chạy nhầm với cấu hình sai.
