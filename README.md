# OJDS Clock

A tap-to-clock-in web app for Orlando Jewish Day School. Built with Next.js
(App Router), Prisma, and a lightweight username and password login. Runs
locally today on SQLite, and is structured to move to Vercel and Supabase
Postgres with a small config change when you are ready to go live.

## How the tap flow works

Each entrance's NFC tag is an **NTAG 424 DNA** tag (not a plain sticker),
programmed to rewrite part of its own URL on every single tap using an
on-chip encryption key, for example
`https://yourapp.com/c/chabad-door?picc_data=<changes every tap>&cmac=<changes every tap>`.
No app install is needed on either iPhone or Android: tapping an NFC tag
that carries a URL is a standard phone feature, and it just opens that
page in the browser.

- If the teacher is not signed in on that phone yet, they land on the login
  screen, then get sent straight back to the tap page (with the tap's
  one-time parameters intact) after signing in.
- The server verifies the tap's `picc_data`/`cmac` against the tag's own
  secret key before doing anything else (see "How a captured tap-link is
  made useless" below). Only once that checks out does it look at whether
  the teacher is currently clocked in: if not, it clocks them in; if they
  already are, it clocks them out. Either way they see an instant
  confirmation, and which entrance they used.
- A second tap of the *same physical tag* within 15 seconds is treated as
  an accidental double tap and is not recorded again, to guard against a
  phone bumping the tag twice. Tapping a *different* door within that
  window still counts as a separate, real event.
- **Sessions do not expire in practice** (they last 10 years). A teacher
  signs in once on their own phone, and every tap after that is instant with
  no prompts. Signing out is a deliberate action from the menu, not
  something that happens on its own.
- There is no button anywhere in the app that clocks someone in or out.
  The only way to create a clock event is by visiting a tap URL with a
  valid, not-yet-used signature, which in the real world only happens by
  tapping a physical tag at the door. The one narrow exception is the
  long-shift reminder flow described below, which only appears after the
  system itself flags a suspiciously long open shift.
- There is no location check of any kind. An earlier version asked the
  phone for its GPS position and rejected taps that seemed far from
  school, but phone GPS turned out to be unreliable enough (indoor signal,
  "Precise Location" settings, Wi-Fi-based fallback positioning) to
  regularly block real employees standing at the tag. It's gone entirely
  now that the tag itself proves each tap is genuine and fresh.

## How a captured tap-link is made useless

A plain NFC tag just carries a fixed URL, so a copied or bookmarked link
would work forever, no different from the tag itself. NTAG 424 DNA tags
solve this in hardware: **Secure Dynamic Messaging (SDM)**. Every time the
tag is read, before it hands the URL to the phone, the tag itself
re-encrypts its own unique ID and a counter that only ever goes up, using
an AES-128 key baked into the tag and known only to this app
(`NTAG_SDM_META_KEY` / `NTAG_SDM_FILE_KEY` in `.env`). That produces the
`picc_data` and `cmac` query parameters, different on every single tap.

`src/lib/ntag424.ts` decrypts and verifies that signature server-side
(ported from NXP's own application note, AN12196, and cross-checked
against a working open-source reference implementation and the official
RFC 4493 AES-CMAC test vector). `src/lib/nfcTags.ts` then checks the
decoded counter against the last one seen from that exact tag
(`NfcTag.lastCounter` in the database): a tap is only accepted if its
counter is strictly higher than the last accepted one for that tag.

The result: the moment a real tap is accepted, that URL's counter is
already spent. Copying the link, bookmarking it, or checking browser
history and reopening it later does nothing, the counter hasn't moved, so
the server rejects it as already used. There's no location check needed
to catch this, the cryptography does it directly, and it can't be
tricked by a stale link the way GPS could be tricked by a spoofed
location.

A tag's UID is registered the first time it's ever seen (using the URL
path, e.g. `chabad-door`, as its label), so there's no manual setup step
in the database, just program the tags correctly (see "Programming a real
NFC tag" below) and the first real tap of each one registers it.

## Device binding, so an account can't be signed into on a coworker's phone

Every teacher account (not admin, see "One admin, and admin is not an
employee") locks itself to the first phone it successfully signs in on. A
random id is generated in `localStorage` on that phone (`src/app/login/LoginForm.tsx`)
and stored on the `User` row as `boundDeviceId` the moment that account
first logs in anywhere.

After that, a sign-in attempt for that account from a different phone
doesn't succeed and doesn't create a session. Instead it creates a
`DeviceRequest` and shows up on `/admin/devices` for an admin to approve or
deny, with the phone's browser/OS and when it happened. Approving it moves
`boundDeviceId` to the new device (any other pending requests for that
teacher are auto-denied, since only one device can be bound at a time), so
this also covers a teacher getting a new phone. Denying it leaves the
lock as-is. An admin can also manually clear a teacher's lock from their
detail page (`/admin/teacher/[id]`) without waiting for a request.

This is a login-time check, not a per-tap check: a session that's already
signed in keeps working normally (sessions last effectively forever, see
"Getting started locally"), so unbinding a device only takes effect the
next time that account signs out and back in.

## Two entrances, tracked separately

Tag IDs are just whatever text you put in the URL, so two doors is two
tags: `/c/chabad-door` ("Chabad Door") and `/c/ojds-door` ("OJDS Door") are
wired up already (see `src/lib/tags.ts` for the display names, easy to
rename or add a third). Every clock event records which one was used. That
detail isn't shown on the general dashboards, on purpose, it lives on each
teacher's own detail page (`/admin/teacher/[id]`, click their name from
anywhere) as a full timestamped log, and in the CSV export from Reports.

## Metrics, not a required-hours goal

Teachers here are not held to a fixed weekly hour target, so the app does
not frame anything as "behind" or "on track". Instead:

- **Teachers** see hours this week, this month, and this year, days worked
  this year, and a streak of consecutive school days clocked in.
- **Admins** see staff-wide totals (hours this week/month, average hours per
  teacher, who's clocked in right now, the best current streak) plus a table
  of the same per-teacher metrics, and can pull a custom date range report
  with a CSV export.
- The school week runs Sunday through Friday for totals ("this week" adds
  up Sunday through Saturday, not the conventional Monday-Sunday), but the
  streak specifically skips both Saturday and Sunday, and any date on the
  school calendar (see below): missing any of those never breaks it.
  Worked Sundays still count toward the hour totals, they just aren't
  required to keep a streak alive.
- Hitting a streak milestone (7, 30, 100, 180, 365 days, then every extra
  365 after that, see `streakMilestone` in `src/lib/hours.ts`) shows a
  small celebration on the tap-confirmation screen instead of the usual
  streak pill, plus a short vibration on phones that support it.
- Below "This week," a teacher's own dashboard has an "All History"
  dropdown (no page reload, pure CSS) with every clock event on record for
  that account, most recent first.

## School calendar, so holidays don't break a streak

`/admin/calendar` lets an admin mark specific dates (Yom Tov, breaks,
in-service days, whatever) as closed. Those dates are excluded from the
streak calculation the same way Saturday and Sunday already are, so a
teacher's streak survives a school closure without anyone having to work
around it.

Add a single date with the small form, or upload a CSV with `date`
(`YYYY-MM-DD`) and an optional `label` column to load a whole year's
calendar at once, re-uploading later just updates labels and adds any new
dates. This only affects streaks, it has no effect on hour totals or
payroll: a real closed day naturally has no clock events on it anyway.

## Each teacher's detail page, and personalizing their info

Click any teacher's name (from the admin table, Reports, or the Requests
inbox) to get to `/admin/teacher/[id]`: their full metrics, a searchable
clock history with which entrance each tap used, and an editable "Teacher
info" card (name, title, pay type). That's how you give someone a real
title like "Kindergarten Teacher" instead of a generic default, either
there one at a time, or in bulk via the roster CSV's optional `title`
column (see below).

## Hour corrections and manually added hours

Teachers can ask for a correction from their dashboard ("Request a
correction"): a day, a start and end time, and a reason. The form tells
them to enter their **total time for the day**, start to finish, not just
the missing portion, since that's what the comparison below needs to work
correctly. It shows up in the admin's Requests inbox (with a pending-count
badge in the nav) for an approve or deny decision. An admin can also add
hours directly from a teacher's detail page, no request needed.

Either way, the entry is compared against whatever's already on record for
that whole day:

- If the new entry is **fewer hours** than the day already has on record,
  it's treated as a correction of a wrong total: the day's existing events
  are replaced outright with the new entry.
- Otherwise, only the **non-overlapping remainder** gets added on top of
  what's already there, never a duplicate of time that's already recorded.

That logic lives in `applyHourEntry` in `src/lib/manualHours.ts` and is
shared by both flows. Anything added this way is tagged "Manual entry" in
the clock history, so it stays distinguishable from an actual tap.

## Mobile navigation

On narrow screens, the admin links (Admin, Reports, Requests) collapse
behind a hamburger button next to the school name, tap it to drop down the
full menu, including the pending-requests badge. It's pure CSS (a hidden
checkbox driving the panel via `:checked`, see `src/components/Nav.tsx`),
no client-side JavaScript needed. Desktop keeps the normal row of pills.

## One admin, and admin is not an employee

There's exactly one kind of admin account, the seeded `admin` user, and
role checks throughout the app (not just hiding a link) keep teachers out
of every `/admin*` page. The admin account also has no personal hours
page: it's not staff being tracked, just the person monitoring everyone
else, so "My Hours" doesn't appear in its nav, `/dashboard` redirects
straight to `/admin` if visited, and it can't clock in or out at all (a
tap URL redirects it away rather than logging anything).

## Trying out a test employee

Only the teacher account with the exact username `test` gets a "Test
employee tools" card on its detail page, with a "Generate demo data"
button, both in the UI and re-checked server-side, so it can't be pressed
by accident on a real teacher. To set one up, open any teacher's detail
page, change their "Username" field to `test`, and save; the card appears
immediately. Pressing it wipes that account's real clock history and
requests, then fills in about four months of randomized but realistic
attendance (varied times, both entrances, the occasional missed day so
streaks and gaps look real, plus one pending, one approved, and one denied
sample request). `src/lib/demoData.ts` has the generator if you want to
tweak how much history it creates or how it's distributed.

## Logo and app icon

Both are the real school branding now, not placeholders:

- **Login screen**: `public/logo-mark.png`, the transparent white clock
  mark, sitting directly on the dark login background.
- **Home screen icon**: `public/icon-192.png`, `public/icon-512.png`, and
  `public/apple-touch-icon.png` (180x180), all generated from the
  full-color pink and maroon square logo, flattened to a fully opaque PNG
  since a transparent `apple-touch-icon` renders wrong on iOS.

To replace either later, drop a new source image somewhere temporary and
regenerate with Pillow (`pip install pillow` if needed):

```python
from PIL import Image
src = Image.open("new-icon.png").convert("RGBA")
flat = Image.new("RGB", src.size, (255, 255, 255))  # pick a real background color
flat.paste(src, mask=src.split()[3])
for size, path in [(192, "public/icon-192.png"), (512, "public/icon-512.png"), (180, "public/apple-touch-icon.png")]:
    flat.resize((size, size), Image.LANCZOS).save(path)
```

## Getting started locally

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Seeded logins:

| Role    | Username | Password    |
| ------- | -------- | ------------ |
| Admin   | admin    | admin123     |
| Teacher | rklein   | teacher123   |
| Teacher | dstern   | teacher123   |
| Teacher | slevi    | teacher123   |
| Teacher | mkatz    | teacher123   |
| Teacher | cadler   | teacher123   |
| Teacher | ybraun   | teacher123   |

## Trying the tap flow without a physical tag

Because every real tap needs a valid, not-yet-used cryptographic
signature (see "How a captured tap-link is made useless" above), visiting
a bare URL like `/c/chabad-door` with no `picc_data`/`cmac` params no
longer clocks anyone in, it shows an error, the same as it would for a
real teacher who somehow landed on that page without tapping the tag.

To simulate a genuine tap for local testing, generate one with the same
keys as your `.env`:

```js
// scratch-simulate-tap.mjs, run with: node scratch-simulate-tap.mjs <uidHex> <counter>
import { createCipheriv } from "crypto";
import { AesCmac } from "aes-cmac";

const META_KEY = Buffer.from(process.env.NTAG_SDM_META_KEY, "hex");
const FILE_KEY = Buffer.from(process.env.NTAG_SDM_FILE_KEY, "hex");
const SV2_PREFIX = Buffer.from([0x3c, 0xc3, 0x00, 0x01, 0x00, 0x80]);
const pad = (b) => (b.length % 16 === 0 ? b : Buffer.concat([b, Buffer.alloc(16 - (b.length % 16))]));

const [, , uidHex, counterStr] = process.argv;
const uid = Buffer.from(uidHex, "hex");
const counter = parseInt(counterStr, 10);
const ctr = Buffer.from([counter & 0xff, (counter >> 8) & 0xff, (counter >> 16) & 0xff]);
const piccPlain = Buffer.concat([Buffer.from([0xc7]), uid, ctr, Buffer.alloc(5)]);

const cipher = createCipheriv("aes-128-cbc", FILE_KEY, Buffer.alloc(16));
cipher.setAutoPadding(false);
const piccEnc = Buffer.concat([cipher.update(piccPlain), cipher.final()]);

const sessionKey = Buffer.from(await new AesCmac(META_KEY).calculate(pad(Buffer.concat([SV2_PREFIX, uid, ctr]))));
const full = Buffer.from(await new AesCmac(sessionKey).calculate(Buffer.alloc(0)));
const mac = Buffer.alloc(8);
for (let i = 0; i < 8; i++) mac[i] = full[i * 2 + 1];

console.log(`http://localhost:3000/c/chabad-door?picc_data=${piccEnc.toString("hex")}&cmac=${mac.toString("hex")}`);
```

Run it with an increasing counter each time (`node scratch-simulate-tap.mjs 04AABBCCDDEE00 1`,
then `2`, then `3`, ...) since each tag UID only accepts a strictly higher
counter than the last one it saw, exactly like a real tag would produce.
The first counter you use for a given UID registers it; re-running the
same counter again should be rejected as a replay, that's the anti-replay
protection working correctly.

## Programming a real NFC tag

This app needs **NTAG 424 DNA** tags specifically (not a plain
NTAG213/215 sticker), and a different app than a simple URL writer:
**"NFC TagWriter by NXP"** (free, iOS/Android), since it's what supports
configuring the tag's Secure Dynamic Messaging feature.

1. Generate a 16-byte AES key as hex (`node -e "console.log(require('crypto').randomBytes(16).toString('hex').toUpperCase())"`)
   and set it as both `NTAG_SDM_META_KEY` and `NTAG_SDM_FILE_KEY` in your
   environment (using the same value for both is fine here, since this
   setup never uses SDM's separate encrypted-file-data feature).
2. In TagWriter: **Write tags → Link**, and enter your tap URL with two
   placeholder runs of zeros for the parameters this app expects:
   `https://yourapp.com/c/chabad-door?picc_data=00000000000000000000000000000000&cmac=0000000000000000`
   (32 zeros for `picc_data`, 16 zeros for `cmac`).
3. Tap **Configure Mirroring**, set the card type to **NTAG424DNA**, and
   enable **PICC Data mirroring** (this covers the tag's UID and read
   counter together) mapped to the `picc_data` placeholder, plus **SDM
   MAC** mirroring mapped to the `cmac` placeholder. Leave file-data
   mirroring off, this app doesn't use it.
4. When prompted for the SDM keys, enter the exact same hex value from
   step 1 for both the **SDM Meta Read Key** and **SDM File Read Key**.
   Leave the tag's other keys (like the master/change key) at their
   defaults unless you specifically want to lock down rewriting the tag
   later, getting that wrong can permanently lock you out of the tag.
5. Write the tag, then tap it with a phone to confirm the URL now shows
   long, different-looking `picc_data`/`cmac` values instead of zeros,
   and that they visibly change on a second tap.

Repeat for the second entrance's tag. The two tags can share the same
keys since each is identified by its own unique UID, registered
automatically the first time it's tapped for real (see above).

## Admin: importing the teacher roster

The admin dashboard (`/admin`) accepts a CSV with `name`, `username`,
`password`, `payType` (`Hourly` or `Job`), and an optional `title` column.
`sample-roster.csv` in this folder is a ready-made example. A username that
already exists gets updated (name, pay type, title if given, and password
if one is given); a new username creates a new teacher account. Note that
this uploads plaintext passwords for initial provisioning, worth having
teachers change theirs after first login if that matters to you.

## Admin: date range reports and export

`/admin/reports` lets you pick any date range and see hours and days
worked for every teacher, with an "Export CSV" button. The download
includes a per-entrance hours breakdown that the on-screen table doesn't
show, entrance detail lives on the per-teacher page and in the export, not
in the summary views.

## The long-shift reminder, honestly explained

You can't ask a website to notice that someone left the building. Real
geofencing needs a native app running in the background, which is a
different kind of project than this one. What this app does instead is
purely **time-based**: a background check runs every few minutes (via
`src/instrumentation.ts` locally, or a real scheduler once deployed), and
once it's past **5:00 PM Eastern**, it looks for anyone still clocked in
from earlier who hasn't been reminded yet for that shift. If it finds one,
it sends a push notification to their phone asking "still at school?", with
buttons to confirm or clock out. It has no idea whether they actually left,
only that it's past the time school is normally over and they're still
clocked in.

Someone who clocks in after 5:00 PM for an evening event isn't bothered
that same evening; if they forget to clock out, the same check catches it
the next day past 5:00 PM. The cutoff is hardcoded to `CUTOFF_HOUR_ET` in
`src/lib/push.ts` if you want a different time.

To receive these, a teacher has to enable them once (a small banner appears
on their dashboard). On iPhone, Safari only allows web push for a site added
to the home screen ("Add to Home Screen" from the Share menu) first; this
app is already set up as an installable PWA to enable that (`public/manifest.json`,
`public/sw.js`).

**Local dev:** the check runs automatically every 5 minutes while `npm run
dev` is running, no setup needed. There's also a "Run check now" button on
the admin page so you don't have to wait, and an "Enable" prompt on the
teacher dashboard to turn on notifications for that browser.

**In production:** `src/instrumentation.ts`'s `setInterval` won't survive a
serverless cold start on Vercel, so instead add a Vercel Cron entry hitting
`/api/cron/long-shift-check` every few minutes, with the `CRON_SECRET`
environment variable sent as `Authorization: Bearer <secret>`.

Push notifications need your own VAPID keys (the checked-in ones are for
local testing only). Generate a pair with:

```bash
npx web-push generate-vapid-keys --json
```

and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and
`VAPID_SUBJECT` (a `mailto:` address) accordingly.

## Deploying to Supabase, GitHub, and Vercel

The schema already points at Postgres (see `prisma/schema.prisma`), not
SQLite, so this is the live setup now, not a future step.

1. **Supabase**: create a project (or use an existing empty one). In
   Project Settings -> Database -> Connection string, grab two URLs:
   the "Transaction" pooler one (port 6543) for `DATABASE_URL`, and the
   "Session" pooler or direct one (port 5432) for `DIRECT_URL`. The first
   is what the running app uses; the second is only used to run
   migrations, since the transaction pooler doesn't support what
   migrations need.
2. **Run migrations against it**: set both URLs in `.env` locally, then:
   ```bash
   npx prisma migrate deploy
   ```
3. **Create the one admin account** (no fake teachers, this is real):
   ```bash
   ADMIN_USERNAME=admin ADMIN_PASSWORD=your-chosen-password npm run seed:prod
   ```
   Once deployed, sign in as that admin and use "Import teacher roster" to
   upload the real CSV, no fake data ever touches this database.
4. **GitHub**: push this repository (see below).
5. **Vercel**: import the GitHub repo as a new project. In its
   Environment Variables settings, set: `DATABASE_URL`, `DIRECT_URL`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   `CRON_SECRET`, `NTAG_SDM_META_KEY`, `NTAG_SDM_FILE_KEY`
   (generate fresh VAPID keys and a fresh `CRON_SECRET` for production,
   don't reuse the local dev ones in `.env`). Deploy.
6. **Vercel Cron**: `vercel.json` already has a cron entry hitting
   `/api/cron/long-shift-check` once a day at 23:00 UTC (around 6pm
   Eastern). Vercel automatically sends `Authorization: Bearer
   <CRON_SECRET>` on cron requests once that env var is set, matching what
   the route checks for. One run a day is enough since the check itself
   only fires past 5:00 PM Eastern anyway; it's also the most frequent a
   cron can run on Vercel's free Hobby plan, more frequent schedules need
   a paid plan. `src/instrumentation.ts`'s in-process interval only helps
   in local dev, it won't run reliably on Vercel's serverless functions.

## What's built vs. what's next

Built: username and password login with effectively permanent sessions,
the tap-to-clock flow with duplicate-tap protection and cryptographic
per-tap replay protection (NTAG 424 DNA SDM), two tracked entrances, a
personal metrics dashboard, a
mobile-friendly admin overview with staff-wide metrics, a per-teacher
detail page with editable info and full clock history, CSV roster import,
custom date range reporting with CSV export, teacher-submitted correction
requests with an admin approve/deny inbox, admin-added hours (both with
the "replace if fewer, add if more" overlap logic), a demo-data generator
for a designated test employee, and a 5:00 PM push reminder for anyone
still clocked in.

Not built yet: dynamic per-tap NFC verification (needs NTAG 424 DNA
hardware, see above), and a school calendar feed so holidays and breaks
are recognized automatically.
