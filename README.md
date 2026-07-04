# 🏦 Simple Banking App

Một ứng dụng ngân hàng trực tuyến được xây dựng theo kiến trúc Microservices cơ bản với mô hình Client-Server. Ứng dụng cung cấp các tính năng cốt lõi của một hệ thống ngân hàng như: Đăng nhập/Đăng ký, Quản lý tài khoản, Chuyển tiền an toàn, và Xem lịch sử giao dịch.

## 🚀 Công nghệ sử dụng

* **Frontend:** React 18, Vite, TypeScript, Axios, Lucide React (Icons).
* **Backend:** NestJS, TypeScript, TypeORM, JSON Web Token (JWT).
* **Database:** PostgreSQL 15.
* **DevOps:** Docker, Docker Compose.

## 🛠 Yêu cầu hệ thống

Để chạy dự án, máy tính của bạn cần cài đặt sẵn phần mềm duy nhất:
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Bắt buộc)
- Git (Để tải code về máy)

## ⚙️ Hướng dẫn Cài đặt & Khởi chạy

1. **Clone dự án về máy:**
   ```bash
   git clone https://github.com/DungUETK68/Simple-Banking-App.git
   cd Simple-Banking-App
   ```

2. **Cấu hình biến môi trường (.env):**
   Tại thư mục gốc của dự án, hãy tạo một file có tên là `.env` và copy nội dung sau vào:
   ```env
   # Database config
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=root
   DB_PASSWORD=rootpassword
   DB_NAME=simple_banking

   # App config
   PORT=3000

   # JWT
   JWT_SECRET=super_secret_jwt_key_example
   JWT_EXPIRATION=15m
   JWT_REFRESH_SECRET=super_secret_refresh_token_example
   JWT_REFRESH_EXPIRATION=7d
   ```

3. **Khởi chạy hệ thống bằng Docker Compose:**
   ```bash
   docker compose up --build -d
   ```

4. **Truy cập Ứng dụng:**
   - **Frontend (Web App):** Mở trình duyệt và vào [http://localhost:5173](http://localhost:5173)
   - **Backend API (NestJS):** Chạy ngầm tại `http://localhost:3000`
   - **Database (PostgreSQL):** Chạy tại cổng `5432` (User: `root`, Password: `rootpassword`, DB: `simple_banking`)

## 🛑 Dừng và Xóa dữ liệu

Khi không sử dụng nữa, bạn có thể tắt các container đi để giải phóng RAM bằng lệnh:
```bash
docker compose down
```

Nếu bạn muốn **xóa trắng** luôn cả Database (reset lại như mới):
```bash
docker compose down -v
```

---
*Phát triển bởi [DungUETK68](https://github.com/DungUETK68)*