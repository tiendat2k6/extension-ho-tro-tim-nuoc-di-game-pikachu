# Pikachu Helper Chrome Extension

![icon](icons/icon48.png)

## Giới thiệu
Pikachu Helper là tiện ích mở rộng Chrome giúp bạn quét bàn chơi game Pikachu cổ điển, tự động tìm và highlight các cặp ô có thể nối theo đúng luật, hỗ trợ chơi nhanh và chính xác hơn.

- Quét bàn, trả về ma trận số (ô ẩn = -1)
- Highlight cặp nối được đầu tiên
- Tùy chọn tự động gợi ý liên tục
- Giao diện hiện đại, chuyên nghiệp, dễ sử dụng

## Tính năng
- **Hiện gợi ý:** Tìm và highlight cặp nối được đầu tiên trên bàn chơi
- **Auto:** Tự động gợi ý liên tục mỗi 2 giây
- **Giao diện:** Nút bấm lớn, switch hiện đại, trạng thái rõ ràng, responsive
- **Tác giả:** Created by Phan Tiến Đạt

## Cài đặt & Sử dụng
1. Clone hoặc tải về repo này:
   ```
   git clone https://github.com/tiendat2k6/extension-ho-tro-tim-nuoc-di-game-pikachu.git
   ```
2. Mở Chrome, vào `chrome://extensions/`
3. Bật chế độ Developer Mode (Chế độ nhà phát triển)
4. Chọn "Load unpacked" (Tải tiện ích chưa đóng gói)
5. Chọn thư mục dự án này
6. Truy cập trang game Pikachu cổ điển: [pikachucodien.net](https://www.pikachucodien.net/)
7. Bấm vào icon extension, sử dụng các nút gợi ý

## Cấu trúc dự án
```
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background/
│   │   └── background.js
│   ├── content/
│   │   └── content.js
│   └── popup/
│       ├── popup.html
│       ├── popup.css
│       └── popup.js
```

## Đóng góp & Liên hệ
- Mọi ý kiến đóng góp, báo lỗi hoặc đề xuất tính năng mới vui lòng tạo issue hoặc pull request trên Github.
- Tác giả: [Phan Tiến Đạt](https://github.com/tiendat2k6)

## License
MIT

---
> **Pikachu Helper** – Giúp bạn chơi Pikachu nhanh, chuẩn, vui hơn!
