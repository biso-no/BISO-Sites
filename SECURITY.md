# Security policy

## Report a vulnerability

Email **[it@biso.no](mailto:it@biso.no)** with "Security" in the subject line.

Don't open a public issue, pull request or discussion about it. This
repository is public, so anyone could read it there.

Include:

- what you found and where: the web address, or the file in this repository;
- the steps to reproduce it;
- what an attacker could do with it;
- your name or handle, if you'd like to be credited.

## What happens next

BISO's IT team aims to:

1. confirm we've received your report within five working days;
2. tell you whether we can reproduce it, and what we plan to do;
3. tell you when it's fixed.

Please keep the details private until we've fixed the problem, or until 90
days have passed, whichever comes first. If we need more time, we'll ask.

BISO is a student organisation and doesn't pay bug bounties. If you'd like,
we'll thank you by name when the fix is out.

## Scope

In scope is the code in this repository and the services built from it:

| Service | Address |
|---|---|
| Website | [biso.no](https://biso.no) |
| Admin | [admin.biso.no](https://admin.biso.no) |
| API | [api.biso.no](https://api.biso.no) |
| Documentation | [docs.biso.no](https://docs.biso.no) |
| Backend (BISO's Appwrite, its settings and the functions in `functions/`) | appwrite.biso.no |

Only the version deployed from `main` gets fixes.

The mobile app has its own repository and policy:
[BISO-Flutter](https://github.com/biso-no/BISO-Flutter/security/policy).
You report to the same address.

Out of scope:

- Bugs in other companies' services that BISO uses, such as Vipps MobilePay,
  Stripe, Microsoft 365 and 24SevenOffice, or in Appwrite's own software.
  Report those to the company. A mistake in how BISO has set them up is in
  scope.
- Denial-of-service and load testing, spam, and social engineering of BISO
  staff, volunteers or members.
- Findings from automated scanners that don't show a real impact, such as a
  missing header or a visible version number.

## Rules for testing

- Use only accounts and data that are yours. Don't open, change or delete
  anyone else's data. If you come across personal data by accident, stop,
  don't keep a copy, and say so in your report.
- Don't complete real orders or payments to test the shop or memberships.
- Don't do anything that slows down or breaks the services for other people.

If you follow these rules and report in good faith, BISO won't take legal
action against you for your research.
