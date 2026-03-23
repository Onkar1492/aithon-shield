# Feature Categories

**Category 1:** User-Visible Changes (Frontend/UI changes that users will see)
**Category 2:** Backend-Only Changes (Backend/infrastructure changes not directly visible to users)

---

## Feature Categorization

### Category 1: User-Visible Changes

**Feature 13:** Frontend Button Logic & Progress Display
- **Reason:** Users will see progress bars, stage messages, error displays, retry buttons
- **Visibility:** Direct UI changes visible immediately

---

### Category 2: Backend-Only Changes

**Feature 1:** Database Schema Updates - Progress Tracking Fields ✅
- **Reason:** Database schema changes, not visible to users directly
- **Visibility:** Indirect (enables Features 9-13)

**Feature 2:** Shared Types & Interfaces
- **Reason:** TypeScript types and interfaces, internal code structure
- **Visibility:** No user-visible changes

**Feature 3:** Security Analyzer Service
- **Reason:** Backend service for vulnerability detection
- **Visibility:** Indirect (enables real vulnerability detection)

**Feature 4:** Secrets Detector Service
- **Reason:** Backend service for secrets detection
- **Visibility:** Indirect (enables real secrets detection)

**Feature 5:** SCA Analyzer Service
- **Reason:** Backend service for dependency scanning
- **Visibility:** Indirect (enables real dependency scanning)

**Feature 6:** MVP Scan Service
- **Reason:** Backend service for MVP code scanning
- **Visibility:** Indirect (enables real MVP scans, visible through results)

**Feature 7:** Web Scan Service
- **Reason:** Backend service for web app scanning
- **Visibility:** Indirect (enables real web scans, visible through results)

**Feature 8:** Mobile Scan Service
- **Reason:** Backend service for mobile app scanning
- **Visibility:** Indirect (enables real mobile scans, visible through results)

**Feature 9:** MVP Endpoint Updates
- **Reason:** Backend API endpoint changes
- **Visibility:** Indirect (enables real scans, visible through results)

**Feature 10:** Web Endpoint Updates
- **Reason:** Backend API endpoint changes
- **Visibility:** Indirect (enables real scans, visible through results)

**Feature 11:** Mobile Endpoint Updates
- **Reason:** Backend API endpoint changes
- **Visibility:** Indirect (enables real scans, visible through results)

**Feature 12:** Error Handling & Cancellation
- **Reason:** Backend error handling and cancellation logic
- **Visibility:** Indirect (errors visible to users, but code is backend)

---

## Summary

- **Category 1 (User-Visible):** 1 feature (Feature 13)
- **Category 2 (Backend-Only):** 12 features (Features 1-12)

---

## Notes

- Features 6-12 will have indirect user impact (real scans instead of mock scans)
- Feature 13 is the only feature with direct UI/UX changes
- All backend features enable the real-world scanning functionality
