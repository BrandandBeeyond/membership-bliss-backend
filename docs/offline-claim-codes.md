# Admin management and offline membership claims

Super-admins can edit or delete ordinary admin accounts from the Admins table. Edit supports name, email, active status and an optional new password. Blank passwords preserve the existing hash. Super-admin accounts and self-deletion are protected. Deleted or inactive accounts are rejected by the existing authenticated API middleware on their next request.

Offline creation now returns `{ booking, claimCode }`. The membership number remains automatic. The 12-character claim code is randomly generated, shown once to the issuing admin, and stored only as a hash. Share the number and code privately with the member. Claim codes are not included in customer responses or booking list responses.

Existing unclaimed offline bookings need a code: use **Generate code** in the Offline Bookings table. **Replace code** invalidates the previous code. Only active, unexpired, unclaimed cash bookings can have codes issued. No automatic migration or replacement of existing memberships is performed.

The updated app requires only the membership number and claim code, with no OTP step. The backend requires both, verifies ownership and payment/expiry status, and atomically marks the booking claimed while removing its code hash. Claimed memberships cannot be claimed again.

API changes:

- `PUT /api/v1/admin/admins/:id`: super-admin only, body `{ name, email, password?, isActive? }`.
- `DELETE /api/v1/admin/admins/:id`: super-admin only.
- `GET /api/v1/bookings/allbookings`: now requires an admin bearer token.
- `POST /api/v1/bookings/booking/offline/:id/claim-code`: admin/super-admin only; returns `{ membershipNumber, claimCode }`.
- `POST /api/v1/bookings/booking/claim-membership`: signed-in member; body `{ membershipNumber, claimCode }`.

Deploy backend and admin together, and release the updated mobile app for claiming. Older apps do not send a claim code, so their claims are intentionally rejected. Existing already-claimed memberships continue to work. No new environment variables or dependencies are needed.

Run `node --test tests/admin-and-claims.test.js`. Tests use fake models; they do not delete real admins, create bookings, send OTPs or modify live memberships.
