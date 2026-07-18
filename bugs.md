Bug 1: Multiple Full Syncs Running Concurrently

Evidence

🔄 Starting full sync service processing...
🔄 Starting full sync service processing...
🔄 Starting full sync service processing...

This should never happen for a full database sync.

Problem

Two or more syncs are deleting and recreating data simultaneously.

Example:

Sync A
Delete tickets
Insert tickets

            Sync B
            Delete tickets

Sync A
Insert assignments

Now assignments reference tickets that no longer exist.

Result

Foreign key constraint violated:
ticket_assignments_ticket_id_fkey
Fix
Add a synchronization lock (mutex) so only one sync can run at a time.
Find why syncFullSheet() is being called multiple times (cron, webhook, manual endpoint, retries).
🔴 Critical Bug 2: Entire Database Is Deleted Before Every Sync

Current code:

await prisma.$transaction([
  prisma.ticketHistory.deleteMany(),
  prisma.initialVisit.deleteMany(),
  prisma.serviceReport.deleteMany(),
  prisma.materialRequestItem.deleteMany(),
  prisma.materialRequest.deleteMany(),
  prisma.ticketAssignment.deleteMany(),
  prisma.ticket.deleteMany(),
  prisma.complaint.deleteMany()
]);
Problem

If anything fails after this point:

database is empty
dashboard shows "No Data"
users think the DB is sleeping
Fix

Never delete everything first.

Instead:

Upsert records.
Delete only records that no longer exist after a successful sync.
Or perform the delete and insert within one interactive transaction that either fully commits or fully rolls back.
🔴 Critical Bug 3: Foreign Key Constraint Failure
ticket_assignments_ticket_id_fkey
Problem

Assignments are being inserted while their parent ticket no longer exists.

Root causes include:

concurrent syncs
deleted tickets
transaction ordering
Fix

Ensure:

Complaint
↓

Ticket
↓

Assignment
↓

Visits
↓

Reports
↓

Material Requests

all occur in one successful transaction without interference.

🔴 Critical Bug 4: Transaction Not Found (P2028)
Transaction not found
Problem

A transaction is failing or expiring, then later code continues using it.

Fix
Use interactive transactions (prisma.$transaction(async tx => { ... })).
Increase transaction timeout if needed.
Stop processing immediately after a transaction error.
🟠 Bug 5: Thousands of Await Calls Inside the Loop

Inside every CSV row you're doing things like:

await prisma.masterInstallation.upsert(...)

and

await prisma.user.upsert(...)

and

await prisma.engineer.create(...)
Problem

For 673 rows this becomes thousands of database queries.

This:

slows sync
increases chances of overlap
increases transaction failures
Fix

Batch operations where possible, or preload existing data and perform fewer writes.

🟠 Bug 6: No Protection Against Duplicate Sync Requests

If two users press Sync,

or

Cron fires twice,

or

Google retries,

the service starts another sync.

Fix

Add a global lock, database lock, or queue so only one sync runs at a time.

🟠 Bug 7: Generated Ticket Numbers Are Random
CLR-${rowNumber}-${Math.random()}
Problem

If the sheet is re-imported, the same row may get a different ticket number, making reconciliation difficult.

Fix

Generate deterministic ticket numbers or preserve existing ones.

🟠 Bug 8: Duplicate Application IDs Become "N/A"
finalAppId = "N/A";
Problem

Many rows without an Application ID all use the same key, causing them to overwrite the same masterInstallation.

Fix

Use a unique placeholder, for example:

N/A-ROW-23

or

UNKNOWN-${rowNumber}
🟡 Bug 9: Entire CSV Is Loaded Into Memory

You create arrays for:

complaints
tickets
assignments
reports
visits
history
material requests

before writing anything.

Problem

Larger spreadsheets will consume more memory and take longer to process.

Fix

Process in chunks (e.g., 100–500 rows per batch) if the dataset grows significantly.

🟡 Bug 10: Diagnostic Check After Failed Transaction Can Be Misleading

After a failed transaction you run:

await prisma.ticket.findMany()

The transaction has already rolled back, so those diagnostics reflect the previous database state, not the attempted inserts.

Fix

Log the in-memory data and transaction error, but don't assume the database reflects the failed transaction.

🟡 Bug 11: No Retry or Recovery Strategy

If:

Google Sheets temporarily fails,
network hiccups,
database momentarily disconnects,

the entire sync fails.

Fix

Retry transient failures with exponential backoff where appropriate.

🟡 Bug 12: Sync Is Not Atomic Across the Entire Process

The flow is:

Delete tables.
Upsert installations.
Create users.
Create engineers.
Insert complaints.
Insert tickets.
Insert assignments.

Failures between these stages can leave the database in a partially updated state.

Fix

Where practical, group dependent operations into transactions or make the sync idempotent with upserts.