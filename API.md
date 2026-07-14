# 📡 API Documentation

Base URL (local): `http://localhost:8000`

เอกสารอัตโนมัติแบบโต้ตอบได้: `http://localhost:8000/docs` (Swagger UI)

## การยืนยันตัวตน (Authentication)

API ส่วนใหญ่ต้องแนบ **JWT Token** ใน header:

```
Authorization: Bearer <access_token>
```

Token ได้จากการเรียก `POST /api/login`

สำหรับ endpoint ที่เป็นสื่อ (วิดีโอ/PDF) ซึ่งเรียกผ่าน `<video>` หรือ `<iframe>`
สามารถส่ง token ผ่าน query string แทนได้: `?access_token=<token>`

ระดับสิทธิ์:
- 🔓 **Public** — ไม่ต้อง login
- 🔑 **User** — ต้อง login (admin หรือ member)
- 🛡️ **Admin** — ต้องเป็น admin เท่านั้น

---

## Endpoints

### 🔓 Health Check

```http
GET /api/health
```

**Response 200**
```json
{ "status": "healthy" }
```

---

### 🔓 Login

```http
POST /api/login
Content-Type: application/json
```

**Body**
```json
{ "username": "admin", "password": "admin1234" }
```

**Response 200**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "role": "admin",
  "username": "admin"
}
```

**Response 401** — username หรือ password ไม่ถูกต้อง

---

### 🔑 Dashboard

```http
GET /api/dashboard
Authorization: Bearer <token>
```

**Response 200**
```json
{
  "video_count": 5,
  "document_count": 3,
  "recent_videos": [ { "id": 1, "title": "video01.mp4", "...": "..." } ],
  "recent_documents": [ { "id": 1, "title": "doc01.pdf", "...": "..." } ]
}
```

---

### 🔑 List Videos

```http
GET /api/videos
Authorization: Bearer <token>
```

**Response 200**
```json
[
  {
    "id": 1,
    "title": "video01.mp4",
    "filename": "video01.mp4",
    "mime_type": "video/mp4",
    "size": 52428800,
    "thumbnail": "https://...",
    "created_at": "2026-01-10T08:30:00Z"
  }
]
```

---

### 🔑 Get Video (metadata)

```http
GET /api/videos/{video_id}
Authorization: Bearer <token>
```

**Response 200** — ข้อมูลวิดีโอ 1 รายการ
**Response 404** — ไม่พบวิดีโอ

---

### 🔑 Stream Video ⭐

```http
GET /api/video/{video_id}/stream
Authorization: Bearer <token>
Range: bytes=0-           (optional)
```

Stream ไฟล์วิดีโอจาก Google Drive ผ่าน Backend
รองรับ **HTTP Range Request** — เล่น/เลื่อน/หยุด-เล่นต่อได้

**Response 200** — ส่งทั้งไฟล์ (ไม่มี Range)
**Response 206** — Partial Content (มี Range) พร้อม header:
- `Content-Range: bytes 0-1023/52428800`
- `Accept-Ranges: bytes`
- `Content-Type: video/mp4`

> ผู้ใช้ **ไม่เห็น** Google Drive File ID — ใช้เฉพาะ `video_id` ภายในระบบ

---

### 🔑 List Documents

```http
GET /api/documents
Authorization: Bearer <token>
```

**Response 200**
```json
[
  {
    "id": 1,
    "title": "document01.pdf",
    "filename": "document01.pdf",
    "size": 1048576,
    "created_at": "2026-01-10T08:30:00Z"
  }
]
```

---

### 🔑 Get Document (PDF) ⭐

```http
GET /api/document/{document_id}
Authorization: Bearer <token>
```

ส่งไฟล์ PDF (inline) เพื่อเปิดอ่านในเบราว์เซอร์

**Response 200** — `Content-Type: application/pdf`
**Response 404** — ไม่พบเอกสาร

---

## 🛡️ Admin Endpoints

### List Users

```http
GET /api/admin/users
Authorization: Bearer <admin-token>
```

**Response 200** — รายชื่อผู้ใช้ทั้งหมด

---

### Create User

```http
POST /api/admin/users
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Body**
```json
{ "username": "somchai", "password": "pass1234", "role": "member" }
```

**Response 201** — ผู้ใช้ที่สร้าง
**Response 409** — ชื่อผู้ใช้ซ้ำ

---

### Delete User

```http
DELETE /api/admin/users/{user_id}
Authorization: Bearer <admin-token>
```

**Response 204** — ลบสำเร็จ
**Response 400** — ลบตัวเองไม่ได้
**Response 404** — ไม่พบผู้ใช้

---

### Reset Password

```http
POST /api/admin/users/{user_id}/reset-password
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Body**
```json
{ "new_password": "newpass1234" }
```

**Response 200** — ผู้ใช้ที่อัปเดต

---

### Google Drive Status

```http
GET /api/admin/drive/status
Authorization: Bearer <admin-token>
```

**Response 200**
```json
{
  "connected": true,
  "expires_at": "2026-01-10T10:30:00Z",
  "has_refresh_token": true
}
```

---

### Sync Google Drive

```http
POST /api/admin/drive/sync
Authorization: Bearer <admin-token>
```

อ่านโฟลเดอร์ Videos และ Documents บน Drive แล้วบันทึกลงฐานข้อมูล

**Response 200**
```json
{
  "videos_added": 5,
  "documents_added": 3,
  "videos_total": 5,
  "documents_total": 3
}
```

**Response 400** — ยังไม่ได้เชื่อมต่อ Google Drive

---

## 🔐 Google OAuth Endpoints

### Get Authorization URL

```http
GET /api/auth/google
Authorization: Bearer <admin-token>
```

**Response 200**
```json
{ "authorization_url": "https://accounts.google.com/o/oauth2/auth?..." }
```

Frontend จะพาเบราว์เซอร์ไปยัง URL นี้เพื่อให้ admin ล็อกอิน Google

---

### OAuth Callback

```http
GET /api/auth/google/callback?code=<auth_code>
```

Google เรียก endpoint นี้หลัง admin อนุญาต
Backend แลก code เป็น token เก็บลงฐานข้อมูล แล้ว redirect กลับหน้า Admin

**Response** — Redirect ไปที่ `<FRONTEND_ORIGIN>/admin?google=connected`

---

## รหัสสถานะที่ใช้ (HTTP Status Codes)

| Code | ความหมาย |
|------|----------|
| 200 | สำเร็จ |
| 201 | สร้างสำเร็จ |
| 204 | สำเร็จ (ไม่มีเนื้อหาส่งกลับ) |
| 206 | Partial Content (streaming แบบ Range) |
| 400 | คำขอผิดพลาด |
| 401 | ยังไม่ได้ยืนยันตัวตน / token ผิด |
| 403 | ไม่มีสิทธิ์ (ต้องเป็น admin) |
| 404 | ไม่พบข้อมูล |
| 409 | ข้อมูลซ้ำ |
| 502 | Google Drive ตอบกลับผิดพลาด |
