# Quy tắc khẩu phần dinh dưỡng theo QĐ388 (RoseKids)

Nguồn: Chương trình GDMN thí điểm QĐ388, mục 2.1 Nuôi dưỡng (Nhà trẻ 24–36 tháng, Nhà trẻ 12–24 tháng, Mẫu giáo). Cô đã đối chiếu các đoạn Nhà trẻ 24–36 tháng và Mẫu giáo trong văn bản.

## 1. Nhu cầu năng lượng

| Nhóm | Cả ngày (kcal) | Tại cơ sở GDMN (kcal) | Ghi chú |
|---|---|---|---|
| Nhà trẻ 24–36 tháng | 930–1.000 | **579–676** (đạt 60–70% cả ngày) | Khoảng Đạt của RoseKids |
| Nhà trẻ 12–24 tháng | 650–1.086 | Không ghi mức "tại cơ sở". Ghi **517 kcal** là năng lượng từ thức ăn bổ sung, khi sữa mẹ ở mức trung bình | Cô chưa chọn cách tính cho nhóm này |
| Mẫu giáo | 1.230–1.320 | **638–701** (đạt 50–55% cả ngày) | Khoảng Đạt của RoseKids |

## 2. Tỷ lệ năng lượng từ các chất (theo khẩu phần)

| Nhóm | Đạm | Béo | Bột (tinh bột) |
|---|---|---|---|
| Nhà trẻ (12–24 và 24–36 tháng) | 13–20% | 30–40% | 47–50% |
| Mẫu giáo | 13–20% | 25–35% | 52–60% |

Tỷ lệ này là % năng lượng khẩu phần. RoseKids dùng một con số đại diện trong khoảng (để tính gram): Nhà trẻ 15 : 35 : 50, Mẫu giáo 15 : 30 : 55. Tổng bằng 100 và nằm trong khoảng văn bản.

## 3. Phân bổ bữa

- **Nhà trẻ 24–36 tháng:** 1 bữa chính, 2 bữa phụ. Bữa chính 20–35% năng lượng cả ngày. Bữa phụ 5–10%.
- **Mẫu giáo:** 1 bữa chính, 1 bữa phụ. Bữa chính 30–35%. Bữa phụ 15–25%.

## 4. Các quy định khác

- Bữa ăn đủ 4 nhóm chất: đạm, béo, tinh bột, vitamin và khoáng.
- Khuyến khích tối thiểu 5/8 nhóm thực phẩm mỗi ngày.
- Nước uống: Nhà trẻ 24–36 tháng 800–1.000 ml/trẻ/ngày. Mẫu giáo 1.000–2.000 ml/ngày. Nhà trẻ 12–24 tháng tính thêm nước ngoài thức ăn và sữa là 200–500 ml.
- Bảo đảm an toàn thực phẩm khi chế biến.
- Chế biến phù hợp độ tuổi. Không thêm gia vị, mắm, muối vào thức ăn trẻ dưới 12 tháng.
- Xây dựng chế độ ăn phù hợp với trẻ và điều kiện thực tế tại cơ sở.

## 5. Cách RoseKids tính

- **Calo của thực đơn** = 4 × đạm + 9 × béo + 4 × đường (cộng đạm, béo, đường của tất cả thực phẩm, tính theo gram). Đây là cách SC tính, không phải do QĐ388 quy định.
- **Kết luận:** Đạt nếu Calo nằm trong khoảng "tại cơ sở". Thiếu nếu thấp hơn. Thừa nếu cao hơn.
- **Tỷ lệ P:L:G** hiển thị trong màn hình là phần trăm năng lượng thực tế của thực đơn, so với khoảng trong mục 2.
- Mã nguồn: `KP_CFG0.groups` trong `index.html`, các trường `sch` (khoảng tại cơ sở), `evr` (khoảng tỷ lệ), `plg` (tỷ lệ để tính gram), `q` (đánh dấu đã theo QĐ388).

## 6. Việc còn mở

- Nhà trẻ 12–24 tháng: cô chọn cách tính riêng hay vẫn dùng 24–36 tháng.
- Bản văn đang dùng là bản OCR và bản cô dán. Nên đối chiếu lại với bản PDF/Word gốc trước khi in.
