# 🎬 Private Video Learning Platform

> เว็บดูวิดีโอและอ่าน PDF ภายในองค์กร โดยใช้ **Google Drive** เป็นที่เก็บไฟล์
> ผู้ใช้ไม่ต้องรู้ว่าไฟล์อยู่บน Google Drive และไม่ต้องดาวน์โหลดไฟล์ลงเครื่อง

คู่มือนี้เขียนสำหรับ **ผู้เริ่มต้น** อ่านตามลำดับตั้งแต่ต้นจนจบก็ใช้งานได้เลย

---

## สารบัญ

1. [ระบบนี้คืออะไร](#1-ระบบนี้คืออะไร)
2. [ภาพรวมสถาปัตยกรรม (Architecture)](#2-ภาพรวมสถาปัตยกรรม)
3. [สิ่งที่ต้องเตรียมก่อนเริ่ม](#3-สิ่งที่ต้องเตรียมก่อนเริ่ม)
4. [วิธีติดตั้ง Backend](#4-วิธีติดตั้ง-backend)
5. [วิธีติดตั้ง Frontend](#5-วิธีติดตั้ง-frontend)
6. [วิธีสร้าง Google Cloud Project](#6-วิธีสร้าง-google-cloud-project)
7. [วิธีเปิดใช้งาน Google Drive API](#7-วิธีเปิดใช้งาน-google-drive-api)
8. [วิธีตั้งค่า OAuth Consent Screen](#8-วิธีตั้งค่า-oauth-consent-screen)
9. [วิธีสร้าง OAuth Client ID](#9-วิธีสร้าง-oauth-client-id)
10. [วิธีใส่ค่า Environment Variables](#10-วิธีใส่ค่า-environment-variables)
11. [วิธีหา Folder ID ของ Google Drive](#11-วิธีหา-folder-id-ของ-google-drive)
12. [วิธี Login Google เพื่อรับ Token](#12-วิธี-login-google-เพื่อรับ-token)
13. [วิธี Sync ไฟล์จาก Google Drive](#13-วิธี-sync-ไฟล์จาก-google-drive)
14. [วิธีเพิ่มผู้ใช้ (User)](#14-วิธีเพิ่มผู้ใช้)
15. [วิธี Run โปรเจกต์ทั้งหมด](#15-วิธี-run-โปรเจกต์ทั้งหมด)
16. [วิธี Deploy ขึ้นใช้งานจริง](#16-วิธี-deploy-ขึ้นใช้งานจริง)
17. [แก้ปัญหาที่พบบ่อย (Troubleshooting)](#17-แก้ปัญหาที่พบบ่อย)

---

## 1. ระบบนี้คืออะไร

ระบบนี้คือเว็บไซต์ดูวิดีโอและอ่านเอกสาร PDF สำหรับใช้ **ภายในองค์กรหรือกลุ่มปิด**
แนวคิดหลักคือ:

- ไฟล์วิดีโอและ PDF **เก็บไว้บน Google Drive** (ไม่เปลืองพื้นที่ Server)
- **Backend เป็นตัวกลาง** ดึงไฟล์จาก Google Drive มาส่งให้ผู้ใช้
- ผู้ใช้เห็นแค่หน้าเว็บสวย ๆ **ไม่เห็นลิงก์ Google Drive และไม่รู้ว่าไฟล์อยู่ที่ไหน**
- ผู้ใช้ **ไม่ต้องดาวน์โหลดไฟล์** ทั้งก้อน (เช่นวิดีโอ 40GB) — ระบบใช้เทคนิค Streaming
  ส่งเป็นช่วง ๆ ทำให้เล่นได้ทันที เลื่อน Timeline ได้ หยุด/เล่นต่อได้
- มีระบบ **Login** และ **แบ่งสิทธิ์** เป็น 2 ระดับ:
  - `admin` — จัดการผู้ใช้และเชื่อมต่อ Google Drive
  - `member` — ดูวิดีโอและอ่านเอกสารได้อย่างเดียว
- **ไม่มีการสมัครสมาชิกเอง** — Admin เป็นผู้เพิ่มผู้ใช้ทุกคน

### ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| 🔐 Login | ใช้ Username + Password (เข้ารหัสด้วย bcrypt) และ JWT |
| 👥 จัดการผู้ใช้ | Admin เพิ่ม / ลบ / รีเซ็ตรหัสผ่านได้ |
| 📺 ดูวิดีโอ | Streaming จาก Google Drive รองรับ mp4 / webm / mkv |
| 📄 อ่าน PDF | เปิดอ่านในเว็บได้เลย ไม่ต้องดาวน์โหลด |
| 🔄 Sync | ดึงรายชื่อไฟล์จาก Google Drive เข้าฐานข้อมูลอัตโนมัติ |
| 🛡️ ความปลอดภัย | ซ่อน File ID ของ Google Drive, ตรวจสิทธิ์ทุก API |

---

## 2. ภาพรวมสถาปัตยกรรม

```
┌─────────────────┐
│  User Browser   │   ← ผู้ใช้เปิดเว็บผ่านเบราว์เซอร์
└────────┬────────┘
         │  HTTPS
         ▼
┌─────────────────┐
│    Frontend     │   ← Next.js + React + TypeScript + Tailwind
│   (Next.js)     │      หน้าจอสวยงาม, จัดการการ Login
└────────┬────────┘
         │  เรียก API (แนบ JWT Token)
         ▼
┌─────────────────┐
│   Backend API   │   ← FastAPI (Python)
│   (FastAPI)     │      • ตรวจสอบ Login / สิทธิ์
│                 │      • ขอไฟล์จาก Google Drive
│                 │      • Stream วิดีโอ / ส่ง PDF
│                 │      • ซ่อน Google Drive URL
└────────┬────────┘
         │  ใช้ Access Token (OAuth 2.0)
         ▼
┌─────────────────┐
│ Google Drive    │   ← Google Drive API v3
│      API        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Google Drive    │   ← บัญชี Google เจ้าของไฟล์จริง
│ (เจ้าของไฟล์)   │      เก็บโฟลเดอร์ Videos และ Documents
└─────────────────┘
```

**จุดสำคัญ:** ผู้ใช้เว็บ **ไม่เคย** ติดต่อ Google Drive โดยตรง ทุกอย่างผ่าน Backend เท่านั้น
และ Backend จะส่งให้ผู้ใช้เป็น "รหัสภายใน" (เช่น video id = 5) ไม่ใช่ Google Drive File ID จริง

### โครงสร้างโฟลเดอร์บน Google Drive

```
Google Drive
│
├── 📁 Videos          ← เก็บไฟล์วิดีโอ
│     ├── video01.mp4
│     ├── video02.webm
│     └── ...
│
└── 📁 Documents       ← เก็บไฟล์ PDF
      ├── document01.pdf
      ├── document02.pdf
      └── ...
```

### โครงสร้างไฟล์ในโปรเจกต์

```
video-platform/
├── backend/                    # FastAPI (Python)
│   ├── app/
│   │   ├── main.py             # จุดเริ่มต้นของแอป
│   │   ├── core/               # การตั้งค่า, ฐานข้อมูล, ความปลอดภัย
│   │   │   ├── config.py       # อ่านค่าจาก .env
│   │   │   ├── database.py     # เชื่อมต่อ SQLite
│   │   │   ├── security.py     # เข้ารหัสผ่าน + JWT
│   │   │   └── deps.py         # ตรวจสอบสิทธิ์ (Auth guard)
│   │   ├── models/             # ตารางฐานข้อมูล
│   │   ├── schemas/            # รูปแบบข้อมูล request/response
│   │   ├── routers/            # เส้นทาง API
│   │   │   ├── auth.py         # login + Google OAuth
│   │   │   ├── admin.py        # จัดการผู้ใช้ + sync drive
│   │   │   └── content.py      # วิดีโอ, สตรีม, เอกสาร
│   │   └── services/
│   │       └── drive_service.py # ทำงานกับ Google Drive
│   ├── requirements.txt        # รายชื่อ library
│   └── .env.example            # ตัวอย่างไฟล์ตั้งค่า
│
├── frontend/                   # Next.js (TypeScript)
│   ├── src/
│   │   ├── app/                # หน้าเว็บต่าง ๆ
│   │   │   ├── login/          # หน้า Login
│   │   │   ├── dashboard/      # หน้าภาพรวม
│   │   │   ├── videos/         # คลังวิดีโอ + player
│   │   │   ├── documents/      # คลังเอกสาร
│   │   │   └── admin/          # หน้า Admin
│   │   ├── components/         # ส่วนประกอบที่ใช้ซ้ำ
│   │   ├── lib/                # API client, auth context
│   │   └── types/              # TypeScript types
│   ├── package.json
│   └── .env.local.example
│
├── API.md                      # เอกสาร API
└── README.md                   # ไฟล์นี้
```

---

## 3. สิ่งที่ต้องเตรียมก่อนเริ่ม

ติดตั้งโปรแกรมเหล่านี้ในเครื่องก่อน:

| โปรแกรม | เวอร์ชันแนะนำ | ใช้ทำอะไร | ลิงก์ดาวน์โหลด |
|---------|-------------|-----------|---------------|
| **Python** | 3.10 ขึ้นไป | รัน Backend | https://www.python.org/downloads/ |
| **Node.js** | 18 ขึ้นไป | รัน Frontend | https://nodejs.org/ |
| **บัญชี Google** | — | เก็บไฟล์บน Drive | https://accounts.google.com/ |

ตรวจสอบว่าติดตั้งสำเร็จ โดยเปิด Terminal แล้วพิมพ์:

```bash
python --version    # ควรขึ้น Python 3.10.x หรือสูงกว่า
node --version      # ควรขึ้น v18.x หรือสูงกว่า
npm --version       # ควรขึ้นเลขเวอร์ชัน
```

> 💡 บน Windows ถ้าพิมพ์ `python` แล้วไม่ขึ้น ให้ลอง `py` แทน
> บน macOS/Linux ถ้า `python` ไม่ได้ ให้ลอง `python3`

---

## 4. วิธีติดตั้ง Backend

เปิด Terminal แล้วทำตามทีละขั้น

**ขั้นที่ 1:** เข้าไปในโฟลเดอร์ backend

```bash
cd video-platform/backend
```

**ขั้นที่ 2:** สร้าง Virtual Environment (พื้นที่แยกสำหรับ library ของโปรเจกต์นี้)

```bash
# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

# Windows (Command Prompt)
python -m venv .venv
.venv\Scripts\activate

# Windows (PowerShell)
python -m venv .venv
.venv\Scripts\Activate.ps1
```

เมื่อสำเร็จจะเห็น `(.venv)` อยู่หน้าบรรทัด Terminal

**ขั้นที่ 3:** ติดตั้ง library ทั้งหมด

```bash
pip install -r requirements.txt
```

**ขั้นที่ 4:** สร้างไฟล์ตั้งค่า `.env` จากตัวอย่าง

```bash
# macOS / Linux
cp .env.example .env

# Windows
copy .env.example .env
```

> ตอนนี้ยังไม่ต้องกรอกค่าใน `.env` ก็รันได้ (ระบบจะสร้างบัญชี admin ให้อัตโนมัติ)
> แต่ถ้าจะใช้ Google Drive ต้องกรอกค่าตาม [ข้อ 10](#10-วิธีใส่ค่า-environment-variables) ก่อน

**ขั้นที่ 5:** รัน Backend

```bash
uvicorn app.main:app --reload --port 8000
```

ถ้าสำเร็จจะเห็นข้อความประมาณนี้:

```
[seed] Created default admin 'admin'
INFO:     Uvicorn running on http://127.0.0.1:8000
```

เปิดเบราว์เซอร์ไปที่ **http://localhost:8000/docs** จะเห็นหน้าเอกสาร API อัตโนมัติของ FastAPI

> 🔑 **บัญชี admin เริ่มต้น:** username = `admin`, password = `admin1234`
> (เปลี่ยนได้ในไฟล์ `.env` ที่ตัวแปร `ADMIN_USERNAME` และ `ADMIN_PASSWORD` — แต่ต้องลบไฟล์ `app.db` แล้วรันใหม่ ค่าจึงจะมีผล)

---

## 5. วิธีติดตั้ง Frontend

**เปิด Terminal หน้าต่างใหม่** (ปล่อยให้ Backend รันอยู่ในหน้าต่างเดิม)

**ขั้นที่ 1:** เข้าไปในโฟลเดอร์ frontend

```bash
cd video-platform/frontend
```

**ขั้นที่ 2:** ติดตั้ง library

```bash
npm install
```

**ขั้นที่ 3:** สร้างไฟล์ตั้งค่า `.env.local`

```bash
# macOS / Linux
cp .env.local.example .env.local

# Windows
copy .env.local.example .env.local
```

เปิดไฟล์ `.env.local` ตรวจสอบว่ามีค่านี้ (ชี้ไปที่ Backend):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**ขั้นที่ 4:** รัน Frontend

```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ **http://localhost:3000** จะเห็นหน้า Login
ลอง Login ด้วย `admin` / `admin1234`

---

## 6. วิธีสร้าง Google Cloud Project

ส่วนนี้จำเป็นถ้าต้องการใช้ Google Drive เป็นที่เก็บไฟล์

**ขั้นที่ 1:** ไปที่ Google Cloud Console
👉 https://console.cloud.google.com/

**ขั้นที่ 2:** ล็อกอินด้วยบัญชี Google **ที่เป็นเจ้าของไฟล์** ที่จะใช้เก็บวิดีโอ/PDF

**ขั้นที่ 3:** สร้างโปรเจกต์ใหม่
- คลิกที่ชื่อโปรเจกต์มุมซ้ายบน (ข้าง ๆ คำว่า "Google Cloud")
- คลิกปุ่ม **"New Project"** (โปรเจกต์ใหม่)
- ตั้งชื่อโปรเจกต์ เช่น `Video Learning Platform`
- คลิก **"Create"**

**ขั้นที่ 4:** รอสักครู่ แล้วเลือกโปรเจกต์ที่เพิ่งสร้างจากเมนูมุมซ้ายบน

---

## 7. วิธีเปิดใช้งาน Google Drive API

**ขั้นที่ 1:** ในเมนูซ้าย เลือก **APIs & Services → Library**
(หรือไปที่ 👉 https://console.cloud.google.com/apis/library)

**ขั้นที่ 2:** ในช่องค้นหา พิมพ์ **`Google Drive API`**

**ขั้นที่ 3:** คลิกที่ **Google Drive API** แล้วกดปุ่ม **"Enable"** (เปิดใช้งาน)

รอสักครู่จนขึ้นว่าเปิดใช้งานเรียบร้อย

---

## 8. วิธีตั้งค่า OAuth Consent Screen

หน้านี้คือหน้าที่ Google จะแสดงตอนขออนุญาตเข้าถึง Drive

**ขั้นที่ 1:** ไปที่ **APIs & Services → OAuth consent screen**
(👉 https://console.cloud.google.com/apis/credentials/consent)

**ขั้นที่ 2:** เลือกประเภทผู้ใช้ (User Type)
- เลือก **"External"** (ภายนอก) แล้วกด **Create**
  *(ถ้าใช้ Google Workspace ขององค์กร จะเลือก "Internal" ก็ได้ ไม่ต้องยืนยันตัวตน)*

**ขั้นที่ 3:** กรอกข้อมูลแอป (App information)
- **App name:** เช่น `Video Learning Platform`
- **User support email:** เลือกอีเมลของคุณ
- **Developer contact information:** ใส่อีเมลของคุณ
- ที่เหลือปล่อยว่างได้ แล้วกด **"Save and Continue"**

**ขั้นที่ 4:** หน้า Scopes — กด **"Save and Continue"** ผ่านไปได้เลย
*(เราจะกำหนด scope ในโค้ดอยู่แล้ว คือ `drive.readonly`)*

**ขั้นที่ 5:** หน้า Test users — **สำคัญมาก**
- กด **"+ Add Users"**
- ใส่อีเมล Google **ที่เป็นเจ้าของไฟล์ Drive** (บัญชีเดียวกับที่จะใช้ Login เชื่อม Drive)
- กด **"Save and Continue"**

> ⚠️ ถ้าไม่เพิ่มอีเมลตัวเองใน Test users จะ Login เชื่อม Drive **ไม่ได้**
> (จะขึ้น error `access_denied`)

> 💡 ตอนนี้แอปอยู่ในโหมด "Testing" ซึ่งเพียงพอสำหรับใช้ภายในองค์กร
> ไม่ต้องส่งให้ Google ตรวจสอบ (verification) ก็ใช้งานได้

---

## 9. วิธีสร้าง OAuth Client ID

**ขั้นที่ 1:** ไปที่ **APIs & Services → Credentials**
(👉 https://console.cloud.google.com/apis/credentials)

**ขั้นที่ 2:** กด **"+ Create Credentials"** → เลือก **"OAuth client ID"**

**ขั้นที่ 3:** เลือก Application type เป็น **"Web application"**

**ขั้นที่ 4:** ตั้งชื่อ เช่น `Video Platform Backend`

**ขั้นที่ 5:** ในหัวข้อ **Authorized redirect URIs** กด **"+ Add URI"** แล้วใส่:

```
http://localhost:8000/api/auth/google/callback
```

> ⚠️ ต้องตรงกับค่า `GOOGLE_REDIRECT_URI` ในไฟล์ `.env` **เป๊ะ ๆ** (ทุกตัวอักษร)
> ตอน Deploy จริงให้เพิ่ม URL ของ Server จริงเข้าไปด้วย เช่น
> `https://api.yourdomain.com/api/auth/google/callback`

**ขั้นที่ 6:** กด **"Create"**

**ขั้นที่ 7:** จะมีหน้าต่างเด้งขึ้นมาแสดง **Client ID** และ **Client Secret**
👉 **คัดลอกทั้งสองค่านี้เก็บไว้** (จะเอาไปใส่ในไฟล์ `.env`)

---

## 10. วิธีใส่ค่า Environment Variables

เปิดไฟล์ `backend/.env` ด้วย Text Editor แล้วกรอกค่าต่าง ๆ:

```env
# ===== Google OAuth (จากข้อ 9) =====
GOOGLE_CLIENT_ID=วางค่า Client ID ที่คัดลอกมา
GOOGLE_CLIENT_SECRET=วางค่า Client Secret ที่คัดลอกมา
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# ===== Google Drive Folder ID (จากข้อ 11) =====
GOOGLE_DRIVE_FOLDER_VIDEO=วาง Folder ID ของโฟลเดอร์ Videos
GOOGLE_DRIVE_FOLDER_DOCUMENT=วาง Folder ID ของโฟลเดอร์ Documents

# ===== JWT (สร้าง secret ใหม่) =====
JWT_SECRET=สร้างรหัสลับยาว ๆ ดูวิธีด้านล่าง
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# ===== ฐานข้อมูล =====
DATABASE_URL=sqlite:///./app.db

# ===== ที่อยู่ Frontend (สำหรับ CORS) =====
FRONTEND_ORIGIN=http://localhost:3000

# ===== บัญชี admin เริ่มต้น (สร้างครั้งแรกเท่านั้น) =====
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin1234
```

### วิธีสร้าง JWT_SECRET ที่ปลอดภัย

รันคำสั่งนี้ใน Terminal แล้วคัดลอกผลลัพธ์ไปใส่:

```bash
# macOS / Linux
openssl rand -hex 32

# หรือใช้ Python (ได้ทุก OS)
python -c "import secrets; print(secrets.token_hex(32))"
```

> 🔒 **JWT_SECRET คือกุญแจสำคัญ** ห้ามเปิดเผย และห้ามใช้ค่าเริ่มต้นตอนใช้งานจริง
> ถ้าใครรู้ค่านี้ จะสามารถปลอมตัวเป็นผู้ใช้คนใดก็ได้

หลังแก้ไฟล์ `.env` เสร็จ ให้ **รัน Backend ใหม่** (กด `Ctrl+C` แล้วรัน `uvicorn` อีกครั้ง)

---

## 11. วิธีหา Folder ID ของ Google Drive

**ขั้นที่ 1:** ไปที่ https://drive.google.com/ (ล็อกอินด้วยบัญชีเจ้าของไฟล์)

**ขั้นที่ 2:** สร้างโฟลเดอร์ 2 อัน ชื่อ **Videos** และ **Documents**
แล้วอัปโหลดไฟล์วิดีโอ/PDF เข้าไปในแต่ละโฟลเดอร์

**ขั้นที่ 3:** ดับเบิลคลิกเข้าไปในโฟลเดอร์ **Videos**

**ขั้นที่ 4:** ดูที่ URL บนแถบเบราว์เซอร์ จะเป็นแบบนี้:

```
https://drive.google.com/drive/folders/1AbC2DeFgHiJkLmNoPqRsTuVwXyZ12345
                                        └──────────── นี่คือ Folder ID ─────────┘
```

**ส่วนหลัง `/folders/`** คือ Folder ID → คัดลอกไปใส่ `GOOGLE_DRIVE_FOLDER_VIDEO`

**ขั้นที่ 5:** ทำแบบเดียวกันกับโฟลเดอร์ **Documents** → ใส่ `GOOGLE_DRIVE_FOLDER_DOCUMENT`

---

## 12. วิธี Login Google เพื่อรับ Token

ทำหลังจากรัน Backend + Frontend และกรอก `.env` ครบแล้ว

**ขั้นที่ 1:** เปิดเว็บ http://localhost:3000 แล้ว Login ด้วยบัญชี **admin**

**ขั้นที่ 2:** ไปที่เมนู **"ผู้ดูแลระบบ"** (Admin) ทางซ้าย

**ขั้นที่ 3:** ในการ์ด **Google Drive** กดปุ่ม **"เชื่อมต่อ Google Drive"**

**ขั้นที่ 4:** ระบบจะพาไปหน้า Login ของ Google
- เลือกบัญชี Google **เจ้าของไฟล์** (ต้องเป็นบัญชีที่เพิ่มใน Test users จากข้อ 8)

**ขั้นที่ 5:** Google อาจขึ้นเตือน **"Google hasn't verified this app"**
- กด **"Advanced"** (ขั้นสูง)
- กด **"Go to Video Learning Platform (unsafe)"**
- *(ปลอดภัย เพราะเป็นแอปของเราเอง ที่ขึ้นเตือนเพราะยังไม่ได้ส่ง Google ตรวจ)*

**ขั้นที่ 6:** กด **"Allow"** (อนุญาต) เพื่อให้สิทธิ์อ่าน Google Drive

**ขั้นที่ 7:** ระบบจะพากลับมาที่หน้า Admin และขึ้นข้อความ
**"เชื่อมต่อ Google Drive สำเร็จแล้ว"** พร้อมสถานะเปลี่ยนเป็น **"เชื่อมต่อแล้ว"**

> 🔄 **Token จะถูกเก็บอย่างปลอดภัยในฐานข้อมูล** และระบบจะ **ต่ออายุให้อัตโนมัติ**
> (ผ่าน refresh_token) จึงไม่ต้อง Login ใหม่บ่อย ๆ

---

## 13. วิธี Sync ไฟล์จาก Google Drive

หลังเชื่อมต่อ Google Drive สำเร็จแล้ว:

**ขั้นที่ 1:** ที่หน้า **Admin** ในการ์ด Google Drive กดปุ่ม **"ซิงก์ไฟล์"**

**ขั้นที่ 2:** ระบบจะไปอ่านโฟลเดอร์ Videos และ Documents บน Drive
แล้วบันทึกรายชื่อไฟล์ลงฐานข้อมูล

**ขั้นที่ 3:** จะขึ้นข้อความสรุป เช่น
**"ซิงก์สำเร็จ — วิดีโอใหม่ 5, เอกสารใหม่ 3 (รวมวิดีโอ 5, เอกสาร 3)"**

**ขั้นที่ 4:** ไปที่เมนู **"วิดีโอ"** หรือ **"เอกสาร"** จะเห็นไฟล์ที่ซิงก์มาแล้ว
กดที่วิดีโอเพื่อเล่น หรือกดเอกสารเพื่ออ่าน PDF

> 💡 ทุกครั้งที่เพิ่มไฟล์ใหม่บน Google Drive ให้กด **"ซิงก์ไฟล์"** อีกครั้ง
> ระบบจะเพิ่มเฉพาะไฟล์ใหม่ ไฟล์เดิมจะไม่ซ้ำ

---

## 14. วิธีเพิ่มผู้ใช้

**ขั้นที่ 1:** ที่หน้า **Admin** เลื่อนลงไปที่การ์ด **"จัดการผู้ใช้"**

**ขั้นที่ 2:** กรอกในฟอร์ม:
- **ชื่อผู้ใช้** — เช่น `somchai`
- **รหัสผ่าน** — เช่น `pass1234`
- **สิทธิ์** — เลือก `สมาชิก` (member) หรือ `ผู้ดูแลระบบ` (admin)

**ขั้นที่ 3:** กดปุ่ม **"เพิ่ม"** — ผู้ใช้ใหม่จะปรากฏในตารางด้านล่างทันที

### การจัดการผู้ใช้อื่น ๆ

- **รีเซ็ตรหัสผ่าน:** กดปุ่ม "รีเซ็ตรหัส" ที่แถวของผู้ใช้ แล้วใส่รหัสใหม่
- **ลบผู้ใช้:** กดปุ่ม "ลบ" (ลบตัวเองไม่ได้ เพื่อป้องกันการล็อกตัวเองออกจากระบบ)

> 📌 **ไม่มีระบบสมัครสมาชิกเอง** — ผู้ใช้ทุกคนต้องถูกเพิ่มโดย Admin ผ่านหน้านี้เท่านั้น

---

## 15. วิธี Run โปรเจกต์ทั้งหมด

สรุปขั้นตอนรันทั้งระบบ (ต้องเปิด Terminal 2 หน้าต่าง)

### หน้าต่างที่ 1 — Backend

```bash
cd video-platform/backend
source .venv/bin/activate      # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

➡️ Backend รันที่ http://localhost:8000
➡️ เอกสาร API อัตโนมัติที่ http://localhost:8000/docs

### หน้าต่างที่ 2 — Frontend

```bash
cd video-platform/frontend
npm run dev
```

➡️ Frontend รันที่ http://localhost:3000

### ลำดับการใช้งานครั้งแรก

1. เปิด http://localhost:3000 → Login ด้วย `admin` / `admin1234`
2. ไปหน้า Admin → เชื่อมต่อ Google Drive ([ข้อ 12](#12-วิธี-login-google-เพื่อรับ-token))
3. กดซิงก์ไฟล์ ([ข้อ 13](#13-วิธี-sync-ไฟล์จาก-google-drive))
4. เพิ่มผู้ใช้ให้เพื่อนร่วมทีม ([ข้อ 14](#14-วิธีเพิ่มผู้ใช้))
5. เสร็จแล้ว! ทุกคนเข้ามาดูวิดีโอและอ่านเอกสารได้

---

## 16. วิธี Deploy ขึ้นใช้งานจริง

เมื่อทดสอบในเครื่องเสร็จแล้ว อยากเอาขึ้นให้คนอื่นใช้ผ่านอินเทอร์เน็ต

### สถาปัตยกรรมการ Deploy

```
Frontend (Vercel)  ──API──►  Backend (Railway/Render/VPS)  ──►  Google Drive
```

### 16.1 Deploy Backend

**ตัวเลือก A: Railway หรือ Render** (ง่ายที่สุด)

1. Push โค้ดขึ้น GitHub
2. สร้างโปรเจกต์ใหม่บน [Railway](https://railway.app/) หรือ [Render](https://render.com/)
   เลือก repo และโฟลเดอร์ `backend`
3. ตั้งค่า **Start Command:**
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. ใส่ **Environment Variables** ทั้งหมดจากไฟล์ `.env` (ในหน้า Settings ของ platform)
   - เปลี่ยน `GOOGLE_REDIRECT_URI` เป็น URL จริง เช่น
     `https://your-backend.up.railway.app/api/auth/google/callback`
   - เปลี่ยน `FRONTEND_ORIGIN` เป็น URL ของ Frontend จริง
5. **สำคัญ:** กลับไปที่ Google Cloud Console → Credentials → OAuth Client
   เพิ่ม Redirect URI ตัวใหม่ (URL จริง) เข้าไปด้วย

**ตัวเลือก B: VPS (เช่น DigitalOcean, AWS EC2)**

```bash
# บน Server
git clone <your-repo>
cd video-platform/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# ตั้งค่า .env (ใช้ค่าจริง)
# รันด้วย gunicorn + uvicorn worker เพื่อความเสถียร
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

แนะนำให้ตั้ง **Nginx** เป็น reverse proxy + **HTTPS** ด้วย Let's Encrypt

### 16.2 Deploy Frontend (Vercel)

1. Push โค้ดขึ้น GitHub
2. ไปที่ [Vercel](https://vercel.com/) → Import repo → เลือกโฟลเดอร์ `frontend`
3. ตั้งค่า Environment Variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
   ```
4. กด **Deploy** — เสร็จแล้วจะได้ URL เช่น `https://your-app.vercel.app`

### 16.3 เรื่องฐานข้อมูลตอน Deploy

- **SQLite** ใช้ได้สำหรับผู้ใช้ไม่มาก แต่ไฟล์ `app.db` จะหายเมื่อ redeploy บนบาง platform
- สำหรับใช้งานจริงจัง แนะนำเปลี่ยนเป็น **PostgreSQL:**
  ```
  DATABASE_URL=postgresql://user:password@host:5432/dbname
  ```
  (โค้ดรองรับอยู่แล้วผ่าน SQLAlchemy — แค่เปลี่ยนค่า `DATABASE_URL` และติดตั้ง `psycopg2-binary`)

---

## 17. แก้ปัญหาที่พบบ่อย

### ❌ Login เว็บไม่ได้ / ขึ้น "Invalid username or password"
- ตรวจว่าใช้ `admin` / `admin1234` (ตัวพิมพ์เล็ก-ใหญ่สำคัญ)
- ถ้าเปลี่ยนรหัสใน `.env` แล้วยังใช้ค่าเก่าไม่ได้ → ต้องลบไฟล์ `backend/app.db` แล้วรันใหม่

### ❌ ขึ้น "access_denied" ตอนเชื่อม Google Drive
- ยังไม่ได้เพิ่มอีเมลตัวเองใน **Test users** → กลับไปทำ [ข้อ 8 ขั้นที่ 5](#8-วิธีตั้งค่า-oauth-consent-screen)

### ❌ ขึ้น "redirect_uri_mismatch"
- ค่า Redirect URI ใน Google Console **ไม่ตรง** กับ `GOOGLE_REDIRECT_URI` ใน `.env`
- ตรวจให้ตรงกันเป๊ะ ๆ ทุกตัวอักษร (รวมทั้ง `http` vs `https` และ `/` ปิดท้าย)

### ❌ กดซิงก์แล้วขึ้น "Google Drive not connected"
- ยังไม่ได้เชื่อมต่อ Google Drive → ทำ [ข้อ 12](#12-วิธี-login-google-เพื่อรับ-token) ก่อน

### ❌ ซิงก์แล้วไม่เจอไฟล์ (วิดีโอใหม่ 0)
- ตรวจว่า Folder ID ใน `.env` ถูกต้อง ([ข้อ 11](#11-วิธีหา-folder-id-ของ-google-drive))
- ตรวจว่าไฟล์อยู่ในโฟลเดอร์ที่ถูกต้อง และเป็นชนิดที่รองรับ (mp4/webm/mkv/pdf)
- ตรวจว่าบัญชีที่เชื่อม Drive มีสิทธิ์เข้าถึงโฟลเดอร์นั้น

### ❌ วิดีโอเล่นไม่ได้ / โหลดค้าง
- ไฟล์ `.mkv` บางไฟล์เบราว์เซอร์อาจไม่รองรับ codec → แนะนำใช้ `.mp4`
- ตรวจว่า Backend ยังรันอยู่ และ Token ยังไม่หมดอายุ (ดูสถานะที่หน้า Admin)

### ❌ Frontend ขึ้น error เรื่อง CORS
- ตรวจว่า `FRONTEND_ORIGIN` ใน `backend/.env` ตรงกับ URL ที่เปิด Frontend
  (เช่น `http://localhost:3000`)

### ❌ `pip install` หรือ `npm install` ล้มเหลว
- ตรวจว่าติดตั้ง Python/Node.js เวอร์ชันถูกต้อง ([ข้อ 3](#3-สิ่งที่ต้องเตรียมก่อนเริ่ม))
- ลองอัปเดต pip: `python -m pip install --upgrade pip`
- ลองลบโฟลเดอร์ `node_modules` แล้ว `npm install` ใหม่

### ❌ Token หมดอายุบ่อย / ต้อง Login Drive ใหม่เรื่อย ๆ
- ตรวจว่ามี `refresh_token` (ดูที่หน้า Admin ควรขึ้น "มี (ต่ออายุอัตโนมัติ)")
- ถ้าไม่มี ให้กด "เชื่อมต่อใหม่" — ระบบตั้งค่า `prompt=consent` ไว้เพื่อขอ refresh_token เสมอ

---

## 📞 ต้องการความช่วยเหลือเพิ่มเติม?

- เอกสาร API แบบละเอียด: ดูไฟล์ [`API.md`](./API.md)
- เอกสาร API อัตโนมัติ (ตอนรัน Backend): http://localhost:8000/docs
- Google Drive API v3: https://developers.google.com/drive/api/v3/reference

---

**สร้างด้วย** FastAPI · Next.js · Google Drive API v3 · SQLite
