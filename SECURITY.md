# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in DraftCoach, please report it
responsibly by emailing **cgultekin.info@gmail.com**.

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce
- Any relevant logs or screenshots

You can expect an initial response within 72 hours. Please do not disclose
the issue publicly until it has been addressed.

## Scope

DraftCoach handles Strava OAuth tokens and activity data. Areas of particular
interest:

- Authentication & session handling (NextAuth, Strava OAuth)
- Strava webhook signature verification
- Database access (Neon / parameterized SQL)
- API route authorization

## Out of Scope

- Vulnerabilities in third-party dependencies (report to the respective project)
- Issues requiring physical access to a user's device
