# Multi-stage Dockerfile cho VJU-Calendar

# --- STAGE 1: Build Frontend (React + Vite) ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Chuẩn bị cấu hình mẫu để Vite build không bị lỗi thiếu file
COPY config/ config/
RUN if [ ! -f config/frontend.json ]; then cp config/frontend-example.json config/frontend.json; fi

# Cài đặt dependencies frontend
COPY frontend/package*.json frontend/
WORKDIR /app/frontend
RUN npm ci || npm install

# Copy source code frontend và build ra thư mục frontend/dist
COPY frontend/ .
RUN npm run build

# --- STAGE 2: Backend & Runtime (Python + Flask) ---
FROM python:3.11-slim
WORKDIR /app

# Cài đặt curl để kiểm tra healthcheck nếu cần
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt dependencies Python
COPY webapp/requirements.txt webapp/
RUN pip install --no-cache-dir -r webapp/requirements.txt gunicorn

# Copy mã nguồn backend và cấu hình
COPY webapp/ webapp/
COPY config/ config/
RUN if [ ! -f config/backend.json ]; then cp config/backend-example.json config/backend.json; fi

# Copy frontend/dist đã build từ stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Tạo thư mục dữ liệu snapshot
RUN mkdir -p /app/webapp/data

ENV HOST=0.0.0.0
ENV PORT=5055
ENV PYTHONUNBUFFERED=1

EXPOSE 5055

WORKDIR /app/webapp

# Chạy với gunicorn (1 worker + threads để đảm bảo tính nhất quán của STATE toàn cục trong RAM)
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5055} --workers 1 --threads 4 --timeout 180 app:app"]
