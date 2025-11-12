# GDPR & Privacy Compliance Plan for BISO Expense App

## Overview
This document outlines the privacy and data protection measures implemented in the BISO expense tracking application to ensure compliance with GDPR and Norwegian privacy regulations.

## Components Implemented

### 1. Cookie Consent Banner
- Located in: `src/components/cookie-consent.tsx`
- Features:
  - Modal-based consent interface
  - Granular consent options (essential, functional, analytics, marketing)
  - Clear information about cookie types
  - Option to accept all or customize preferences
  - Preferences saved to localStorage

### 2. Privacy Controls
- Located in: `src/components/privacy-controls.tsx`
- Features:
  - Data export request functionality
  - Account/data deletion request
  - Clear explanations of user rights
  - Confirmation dialogs for critical actions

### 3. Privacy Agreement Notice
- Added to login screen (`src/components/login.tsx`)
- Features:
  - Clear statement that login constitutes acceptance of privacy policy
  - Link to full privacy policy document
  - Informs users of their data rights

## Privacy Policy
- External policy located at: https://biso.no/privacy
- Covers:
  - What data is collected
  - How data is used
  - Data retention periods
  - User rights
  - Deletion processes
  - Contact information for privacy concerns

## Data Processing Documentation
- Data is processed and stored on BISO's self-hosted Appwrite instance
- Server location: webdock.io (Linux server in Norway)
- All data processing happens on the same physical machine
- No third-party data processors used beyond the hosting provider

## Future Enhancements

### Phase 1 (Immediate)
- Implement backend API endpoints for data export requests
- Implement backend API endpoints for account deletion requests
- Add data processing agreement text to registration flow

### Phase 2 (Mid-term)
- Add user data access logs
- Implement automatic data deletion for inactive accounts
- Create admin interface for managing data requests

### Phase 3 (Long-term)
- Implement cookie consent state API storage
- Create data processing audit system
- Develop automatic privacy policy version tracking with user acceptance records

## Compliance Checklist
- [x] Cookie consent mechanism
- [x] Privacy controls UI
- [x] Privacy notice on login
- [x] Link to privacy policy
- [ ] Backend data export implementation
- [ ] Backend deletion request implementation
- [ ] Data processing agreement
- [ ] User data access logs
- [ ] Admin interface for privacy requests

## Contact
For questions regarding privacy compliance, contact:
- Data Protection Officer: privacy@biso.no 