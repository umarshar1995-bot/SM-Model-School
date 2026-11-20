# Shabeeran Mustafa Public School — Next.js App Router Platform

A modern full-stack School Management System built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS v4**, and **Prisma ORM** connected directly to the PostgreSQL `SM_School` database.

## Features

- **Executive Dashboard (`/admin`)** — Session-scoped KPIs, enrollment trends chart (Recharts), class distribution, gender split, fee recovery summary, and recent enrollments.
- **Classes & Sections Console (`/admin/classes-and-sections`)** — Cascading Session → Class → Section roster, occupancy stats, direct prints, and a **360° Student Record Modal** (Bio, Siblings Network with instant switching, Leave Record with approval & logging, Fee Ledger).
- **Fees & Family Challans Console (`/admin/fees-console`)** — Family-centric monthly billing roll, automated sibling concessions (0% / 20% / 50%), rolled arrears, atomic fee collection, and printable 3-part A4 landscape bank vouchers.
- **Class Fee Structures (`/admin/fee-structures`)** — Per-class tuition, exam, computer, activity, admission fees, and late fines.
- **Subject Matrix (`/admin/subject-matrix`)** — Interactive Class × Subject assignment grid with bulk assign, copy from class, copy previous session, and marks settings drawer.
- **Student Marksheet (`/admin/student-marksheet`)** — Official academic transcript preview & printing.
- **ID Card Studio (`/admin/card-templates`)** — Live front/back previews for all 7 CR80 templates (Prestige Gold, Royal Blue, Clean White, Prestige Gradient, Landscape variants, Staff card), default switching, and template CRUD.
- **Core Directories** — Full CRUD with search, filtering, soft-delete/restore, and photo uploads for Students (+ `.xlsx` Export & `.xlsx/.csv` Import), Families (auto-incrementing `FAM-XXXX` & Pakistani mobile normalization), Enrollments, Academic Sessions, Classes, Sections, Subjects, Teachers (+ 48h one-time invite links & device revocation), Teacher Section/Subject Assignments, and Settings & RBAC Roles.
- **Print Engine (`/print/...`)** — Print-ready ID Cards, Section Batch ID Cards, 3-Part Family Fee Challans, Academic Marksheets, and School Leaving Certificates (SLC).
- **Teacher Mobile PWA Portal (`/t`)** — Device-token authenticated mobile portal with 48h invite onboarding (`/t/invite/[token]`), mobile-only toggle, and PWA service worker.

## Getting Started

```bash
npm install
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default admin sign-in (PostgreSQL `users` table):
- Username: `Admin`
- Password: `Admin@12345`
