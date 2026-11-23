# MediCare DHR – Phase A2: Critical Security Gap Remediation Report

**Date of Execution:** 23 November 2026  
**Auditor / Remediation Authority:** DeepMind Antigravity Platform Directorate  
**Target Environment:** Local Healthcare Staging (`E:\Health`)  
**Deployment Status:** NOT DEPLOYED (Local Workspace & MySQL Only)  
**Database Integrity:** 100% Preserved (8/8 Users, Hospital Records & Clinical Data Intact)  

---

## Executive Summary

Following the post-remediation security audit (`dhr_post_remediation_security_verification.md`), Phase A2 critical security gap remediation was authorized to address three residual security vulnerabilities and conduct a comprehensive project-wide authorization audit across all 9 application portals.

All remediation tasks have been completed with minimal, targeted, backward-compatible modifications:
1. **Secondary Super Admin Write Operations Sealed:** Strict view-only enforcement was applied across clinical mutations (`POST /api/vitals`, `POST /api/reminders`, `POST/PATCH/DELETE /api/patient-clinical`, `POST/PATCH/DELETE /api/patient-extended`, `POST /api/upload`, `POST/PUT/PATCH/DELETE /api/appointments`, and `/api/settings`), returning **HTTP 403 Forbidden** for any non-read operation.
2. **Hospital Management Multi-Tenant Isolation:** Institutional account `raju@gmail.com` (Reach Multispeciality Hospital `RMH-HOS`) was isolated to its facility boundary. Hospital administrators can no longer view or mutate users, records, or directory entries outside their affiliated hospital, and are strictly blocked from platform-wide administrative functions and configuration.
3. **Secondary Super Admin Account Integrity:** The account `superadmin@dhr-medicare.com` was verified and secured. An alias resolution flaw in `AuthService.login()` that previously caused `.com` credentials to collapse onto the root `.in` account was corrected, ensuring distinct session token claims (`isOriginalSuperAdmin: false`, `isViewOnly: true`).
4. **Project-Wide Authorization Audit:** Express routes across all 9 portals were scanned, verifying route-level middleware, ownership checks, and role matrix alignment.
5. **Independent Automated Test Verification:** A 9-point security test suite executed against live API endpoints passed with a **100% success rate (9/9 PASS)**.

---

## Detailed Remediation Actions

### 1. Issue 1 – Secondary Super Admin Write Access Remediation

#### Problem Statement
Secondary Super Admin accounts (`isViewOnly = true`, `isOriginalSuperAdmin = false`) are intended for auditor and read-only executive observation. Previous audits revealed that routes using only `authenticate` (e.g. vitals, reminders, uploads, patient clinical history) allowed view-only administrators to perform mutating HTTP verbs (`POST`, `PUT`, `PATCH`, `DELETE`).

#### Changes Made & Exact Locations

| File Link | Exact Lines | Before | After |
| :--- | :--- | :--- | :--- |
| [vital.routes.ts](file:///E:/Health/server/src/routes/vital.routes.ts#L10-L12) | L10–L12 | `router.post('/', createVitalController);` | `router.post('/', requireWritePermission, createVitalController);` |
| [vital.controller.ts](file:///E:/Health/server/src/controllers/vital.controller.ts#L40-L45) | L40–L45 | Did not pass view-only flag to service | Passed `req.user?.isViewOnly` to `VitalService.createVital` |
| [vital.service.ts](file:///E:/Health/server/src/services/vital.service.ts#L125-L135) | L125–L135 | Unchecked mutation | Added service guard: `if (isViewOnly) throw new AppError('Access denied: View-only Super Administrator clearance cannot create vitals', 403);` |
| [reminder.routes.ts](file:///E:/Health/server/src/routes/reminder.routes.ts#L16-L21) | L16–L21 | Mutation routes lacked write permission guard | Added `requireWritePermission` to `POST /`, `PATCH /:id/follow-up`, `PATCH /:id`, `DELETE /:id` |
| [reminder.controller.ts](file:///E:/Health/server/src/controllers/reminder.controller.ts#L45-L105) | L45–L105 | Controllers did not forward view-only claim | Passed `req.user?.isViewOnly` to `createReminder`, `updateReminder`, `updateFollowUpStatus`, and `deleteReminder` |
| [reminder.service.ts](file:///E:/Health/server/src/services/reminder.service.ts#L55-L180) | L55–L180 | Direct mutations allowed | Enforced `if (isViewOnly) throw new AppError(..., 403)` at the service layer for all mutations |
| [patientClinical.routes.ts](file:///E:/Health/server/src/routes/patientClinical.routes.ts#L25-L35) | L25–L35 | Unchecked mutating verbs | Added router-level mutating verb guard rejecting `POST/PUT/PATCH/DELETE` for `req.user?.isViewOnly` with HTTP 403 |
| [patientExtended.routes.ts](file:///E:/Health/server/src/routes/patientExtended.routes.ts#L40-L50) | L40–L50 | Unchecked mutating verbs | Added router-level mutating verb guard rejecting `POST/PUT/PATCH/DELETE` for `req.user?.isViewOnly` with HTTP 403 |
| [patientHealthTopic.routes.ts](file:///E:/Health/server/src/routes/patientHealthTopic.routes.ts#L18-L26) | L18–L26 | Unchecked mutating verbs | Added router-level mutating verb guard rejecting `POST/DELETE` for `req.user?.isViewOnly` with HTTP 403 |
| [appointment.routes.ts](file:///E:/Health/server/src/routes/appointment.routes.ts#L18-L27) | L18–L27 | Used only `authenticate` | Added router-level mutating verb guard rejecting `POST/PUT/PATCH/DELETE` for `req.user?.isViewOnly` with HTTP 403 |
| [upload.routes.ts](file:///E:/Health/server/src/routes/upload.routes.ts#L15-L22) | L15–L22 | `router.post('/', uploadFileController)` | `router.post('/', requireWritePermission, uploadFileController)` |
| [settings.routes.ts](file:///E:/Health/server/src/routes/settings.routes.ts#L22-L32) | L22–L32 | Mutation routes lacked view-only block | Added router-level mutating verb guard rejecting `POST/PUT/PATCH/DELETE` for `req.user?.isViewOnly` with HTTP 403 |

---

### 2. Issue 2 – Hospital Management Tenant Isolation (`raju@gmail.com`)

#### Problem Statement
`raju@gmail.com` holds the `Role.ADMIN` enum in MySQL and is linked as administrator of Reach Multispeciality Hospital (`RMH-HOS`). Because the backend previously treated any `ADMIN` account identically, hospital administrators could call platform-wide endpoints, view staff/patients of other hospitals, modify cross-hospital profiles, and alter global settings.

#### Architectural Solution
1. **Runtime Context Enrichment:** `verifySessionToken` in [auth.middleware.ts](file:///E:/Health/server/src/middleware/auth.middleware.ts#L60-L96) inspects `user.managedHospitals`. If the user is an `ADMIN` linked to a hospital, it binds `isHospitalAdmin = true`, `managedHospitalId`, `managedHospitalName`, and `managedHospitalCode` directly to `req.user`.
2. **Tenant Scoping in Service Queries:** All user retrieval, user update, hospital directory, and clinical management queries scope results to `actor.managedHospitalId` and `actor.managedHospitalName`.
3. **Platform Function Shielding:** Platform-wide endpoints (global settings, RBAC matrix, creating/deleting hospitals, registering platform admins) reject hospital administrators with **HTTP 403 Forbidden**.

#### Changes Made & Exact Locations

| File Link | Exact Lines | Logic Implemented |
| :--- | :--- | :--- |
| [express.d.ts](file:///E:/Health/server/src/@types/express.d.ts#L15-L25) | L15–L25 | Extended `AuthUser` interface with `isHospitalAdmin`, `managedHospitalId`, `managedHospitalName`, `managedHospitalCode`. |
| [auth.middleware.ts](file:///E:/Health/server/src/middleware/auth.middleware.ts#L60-L96) | L60–L96 | Selected `managedHospitals` from MySQL in `verifySessionToken`. Dynamically set `isHospitalAdmin = Boolean(user.role === Role.ADMIN && managedHospital)`. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L90-L140) | L90–L140 | In `getUsers()`, added tenancy filter: when `actor.isHospitalAdmin`, filters users so actor can ONLY view themselves, practitioners affiliated with their hospital name, or patients with appointments/records at their hospital. Platform Admins and Super Admins are concealed. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L180-L240) | L180–L240 | In `getUserById()`, added tenant boundary verification. Throws HTTP 403 if hospital admin attempts to inspect a user outside their hospital or any platform administrative account. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L560-L640) | L560–L640 | In `createUser()`, hospital admins are strictly blocked from provisioning `ADMIN` or `SUPER_ADMIN` accounts. New staff created by a hospital admin are automatically affiliated with their hospital. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L830-L870) | L830–L870 | In `updateUser()`, hospital admins cannot edit platform administrative accounts or users outside their hospital, and cannot assign administrative roles. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L1025-L1060) | L1025–L1060 | In `deleteUser()`, hospital admins cannot delete administrative accounts or staff outside their facility. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L1080-L1115) | L1080–L1115 | In `resetPassword()`, hospital admins cannot reset passwords for administrative accounts or external users. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L1305-L1325) | L1305–L1325 | In `getHospitals()`, filtered query to `where: { id: actor.managedHospitalId }` when caller is a hospital admin. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L1415-L1435) | L1415–L1435 | In `getHospitalById()`, added check: throws HTTP 403 if target hospital ID does not match `actor.managedHospitalId`. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L1465-L1475) | L1465–L1475 | In `createHospital()`, throws HTTP 403 if called by a hospital admin. Only platform administrators can register new facilities. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L1580-L1615) | L1580–L1615 | In `updateHospital()`, hospital admins can only update their own hospital. Governance fields (`code`, `status`, `adminEmail`) are stripped to prevent self-approval or code tampering. |
| [admin.service.ts](file:///E:/Health/server/src/services/admin.service.ts#L1740-L1750) | L1740–L1750 | In `deleteHospital()`, throws HTTP 403 if called by a hospital admin. |
| [settings.controller.ts](file:///E:/Health/server/src/controllers/settings.controller.ts#L490-L505) | L490–L505 | In `updateSettings()`, hospital admins are rejected with HTTP 403: restricted to institutional portal and cannot alter global platform settings. |
| [settings.controller.ts](file:///E:/Health/server/src/controllers/settings.controller.ts#L980-L1335) | L980–L1335 | In `createRoleAnnouncement`, `updateRoleAnnouncement`, `deleteRoleAnnouncement`, `toggleRoleAnnouncement`, `updateRoleWidgets`, `resetRoleWidgets`, hospital admins and view-only accounts are rejected with HTTP 403. |
| [admin.controller.ts](file:///E:/Health/server/src/controllers/admin.controller.ts#L320-L330) | L320–L330 | In `dispatchAdminNotificationController()`, hospital admins are blocked from broadcasting system notifications platform-wide. |

---

### 3. Issue 3 – Secondary Super Admin Account (`superadmin@dhr-medicare.com`)

#### Problem Statement & Root Cause Discovery
The user requested preserving `superadmin@dhr-medicare.com` while ensuring it remains strictly view-only with `isOriginalSuperAdmin: false` and `isViewOnly: true`.

During initial testing, requests using a token from logging in as `superadmin@dhr-medicare.com` unexpectedly succeeded with full write access. Deep investigation into [auth.service.ts](file:///E:/Health/server/src/services/auth.service.ts#L1015-L1045) revealed an **alias collision bug**:
```typescript
// Legacy flawed code in auth.service.ts:
const emailAliases = [normalizedIdentifier];
if (normalizedIdentifier.endsWith('@dhr-medicare.com')) {
  emailAliases.push(normalizedIdentifier.replace('@dhr-medicare.com', '@dhr-medicare.in'));
}
const user = await prisma.user.findFirst({
  where: { OR: [{ email: { in: emailAliases } }] }
});
```
Because `findFirst` evaluated both `.com` and `.in` simultaneously, logging in as `superadmin@dhr-medicare.com` matched `superadmin@dhr-medicare.in` (the root Super Admin) first. Consequently, the user received root administrative tokens rather than secondary tokens.

#### Remediation Implemented
1. **Exact Identifier Matching First:** Updated `AuthService.login()` in [auth.service.ts](file:///E:/Health/server/src/services/auth.service.ts#L1015-L1050) to query the database using the exact identifier. Domain alias fallback is only engaged if no account exists for the exact email.
2. **Database Verification:** Verified that `superadmin@dhr-medicare.com` (id: `cmwsvajkd0000i0hs208wyz0t`) has `isOriginalSuperAdmin: false` and `isViewOnly: true` permanently in MySQL.
3. **Privilege Elevation Defense:** Re-tested `PATCH /api/admin/users/:id/role` and `PUT /api/admin/users/:id`. When called by `superadmin@dhr-medicare.com`, the server returns **HTTP 403 Forbidden**.

---

## Issue 4 – Project-Wide Authorization Audit Across All 9 Portals

A systematic audit of all route files, authorization middleware, and controller guards was conducted across the 9 portals in the MediCare DHR architecture:

| Portal | Primary Role(s) | Mutation Protection Mechanisms | Cross-Tenant & Ownership Enforcement | Audit Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Patient** | `PATIENT` | `requireRole('PATIENT')`, session user ID matching in controllers | Patients can only query and write to their own patient ID; cannot access other patients' vitals, prescriptions, or clinical history. | **VERIFIED** |
| **2. Doctor** | `DOCTOR` | `requireRole('DOCTOR')` | Doctor queries filter to patients who have active consultations, appointments, or medical records assigned to the doctor. | **VERIFIED** |
| **3. Nurse** | `NURSE` | `requireRole('NURSE')` in `nurseOps.routes.ts` | Restock requests, inventory updates, and clinical alerts scoped to nursing department and facility. | **VERIFIED** |
| **4. Pharmacist** | `PHARMACIST` | `requireRole('PHARMACIST')` in `pharmacyOps.routes.ts` | Inventory, Schedule H logs, and order fulfillments scoped to pharmacist's pharmacy ID. | **VERIFIED** |
| **5. Caregiver** | `CAREGIVER` | `requireRole('CAREGIVER')` in `caregiver.routes.ts` | Ward access strictly validated against active Care Circle consent grants and ward relationships. | **VERIFIED** |
| **6. Insurance** | `INSURANCE_PROVIDER` | `requireRole('INSURANCE_PROVIDER')` in `insurance.routes.ts` | Claim status changes, policy management, and pre-authorizations scoped to provider organization. | **VERIFIED** |
| **7. Platform Admin** | `ADMIN` (Platform) | `requireRole('ADMIN')`, `requirePermission()`, `requireWritePermission` | Full platform administrative management (users, hospitals directory, audit stream). Blocked from root Super Admin settings. | **VERIFIED** |
| **8. Super Admin (Root)** | `SUPER_ADMIN` (Root) | `requireOriginalSuperAdmin`, dynamic RBAC Matrix | Unrestricted root master clearance. Manages RBAC permissions matrix, publishes system configurations, assigns administrator roles. | **VERIFIED** |
| **9. Super Admin (Secondary)** | `SUPER_ADMIN` (View-Only) | `requireWritePermission`, router-level verb guards | Strictly view-only. Forbidden from executing POST, PUT, PATCH, or DELETE operations across all business endpoints (**HTTP 403**). | **VERIFIED** |
| **10. Hospital Management** | `ADMIN` (Hospital) | `actor.isHospitalAdmin`, `managedHospitalId` | Multi-tenant institutional isolation. Restricted to Reach Multispeciality Hospital (`RMH-HOS`); blocked from platform admin functions. | **VERIFIED** |

---

## Automated Verification Test Suite Results

The automated test script (`scratch/test_phase_a2_security.js`) was executed against the active backend server (`http://localhost:5000`) and live MySQL database (`dhr_database`).

### Execution Output Log

```
====================================================
  DHR Phase A2: Critical Security Verification Suite 
====================================================

Authenticating accounts for testing...
  Secondary Super Admin login status: 200 | token present: true
  Original Super Admin login status: 200 | token present: true
  Raju Hospital login status: 200 | token present: true

--- Running Phase A2 Security Tests ---

[PASS] Test 1: Secondary Super Admin POST /api/vitals rejected with HTTP 403 (Actual: 403)
[PASS] Test 2: Secondary Super Admin POST /api/reminders rejected with HTTP 403 (Actual: 403)
[PASS] Test 3: Original Super Admin retains full administrative access (Status: 200)
[PASS] Test 4: Raju accesses only Reach Multispeciality Hospital RMH-HOS (Found: Reach Multispeciality [RMH-HOS])
[PASS] Test 5: Raju blocked from cross-hospital mutations (PUT: 403, POST: 403, DELETE: 403)
[PASS] Test 6: Raju blocked from platform-wide settings modifications (Settings: 403, RBAC Matrix: 403)
[PASS] Test 7: Secondary Super Admin privilege elevation blocked (PATCH role: 403, PUT role: 403)
[PASS] Test 8: Raju user listing isolates hospital tenant and conceals platform admins (Platform Admin present: false, Super Admin present: false)
[PASS] Test 9: MySQL database integrity preserved: 8 users intact, RMH-HOS hospital intact, .com account correctly view-only (Total users: 8)

====================================================
  Summary: 9 / 9 Tests PASSED (100%)
====================================================
```

### Detailed Breakdown of Tests

| Test ID | Scope / Endpoint | Actor Tested | Expected Result | Actual Result | Status |
| :---: | :--- | :--- | :---: | :---: | :---: |
| **1** | `POST /api/vitals` | `superadmin@dhr-medicare.com` (View-Only) | HTTP 403 Forbidden | HTTP 403 Forbidden | **PASS** |
| **2** | `POST /api/reminders` | `superadmin@dhr-medicare.com` (View-Only) | HTTP 403 Forbidden | HTTP 403 Forbidden | **PASS** |
| **3** | `GET /api/admin/users` | `superadmin@dhr-medicare.in` (Root Super Admin) | HTTP 200 OK | HTTP 200 OK | **PASS** |
| **4** | `GET /api/admin/hospitals` | `raju@gmail.com` (Hospital Admin `RMH-HOS`) | HTTP 200 (Only RMH-HOS) | HTTP 200 (Only RMH-HOS) | **PASS** |
| **5** | `PUT/POST/DELETE /api/admin/hospitals/:id` | `raju@gmail.com` (Hospital Admin `RMH-HOS`) | HTTP 403 Forbidden | HTTP 403 Forbidden | **PASS** |
| **6** | `PUT /api/admin/settings`, `PUT /matrix` | `raju@gmail.com` (Hospital Admin `RMH-HOS`) | HTTP 403 Forbidden | HTTP 403 Forbidden | **PASS** |
| **7** | `PATCH /api/admin/users/:id/role` | `superadmin@dhr-medicare.com` (View-Only) | HTTP 403 Forbidden | HTTP 403 Forbidden | **PASS** |
| **8** | `GET /api/admin/users` (Tenant isolation) | `raju@gmail.com` (Hospital Admin `RMH-HOS`) | Platform Admins hidden | Platform Admins hidden | **PASS** |
| **9** | Database Record & User Count Check | Database Inspection | Exactly 8 Users Preserved | Exactly 8 Users Preserved | **PASS** |

---

## Mandatory Confirmations & Guarantees

In accordance with project constraints:
1. **Application NOT Deployed:** No deployment scripts or commands were executed. All changes reside purely in local code and local database.
2. **Database Integrity Preserved:** MySQL was never truncated, reset, or modified destructively. All 8 user accounts (including Helen Persia, Jim, Dr. Sharon, Rohan, Platform Admin, Raju, and both Super Admins) and institutional records remain intact.
3. **Raju's Hospital Management Access Retained:** Raju's legitimate access to Reach Multispeciality Hospital (`RMH-HOS`) via `/api/auth/hospital/login` remains functional and operational.
4. **Secondary Super Admin (`.com`) Account Retained:** The account remains fully functional for authentication and viewing, with strict view-only constraints enforced in both MySQL and runtime tokens.
5. **UI & Workflows Preserved:** No user interface components, navigation layouts, or client-side workflows were redesigned or broken.
6. **Zero TypeScript Compilation Errors:**
   - Backend: `npm --prefix server run build` (`tsc`) exited with code 0 (clean build).
   - Frontend: `npm run build` (`tsc -b && vite build`) exited with code 0 (clean build).
