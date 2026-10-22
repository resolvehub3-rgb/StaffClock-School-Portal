# StaffClock - School Teacher Check-In & Check-Out Management System

A production-ready, full-stack school attendance management platform designed for actual school operations. Powered by **React, TypeScript, Vite, and Supabase** (PostgreSQL, Supabase Auth, Realtime, and private Storage).

---

## 🏫 Key Features

- **Teacher Mobile Attendance Experience**:
  - Live clock with seconds and official school schedule.
  - **Live Countdown Track (06:00 to 16:30)**: Progress percentage calculated strictly as `clamp((now - scheduled_start)/(scheduled_end - scheduled_start), 0, 1)` with an animated walking human figure that reaches 100% at dismissal (16:30).
  - **Live Camera Selfie Check-In**: Mandatory front-camera capture directly from device hardware; gallery uploads are strictly disabled.
  - **Geofence Verification**: High-accuracy GPS location checked against the school's configured latitude, longitude, and radius using the mathematical Haversine formula.
  - **Punctuality Enforcement**: Compares arrival time against official opening time (06:00) + configurable grace period (e.g. 10 minutes).
  - **Check-Out Confirmation**: Verified exit with fresh GPS location check and prompt reminders at 16:30.
  - **Personal Attendance History**: Real-time view of individual attendance records and punctuality statuses.

- **School Owner & Administrator Dashboard**:
  - **Live Attendance KPI Overview**: Total active teachers, checked in, on time arrivals, late arrivals, missing check-ins, checked out, and attendance percentage calculated dynamically from database records.
  - **Teacher Management**: Staff registry with staff IDs, class assignments, and an **Invite Staff Member** generator that creates secure manual activation links (`/?activate=TOKEN`) for admin to share via WhatsApp, SMS, or email.
  - **Class Management**: Create, assign, and organize classroom levels (Primary, JHS, etc.).
  - **Live Attendance Monitor**: Filterable table with search, date picker, class filters, status filters, and one-click **View Photo Evidence** (served via private short-lived signed URLs).
  - **Audited Administrative Attendance Corrections**: Formal adjustment process requiring mandatory justification, recording old vs new values in `attendance_events` and `audit_logs`.
  - **School Operating Settings**: Configure school name, timezone (`Africa/Accra`), opening/closing times, grace period, and school GPS coordinates (with one-touch "Use Device GPS" detector).
  - **Compliance Reports & CSV Export**: Real-time punctuality analytics and downloadable CSV attendance exports.
  - **Immutable Audit Trail**: Append-only log of logins, invitations, check-ins, and adjustments.

- **Headmaster Interface**:
  - Tailored operational monitor for daily attendance, late arrival monitoring, outstanding checkouts, and authorized selfie reviews, restricted from editing credentials or school configuration.

- **PWA & Mobile-First Compliance**:
  - Valid Web App Manifest (`manifest.webmanifest`), standalone mobile mode, iOS Safari "Add to Home Screen" guide, and non-intrusive offline connectivity alerts.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Database & Auth**: Supabase PostgreSQL with strict Row Level Security (RLS)
- **Realtime Updates**: Supabase Realtime Channels (`attendance_sessions`, `school_settings`)
- **Evidence Storage**: Supabase Storage with private `attendance-evidence` bucket
- **Backend RPCs & Edge Functions**:
  - `handle_check_in`: Server-side geofence calculation and lateness assignment
  - `handle_check_out`: Authoritative checkout state recording
  - `handle_admin_attendance_correction`: Audited administrative adjustment
  - `activate_teacher_invitation`: Teacher account activation flow

---

## 🚀 Getting Started

### 1. Database Setup in Supabase
Execute the SQL migration script located at:
```bash
supabase/migrations/20261022000000_teacher_attendance_system.sql
```
in your **Supabase Dashboard → SQL Editor**. This creates all 10 tables, indexes, RLS policies, storage bucket, and stored procedures.

### 2. Environment Variables
Copy `.env.example` to `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
```
Alternatively, launch the application and click **"Connect Supabase"** in the top navigation to enter your Supabase Project URL and Anon Key directly.

### 3. Running Locally
```bash
# Run unit tests
npm test

# Start development server
npm run dev

# Run typecheck and linting
npm run lint

# Build production bundle
npm run build
```

---

## 🔒 Security & Privacy

1. **Private Storage**: Teacher attendance selfies are saved to the private `attendance-evidence` bucket and cannot be accessed publicly. Signed URLs with 30-minute expiry are issued only to the authenticated teacher and authorized administrators.
2. **Row Level Security (RLS)**: Enforced across all tables. Teachers cannot view records belonging to other staff.
3. **No Fabricated Records**: All attendance sessions, metrics, and timestamps originate from authenticated Supabase mutations.
