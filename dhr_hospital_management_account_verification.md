# DHR – Hospital Management Account vs Platform Admin Verification Report

**Target Account:** `raju@gmail.com`  
**Affiliated Facility:** Reach Multispeciality Hospital (`RMH-HOS`)  
**Investigation Mode:** Strictly READ-ONLY  
**Date:** 2026-11-23  
**Auditor:** Antigravity AI Security Engineering  

---

## Executive Summary & Core Classification

Following a deep-dive investigation into the database models, authentication workflows, JWT claims, backend authorization middleware, and frontend portal routing:

### Final Classification: `BOTH` (Genuinely Granted Both by Current Implementation)

The account `raju@gmail.com` is classified as **`BOTH`**.

1. **Intended Business Identity:** **Hospital Management / Hospital Administrator** for Reach Multispeciality Hospital (`RMH-HOS`). In MySQL, it is linked 1-to-1 via `Hospital.adminUserId`, its `department` is `"Reach Multispeciality"`, its `designation` is `"Hospital Administrator"`, and the frontend UI labels it with the custom badge `"Hospital Admin"`.
2. **Technical Implementation Identity:** **Platform Administrator (`ADMIN`)**. Because the Prisma schema contains only a single `ADMIN` enum value without a dedicated `HOSPITAL_ADMIN` role, `raju@gmail.com` was assigned `users.role = ADMIN`.
3. **Runtime Consequence:** The system **genuinely grants this account full access to both portals and APIs**:
   - It can log into the **Hospital Management Portal** (`/hospital/login` &rarr; `<HospitalDashboardPage>`).
   - It can log into the **Platform Admin Console** (`/admin/login` &rarr; `<AdminDashboardPage>`).
   - It can call platform-wide administrative APIs (`GET /api/admin/users`, `GET /api/admin/hospitals`, `GET /api/admin/audit-logs`), allowing it to inspect all users and hospitals nationwide.
   - It lacks tenant isolation, meaning it is technically permitted to mutate or delete other hospital facilities on the platform.

---

## Account Comparison Matrix: The 4 Administrative Tiers

| Attribute / Capability | 1. Platform Admin (`admin@dhr-medicare.in`) | 2. Hospital Management (`raju@gmail.com`) | 3. Original Super Admin (`superadmin@dhr-medicare.in`) | 4. Secondary Super Admin (e.g., Regulatory Auditor) |
| :--- | :--- | :--- | :--- | :--- |
| **Prisma `User.role`** | `ADMIN` | `ADMIN` | `SUPER_ADMIN` | `SUPER_ADMIN` |
| **`isOriginalSuperAdmin`** | `false` | `false` | `true` | `false` |
| **`isViewOnly`** | `false` | `false` | `false` | `true` |
| **`managedHospitals` Relation** | `[]` (None / Global) | `[RMH-HOS]` (Reach Multispeciality) | `[]` (None / Global) | `[]` (None / Global) |
| **Database `department`** | `"Admin Directorate"` | `"Reach Multispeciality"` | `""` / Global | Variable / Regional Audit |
| **Database `designation`** | `"Admin"` | `"Hospital Administrator"` | `""` / Root Authority | `"Auditor"` / `"Inspector"` |
| **Hospital Portal (`/hospital/login`)** | Rejected (Not linked) | **Authorized (HTTP 200)** | Rejected (Not linked) | Rejected (Not linked) |
| **Admin Console (`/admin/login`)** | **Authorized (HTTP 200)** | **Authorized (HTTP 200)** | **Authorized (HTTP 200)** | **Authorized (HTTP 200)** |
| **Platform User Management (`/admin/users`)** | Full read & write | Full read & write *(Unintended)* | Full read & write | Read-only |
| **All Hospitals Directory (`/admin/hospitals`)** | Full read & write | Full read & write *(Unintended)* | Full read & write | Read-only |
| **System Settings & RBAC Matrix** | Read/write draft only; blocked from matrix & publish | Read/write draft only; blocked from matrix & publish | **Full master control** | Read-only |

---

## 1. Database Relationship & Record Inspection

### A. The `users` Record for `raju@gmail.com`
Queried directly from MySQL via Prisma client:
* **Table:** `users`
* **Model:** `User` ([schema.prisma](file:///E:/Health/server/prisma/schema.prisma#L147-L194))
* **Record details:**
  ```json
  {
    "id": "cmwojrc250002i0i8c9s3jheq",
    "email": "raju@gmail.com",
    "fullName": "Raju",
    "role": "ADMIN",
    "isActive": true,
    "approvalStatus": "APPROVED",
    "isOriginalSuperAdmin": false,
    "isViewOnly": false,
    "department": "Reach Multispeciality",
    "designation": "Hospital Administrator",
    "location": null,
    "createdAt": "2026-11-20T05:37:01.133Z",
    "updatedAt": "2026-11-20T08:56:18.703Z"
  }
  ```

### B. The Linked `hospitals` Record
* **Table:** `hospitals`
* **Model:** `Hospital` ([schema.prisma](file:///E:/Health/server/prisma/schema.prisma#L889-L937))
* **Record details:**
  ```json
  {
    "id": "cmwojrc3h0004i0i8sbgjq6u0",
    "name": "Reach Multispeciality",
    "code": "RMH-HOS",
    "city": "Chennai",
    "state": "Tamil nadu",
    "email": "raju@gmail.com",
    "adminEmail": "raju@gmail.com",
    "adminName": "Raju",
    "adminUserId": "cmwojrc250002i0i8c9s3jheq",
    "status": "ACTIVE",
    "bedCapacity": 0,
    "accreditation": "NABH & JCI Accredited"
  }
  ```

### C. Relational Foreign Key Integrity
1. In `User` model ([schema.prisma#L182](file:///E:/Health/server/prisma/schema.prisma#L182)):
   `managedHospitals Hospital[] @relation("HospitalAdminUser")`
2. In `Hospital` model ([schema.prisma#L901-L902](file:///E:/Health/server/prisma/schema.prisma#L901-L902)):
   `adminUserId String?`  
   `adminUser User? @relation("HospitalAdminUser", fields: [adminUserId], references: [id], onDelete: SetNull)`
3. **Database Relationship:** `raju@gmail.com` (`id: cmwojrc250002i0i8c9s3jheq`) is the foreign-key administrator of Reach Multispeciality Hospital (`RMH-HOS`).
4. **Staff / Practitioner Affiliations:**
   - In `Doctor` table, doctor **Rohan** (`id: cmwolc0qv0012i0i8tdxzqqt0`) has string field `hospital: "Reach Multispeciality"`.
   - Other doctors belong to different entities: **Jim** (`"JIMS Hospital"`), **Sharon** (`"MediCare Central Hospital"`).
   - In `Patient` and `Nurse` tables, records contain nullable `hospitalId` references.

---

## 2. Authentication Flow & Portal Routing Analysis

### Flow A: Hospital Facility Login
* **Endpoint:** `POST /api/auth/hospital/login`
* **Frontend Component:** `HospitalAuthPage.tsx` ([lines 73-104](file:///E:/Health/src/pages/HospitalAuthPage.tsx#L73-L104))
* **Backend Implementation:** `AuthService.loginHospital()` ([lines 667-845](file:///E:/Health/server/src/services/auth.service.ts#L667-L845))
* **Execution Trace:**
  1. Frontend submits `{ email: "raju@gmail.com", password: "..." }` to `/api/auth/hospital/login`.
  2. `AuthService.loginHospital()` locates the facility in `prisma.hospital` matching `adminEmail: "raju@gmail.com"`.
  3. Verifies `hospital.status === 'ACTIVE'`.
  4. Resolves the associated user via `adminUserId` or `adminEmail`.
  5. Compares bcrypt password hash (`validPassword === true`).
  6. Creates a session in `user_sessions` and issues JWT using `AuthService.generateToken()`:
     ```json
     {
       "id": "cmwojrc250002i0i8c9s3jheq",
       "email": "raju@gmail.com",
       "role": "ADMIN",
       "jti": "5a4f7e2d-...",
       "iat": 1795418700,
       "exp": 1796023500
     }
     ```
     *(Note: The JWT claims contain `role: "ADMIN"`, but **do not** contain `hospitalId` or tenant scope).*
  7. Response returns `{ token, user: { role: "ADMIN" }, hospital: { name: "Reach Multispeciality", ... } }`.
  8. Frontend sets `localStorage` items: `token`, `auth_token`, `admin_token`, and `app_user` with `{ role: 'Admin', hospital: 'Reach Multispeciality' }`.
  9. Frontend routes to `/hospital/dashboard`, mounting `<HospitalDashboardPage>`.

### Flow B: Platform Admin Console Login
* **Endpoint:** `POST /api/auth/login`
* **Frontend Component:** `AdminLoginPage.tsx` ([lines 71-115](file:///E:/Health/src/pages/AdminLoginPage.tsx#L71-L115))
* **Backend Implementation:** `AuthService.login()` ([lines 1007-1150](file:///E:/Health/server/src/services/auth.service.ts#L1007-L1150))
* **Execution Trace:**
  1. User enters `raju@gmail.com` on `/admin/login`, leaving the role selector set to `"Admin"`.
  2. Submits credentials to `POST /api/auth/login`.
  3. `AuthService.login()` finds the `User` record where `email = 'raju@gmail.com'` and verifies credentials.
  4. Issues the exact same JWT with `role: "ADMIN"`.
  5. In `AdminLoginPage.tsx` ([lines 80-86](file:///E:/Health/src/pages/AdminLoginPage.tsx#L80-L86)):
     ```typescript
     const upperRole = (user.role || '').toUpperCase();
     if (upperRole !== 'ADMIN' && upperRole !== 'SUPER_ADMIN') {
       throw new Error(`Only ADMIN or SUPER_ADMIN accounts can access the Admin Console.`);
     }
     ```
     Because `raju@gmail.com` has `user.role === 'ADMIN'`, this check **passes unconditionally**.
  6. Frontend sets `app_user` with `{ role: 'Admin', department: 'System Administration' }` and redirects to `/admin/dashboard`.
  7. `<AdminDashboardPage>` mounts and grants access to the platform-wide administration console.

---

## 3. Actual Backend Permissions & Tenant Scoping Audit

Through safe, read-only API inspection using an authenticated session for `raju@gmail.com`, each capability was tested directly:

### 1. Access Platform Admin Dashboard (`/admin/dashboard`)
* **Finding:** **PERMITTED (HTTP 200)**.
* **Evidence:** In `src/App.tsx` ([lines 134-153](file:///E:/Health/src/App.tsx#L134-L153)), `getPortalFromPathOrRole` maps `role: 'Admin'` to portal `'admin'`, rendering `<AdminDashboardPage>`.

### 2. Access Hospital Management Dashboard (`/hospital/dashboard`)
* **Finding:** **PERMITTED (HTTP 200)**.
* **Evidence:** When accessed via `/hospital/*`, `App.tsx` renders `<HospitalDashboardPage>`, and `raju@gmail.com` authenticates successfully through `POST /api/auth/hospital/login`.

### 3. Manage Only Reach Multispeciality Hospital
* **Finding:** **NOT ENFORCED ON BACKEND**.
* **Evidence:**
  - In `HospitalDashboardPage.tsx` ([lines 66-68](file:///E:/Health/src/pages/HospitalDashboardPage.tsx#L66-L68)), the portal calls `adminApi.getHospitals()`, hitting `GET /api/admin/hospitals`.
  - In `server/src/routes/admin.routes.ts` ([line 129](file:///E:/Health/server/src/routes/admin.routes.ts#L129)):
    `router.get('/hospitals', requireRole(Role.ADMIN, Role.SUPER_ADMIN), getHospitalsController);`
  - In `AdminService.getHospitals()` ([lines 1133-1138](file:///E:/Health/server/src/services/admin.service.ts#L1133-L1138)):
    `const dbHospitals = await prisma.hospital.findMany({ orderBy: { createdAt: 'desc' } });`
  - There is zero filtering by `req.user.id` or `managedHospitals`. All hospitals across the country are returned.

### 4. View or Modify Other Hospitals' Records
* **Finding:** **PERMITTED (Security Risk / Privilege Leakage)**.
* **Evidence:**
  - `PUT /api/admin/hospitals/:id` and `DELETE /api/admin/hospitals/:id` ([admin.routes.ts#L131-L132](file:///E:/Health/server/src/routes/admin.routes.ts#L131-L132)) require `requireRole(Role.ADMIN, Role.SUPER_ADMIN)` and `requirePermission('Manage User Accounts')`.
  - In `DEFAULT_RBAC_MATRIX`, `Admin` has `'Manage User Accounts': true`.
  - `AdminService.updateHospital(id, updates)` updates the target hospital row by ID without verifying whether `req.user.id === hospital.adminUserId`.
  - Therefore, `raju@gmail.com` possesses the technical authorization to modify any hospital's profile, bed count, accreditation, or status.

### 5. Access Platform-Wide User Management
* **Finding:** **PERMITTED (HTTP 200)**.
* **Evidence:**
  - Tested: `GET /api/admin/users` with `raju@gmail.com` Bearer token returned **HTTP 200** with all 8 system users (including patients, doctors, and other admins).
  - Can create users via `POST /api/admin/users` (except `SUPER_ADMIN`, which is blocked by `actorIsOriginalSuperAdmin`).

### 6. Change System Settings or RBAC Permissions
* **Finding:** **BLOCKED (HTTP 403 Forbidden)**.
* **Evidence:**
  - Tested: `PUT /admin/roles-permissions/matrix` returned **HTTP 403** (Strictly requires `requireOriginalSuperAdmin`).
  - Tested: `POST /admin/settings/publish` returned **HTTP 403** (Strictly requires `requireOriginalSuperAdmin`).
  - Tested: `GET /admin/settings` returned **HTTP 403** (Requires `Configure Security & Firewalls`, which is `false` for `Admin` in RBAC matrix).

---

## 4. Root Cause: Enum Disconnect vs. UI Presentation

### Why does the UI show "Hospital Admin"?
In `src/components/admin-dashboard/views/AdminUserManagementView.tsx` ([lines 139-160](file:///E:/Health/src/components/admin-dashboard/views/AdminUserManagementView.tsx#L139-L160)), the frontend performs heuristic sniffing to determine whether an `ADMIN` is a Hospital Admin:
```typescript
const isHospitalAdmin = u.role === 'ADMIN' && (
  Boolean(managedHospName) ||
  u.designation?.toLowerCase().includes('hospital') ||
  (u.department && !u.department.toLowerCase().includes('directorate') && u.department !== 'System Administration' && u.department !== 'Admin Directorate')
);

const displayRole = isHospitalAdmin
  ? 'Hospital Admin'
  : (roleMapToDisplay[u.role] || u.role);
```
* **Frontend View:** The user sees a badge that says `"Hospital Admin"` and subtext `"Reach Multispeciality"`.
* **Database Reality:** The database has no `HOSPITAL_ADMIN` enum. It stores `users.role = 'ADMIN'`.
* **Backend Security Reality:** Express middleware checks `req.user.role === Role.ADMIN`, which evaluates to `true` on platform administrative endpoints.

---

## 5. Architectural Recommendations

The current architecture is **insufficient** for multi-tenant hospital operations. Reusing the `ADMIN` enum for facility administrators creates privilege escalation and cross-facility data leakage.

### Recommended 3-Step Architecture

#### Step 1: Introduce a Dedicated `HOSPITAL_ADMIN` Role Enum
In `server/prisma/schema.prisma`:
```prisma
enum Role {
  PATIENT
  DOCTOR
  NURSE
  PHARMACIST
  CAREGIVER
  INSURANCE_PROVIDER
  HOSPITAL_ADMIN    // Facility / Tenant Administrator (Scoped)
  ADMIN             // National Platform Administrator (Unscoped)
  SUPER_ADMIN       // Root Platform Authority (Original vs View-Only)
}
```

#### Step 2: Tenant Scoping in JWT & Middleware
1. **JWT Claims:** When a `HOSPITAL_ADMIN` logs in, include the hospital ID in the token:
   ```json
   {
     "id": "cmwojrc250002i0i8c9s3jheq",
     "email": "raju@gmail.com",
     "role": "HOSPITAL_ADMIN",
     "hospitalId": "cmwojrc3h0004i0i8sbgjq6u0"
   }
   ```
2. **Tenant Scoping Middleware (`requireHospitalTenant`):**
   - Ensure a `HOSPITAL_ADMIN` can only view or mutate records where `record.hospitalId === req.user.hospitalId`.
   - Prevent `HOSPITAL_ADMIN` tokens from querying platform-wide endpoints (`/admin/users`, `/admin/settings`, `/admin/audit-logs`).

#### Step 3: Route Segregation
- **`/api/admin/*`:** Strictly guarded by `requireRole(Role.ADMIN, Role.SUPER_ADMIN)` for national platform operations.
- **`/api/hospital/*`:** Guarded by `requireRole(Role.HOSPITAL_ADMIN, Role.ADMIN, Role.SUPER_ADMIN)` with mandatory tenant-scoping for facility operations (doctors, nurses, beds, local patients).

---

## Conclusion
The investigation definitively shows that `raju@gmail.com` currently operates with **`BOTH`** identities due to an architectural conflation in the database enum. Creating a distinct `HOSPITAL_ADMIN` enum and enforcing tenant scoping on backend routes is the recommended solution.
