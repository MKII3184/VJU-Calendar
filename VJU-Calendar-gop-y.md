# Những chỗ dễ gây bối rối khi dùng công cụ xếp thời khóa biểu

*Ghi chép ngày 01/10/2026, dưới góc nhìn một giáo vụ cần sắp lịch cho cả trường.*

Tôi đã mở hệ thống bằng vai trò **Giáo vụ / Điều phối viên**, đi qua màn thời khóa biểu, phần nhập lớp và giảng viên, phần chuẩn bị dữ liệu, nhật ký, bản lưu và hướng dẫn. Tôi cũng xem thử trên màn hình nhỏ. Đây là nhận xét về **cách người dùng hiểu và sử dụng giao diện**, không phải kết luận rằng lịch do hệ thống xếp đúng hay sai.

**Giới hạn của lần xem này:** Trong hệ thống đã có dữ liệu học kỳ. Tôi chỉ xem màn hình, chuyển bộ lọc và mở rồi hủy các biểu mẫu; **không** bấm xếp lại, lưu, xóa, bỏ ghim hay xác nhận nạp file. Những chỗ liên quan tới việc gì xảy ra sau khi bấm các nút đó được đối chiếu thêm với phần giải thích và cách hoạt động trong dự án, chứ chưa được thử bằng cách thay đổi dữ liệu thật.

## Cần làm rõ trước khi dùng vào công việc thật

### 1. Tôi không biết mình đang xếp cho cả trường hay chỉ một khoa

Ở trang chính có dòng **“Toàn khoa · 9 chương trình”**, trong khi nhu cầu của tôi là xếp cho **cả trường**. Hướng dẫn lại nói bản hiện tại chưa phản ánh cảnh nhiều khoa và phòng ban cùng làm việc. Nếu không đọc kỹ, tôi có thể tưởng đã nhìn thấy toàn bộ lớp trong trường rồi bỏ sót phần của đơn vị khác.

**Nên làm:** Nói rõ ngay từ màn bắt đầu và đầu trang lịch: đây là lịch của đơn vị nào, đã gồm những khoa nào và những phần nào chưa có trong dữ liệu. Nếu công cụ hiện chỉ phục vụ một khoa hoặc một người dùng, hãy gọi đúng như vậy.

### 2. Nút “Lưu thời khoá biểu” làm tôi tưởng có một bản sao để quay lại

Sau khi nhìn thấy nút **“Lưu thời khoá biểu”**, tôi đi tìm trong **“Bản đã lưu”** nhưng trang đó chưa có danh sách bản lưu để mở hoặc khôi phục. Việc bấm Lưu hiện nhằm đưa giờ đang xếp vào dữ liệu học phần, không phải tạo một phương án lịch riêng có tên để tra lại. Hướng dẫn lại nói có thể xem lại kết quả đã lưu ở “Bản đã lưu”. Đây là chỗ rất dễ khiến người dùng yên tâm nhầm trước khi sửa hoặc xếp lại.

**Nên làm:** Đổi tên hoặc ghi ngay cạnh nút: **“Ghi giờ vào dữ liệu học phần (không tạo bản sao)”**. Với mục “Bản đã lưu”, ghi rõ chức năng lưu nhiều phương án **chưa có**, hoặc tạm ẩn mục này. Cập nhật hướng dẫn cho đúng.

### 3. Hướng dẫn khiến tôi hiểu sai chuyện dữ liệu có mất khi tắt máy không

Trang hướng dẫn cảnh báo rằng tắt chương trình phía sau sẽ mất hết dữ liệu đang thao tác, trừ khi đã bấm “Lưu thời khoá biểu” hoặc xuất file. Nhưng dự án hiện có cơ chế tự ghi dữ liệu nhập vào một tệp và tự nạp lại khi mở chương trình; riêng **kết quả vừa chạy xếp lịch** không được giữ nguyên như vậy, nên cần chạy lại. Hai chuyện này khác nhau nhưng hướng dẫn đang nói gộp thành “mất hết”.

**Nên làm:** Viết riêng hai câu dễ hiểu: **“Thông tin lớp và giảng viên đã nhập được giữ lại khi mở lại chương trình”** và **“Kết quả của lần chạy xếp lịch có thể cần chạy lại”**. Đừng yêu cầu giáo vụ bấm Lưu chỉ vì sợ mọi dữ liệu biến mất.

### 4. Chỗ nhập Excel nói “nạp file sẽ xóa dữ liệu” ngay cạnh nút “Gộp thêm”

Trong cửa sổ nhập Excel có hai lựa chọn: **gộp thêm vào dữ liệu hiện có** hoặc **xóa dữ liệu cũ và nạp lại**. Tuy vậy, lời cảnh báo trong cửa sổ nói chung rằng nạp file sẽ xóa toàn bộ dữ liệu; hướng dẫn còn viết rằng chỉ có cách ghi đè, chưa hỗ trợ gộp. Tôi sẽ không biết nên tin nút nào và dễ sợ thao tác gộp cũng làm mất dữ liệu.

**Nên làm:** Đặt giải thích riêng cho từng lựa chọn: “Gộp thêm: giữ dữ liệu đang có, bỏ qua các lớp trùng theo quy tắc ...”; “Thay thế: xóa dữ liệu cũ, không hoàn tác”. Chỉ hiện cảnh báo xóa khi người dùng chọn **Thay thế**. Cập nhật hướng dẫn tương ứng.

### 5. Trang lịch báo đủ buổi, nhưng quy trình vẫn báo chưa xong

Tôi thấy **“274/274 buổi”** và tưởng lịch đã đủ. Ngay dưới đó lại có **“1/3 bước hoàn tất”**; cửa sổ quy trình cho biết còn **5 lớp cơ hữu chưa có giờ** và bước ghép cơ hữu đang bị khóa. Bước thỉnh giảng ghi **0 lớp chưa có giờ** nhưng nút vẫn là **“Xếp lại”** — người mới không hiểu tại sao phải “xếp lại” cái đã đủ rồi mới được làm bước sau.

**Nên làm:** Ghi rõ “274 buổi **đang hiện trên lịch**” thay vì để người đọc hiểu là “274/274 việc đã hoàn tất”. Trước nút Xếp lại, giải thích ngắn: **“Cần chạy bước thỉnh giảng một lần để mở bước ghép cơ hữu, dù không còn lớp thỉnh giảng thiếu giờ.”** Hiển thị tổng số lớp vẫn chưa được xếp cạnh số buổi đã hiện.

### 6. “Không có vấn đề nào” chưa có nghĩa đã kiểm tra được hết

Hộp xem vấn đề ghi **“Không có vấn đề nào”**, nhưng vẫn có **77 mục đã chốt được xếp sang nhóm không tính là vấn đề**, và **14 lớp chưa ghi Khóa nên chưa thể kiểm tra trùng lịch sinh viên**. Là giáo vụ, tôi rất dễ đọc mỗi dòng đầu và kết luận lịch đã sạch lỗi.

**Nên làm:** Hiện ba con số ở cùng một chỗ: **cần xử lý**, **đã chốt nên chỉ để tham khảo**, **chưa đủ dữ liệu để kiểm tra**. Đưa 14 lớp thiếu Khóa thành danh sách có thể bấm vào để bổ sung, thay vì chỉ báo một dòng chữ cuối hộp.

## Khó xem lịch và khó biết thao tác sẽ ảnh hưởng tới đâu

### 7. Lưới lịch toàn khoa quá dày để đọc được tên lớp

Với hàng trăm buổi trên cùng lưới tuần, các lớp nằm sát nhau thành những vạch màu rất hẹp. Tôi nhìn ra giờ nào đông lớp, nhưng khó biết đó là lớp gì, của ai, có cần chỉnh không. Trên màn hình điện thoại, phần lịch càng phải cuộn nhiều hơn. Chế độ **Bảng** và bộ lọc có giúp ích, nhưng không có lời nhắc nào nói đây là cách nên bắt đầu khi xem toàn khoa.

**Nên làm:** Mặc định cho xem số lớp theo từng ô giờ ở phạm vi toàn khoa; bấm ô để mở danh sách lớp. Nếu vẫn muốn lưới chi tiết, nhắc người dùng **chọn chương trình hoặc giảng viên** trước, và đặt đường chuyển sang Bảng dễ thấy hơn.

### 8. “Đã ghim (sửa tay)” xuất hiện cả ở giờ đã chốt từ file

Khi bấm vào một buổi trên lịch, tôi thấy cùng lúc **“Đã ghim (sửa tay)”** và **“Giờ đã chốt trong file”**. Hai câu này kể hai câu chuyện khác nhau: người dùng vừa sửa bằng tay, hay giờ được mang vào từ file ban đầu? Nút **“Bỏ ghim — để hệ thống xếp lại”** càng đáng ngại nếu tôi không biết giờ ban đầu thuộc loại nào.

**Nên làm:** Ghi nguồn của giờ một cách rõ ràng, chẳng hạn **“Chốt từ file nhập”** hoặc **“Giáo vụ sửa tay”**. Trước khi bỏ ghim, nói rõ buổi sẽ chỉ được xếp lại ở lần chạy tiếp theo, không đổi chỗ ngay lập tức.

### 9. Nút Lưu và Xuất ở cạnh bộ lọc nhưng không cùng phạm vi

Nếu tôi lọc lịch chỉ còn một giảng viên, nút **Xuất lưới** sẽ xuất phần đang xem, còn **Lưu thời khoá biểu** lại ghi giờ cho **toàn bộ** các lớp đang xếp. Hai nút đặt cạnh nhau nên rất dễ bị hiểu là cùng làm việc trên phần đã lọc. Hộp hỏi lại trước khi Lưu có nói “toàn bộ”, nhưng lúc ra quyết định ban đầu người dùng chưa biết điều đó.

**Nên làm:** Ghi trên nút hoặc sát cạnh nút: **“Xuất phần đang xem”** và **“Lưu toàn bộ lịch”**. Trong hộp xác nhận, nhắc lại rằng bộ lọc hiện tại không giới hạn phạm vi Lưu.

### 10. Cột “Phòng” chỉ hiện “LAB” hoặc “LT”, chưa trả lời học ở phòng nào

Ở lịch dạng Bảng và cửa sổ chi tiết buổi học, tôi thấy **“Phòng: LAB”** hoặc **“Phòng: LT”**. Đó có vẻ là **loại phòng**, không phải tên hoặc số phòng cụ thể. Nếu đang làm việc với giảng viên hay sinh viên, tôi có thể hiểu nhầm đây là phòng đã được cấp.

**Nên làm:** Đổi nhãn thành **“Loại phòng cần dùng”**, và nếu chưa có số phòng thật thì ghi **“Chưa gán phòng cụ thể”**. Đừng dùng chữ “Phòng” một mình nếu hệ thống mới chỉ tính sức chứa theo nhóm phòng.

### 11. Lớp “bỏ qua” biến mất ở bảng nhập nhưng vẫn có thể thấy trên lịch

Trang Dữ liệu học phần báo đang bỏ qua **79 lớp do đơn vị khác điều phối**, không hiện trong danh sách và không đưa vào phần xếp tự động. Trên lưới lịch, những lớp thuộc đơn vị khác đã có giờ vẫn có thể hiện để người dùng không xếp đè. Cách làm này có lý, nhưng người chỉ đọc thông báo “không hiện trong danh sách” sẽ nghĩ lớp đã biến mất khỏi toàn bộ hệ thống.

**Nên làm:** Thêm một câu tại chỗ: **“Lớp đã có giờ vẫn hiện trên lịch để tránh xếp trùng; khoa không sửa giờ những lớp này.”** Giữ cùng một tên gọi và ký hiệu ở bảng nhập và lưới.

### 12. Tôi chưa chắc cách hệ thống chia giảng viên thành cơ hữu và thỉnh giảng

Trang Giảng viên đang có hai nhóm, nhưng cũng cảnh báo **chưa nạp danh sách cơ hữu chính thức** và hệ thống đang đoán từ ô “Đơn vị công tác”. Trong khi đó, hai nhóm này quyết định thứ tự xếp lịch. Nếu không vào đúng trang Giảng viên để đọc cảnh báo, tôi có thể tin rằng việc phân nhóm đã được trường xác nhận.

**Nên làm:** Đưa cảnh báo này lên ngay cửa sổ **Quy trình xếp lịch**; nêu số người chưa được xác nhận và đặt đường dẫn tới bước nhập danh sách chính thức. Đừng chỉ hiển thị tổng số cơ hữu/thỉnh giảng như dữ liệu đã chắc chắn.

## Những chi tiết nhỏ nhưng dễ làm người mới khựng lại

### 13. Ba bộ đếm trên trang nhập liệu không nói cùng một chuyện

Tôi thấy **“Lớp đã nhập (214/293)”**, **“Chốt lịch 274/293 lớp”**, trong khi trang lịch ghi **“274/274 buổi”**. Có giải thích về các lớp bị bỏ qua, nhưng ba con số đứng xa nhau và dùng lẫn “lớp”, “buổi”, “đã nhập”, “đã chốt”. Tôi phải tự đoán mẫu số nào tính cả lớp của đơn vị khác và mẫu số nào chỉ tính buổi đang hiện.

**Nên làm:** Ghi nhãn đủ nghĩa bên cạnh từng số, ví dụ **“214 lớp đang hiện trong bảng / 293 lớp có trong dữ liệu”**. Thêm một khung “Cách tính các con số” ngắn ở trang nhập liệu và lịch.

### 14. Tab “Theo điều phối viên 0” lại mở ra 8 người

Ở phần Chuẩn bị dữ liệu → Học phần, tab ghi **“Theo điều phối viên 0”** nhưng bấm vào thấy danh sách **8 điều phối viên**, ai cũng đã đủ. Có thể số 0 nghĩa là **không còn người có việc cần làm**, song người dùng dễ tưởng tab trống.

**Nên làm:** Đổi thành **“Điều phối viên: 0 người còn việc”**, hoặc dùng số 8 nếu con số trên tab nhằm đếm số người trong danh sách.

### 15. Hai nút “Giảng viên” và “Học phần” thực ra là nút thêm mới

Ở đầu trang Dữ liệu học phần, tôi thấy ba nút đặt cạnh nhau: **Giảng viên**, **Học phần**, **Thêm lớp**. Hai nút đầu nghe như chuyển sang danh sách quản lý; bấm vào mới biết đó là biểu mẫu **thêm giảng viên mới** và **thêm học phần mới**.

**Nên làm:** Đặt tên thống nhất: **“Thêm giảng viên”**, **“Thêm học phần”**, **“Thêm lớp”**.

### 16. Cùng tên “Học phần” xuất hiện ở nhiều chỗ nhưng nói về hai việc khác nhau

**Dữ liệu học phần** là nơi nhập và sửa lớp. **Chuẩn bị dữ liệu → Học phần** lại là nơi xem việc cần làm trước khi xếp. Nếu đồng nghiệp chỉ bảo “vào Học phần”, tôi không biết phải vào đâu.

**Nên làm:** Đổi mục thứ hai thành **“Việc cần chuẩn bị”** hoặc **“Lớp chờ xếp”**; giữ “Dữ liệu học phần” cho bảng nhập thông tin.

### 17. “Tiết/tuần” và “30 tiết đã khai” đặt gần nhau nhưng không giải thích sự khác nhau

Ở danh sách giảng viên, một người có thể có **4 tiết/tuần** nhưng lại có **30 tiết đã khai** trong giờ có thể dạy. Khả năng cao một số là khối lượng dạy, số còn lại là những ô giờ người ấy có thể nhận lớp; người mới không tự biết hai con số này **không cần bằng nhau**.

**Nên làm:** Đổi nhãn thành **“Số tiết dự kiến dạy mỗi tuần”** và **“Số ô giờ có thể nhận lớp”**; thêm một dòng giải thích ngắn cạnh bảng.

### 18. “Nhật ký thao tác (0)” không cho biết đây chỉ là phiên hiện tại

Hệ thống đang có hàng trăm lớp, nhưng trang Nhật ký báo **0** và **“Chưa có thao tác nào được ghi lại”**. Hướng dẫn gọi đó là lịch sử hành động **trong phiên**, nhưng trên chính màn nhật ký không nói rõ. Tôi có thể tưởng chưa ai từng sửa dữ liệu, hoặc tưởng các lần làm trước đã bị mất.

**Nên làm:** Đổi thành **“Nhật ký của lần mở ứng dụng này”**, ghi rõ có hay không có lịch sử những lần trước; nếu không lưu nhật ký lâu dài thì tránh để mục này trông như một hồ sơ theo dõi đầy đủ.

### 19. Hướng dẫn vẫn dùng một số tên cũ, không giống màn hình tôi đang thấy

Phần giới thiệu nhắc thanh ba bước bắt đầu bằng **“Thu giờ”**, còn cửa sổ quy trình hiện bắt đầu bằng **“Học phần”**. Có chỗ hướng dẫn tôi tìm một **tab “Chưa xếp được”**, trong khi trên màn lịch tôi phải mở khu vực xem vấn đề để tìm các mục liên quan. Những tên không khớp làm người mới tưởng mình mở nhầm phiên bản.

**Nên làm:** Đi lại từng bước theo đúng giao diện hiện nay và sửa tên nút, vị trí nút trong hướng dẫn; tránh viết “tab” nếu thực tế đó là một phần nằm trong cửa sổ khác.

### 20. Một số chữ hiển thị vẫn là dạng không dấu

Trong chi tiết một buổi, thời gian hiện kiểu **“Thu 2 tiet 1”** bên cạnh giao diện tiếng Việt có dấu. Không ngăn tôi xếp lịch, nhưng làm tôi chậm đọc và kém tin vào thông tin giờ học.

**Nên làm:** Hiển thị thống nhất **“Thứ 2, tiết 1”** hoặc dải tiết đầy đủ nếu buổi kéo dài nhiều tiết.

## Nếu chỉ chọn vài việc để làm trước

1. Nói thật rõ **phạm vi sử dụng** và **việc bấm Lưu có/không tạo bản để khôi phục**.
2. Sửa những câu hướng dẫn/cảnh báo đang **trái với giao diện hiện có**, đặc biệt chuyện dữ liệu sau khi tắt ứng dụng và hai cách nhập Excel.
3. Đổi cách báo **tiến độ** để người dùng không hiểu “274/274” là đã xong hết, và đưa **14 lớp chưa kiểm được trùng lịch** lên chỗ dễ thấy.
4. Làm lưới toàn khoa dễ tra cứu hơn, hoặc dẫn người dùng chuyển sang **Bảng** và lọc theo chương trình.
5. Phân biệt **giờ chốt từ file** với **giờ sửa tay**, đồng thời nói rõ thao tác nào ảnh hưởng cả lịch, thao tác nào chỉ ảnh hưởng phần đang xem.

