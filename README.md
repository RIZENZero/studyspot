# StudySpot — P06 prototype

A responsive study-space finder prototype for the INT335 P06 project. It helps students explore quiet, collaborative and mixed campus spaces, compare sample space information, and share a current seat/noise report.

## Prototype features

- Grid and schematic campus map views, search, amenity filters and saved favorites.
- Sample occupancy and noise estimates, clearly labelled as illustrative rather than live measurements.
- Sample popular-time chart. Replace its starter values with real occupancy observations before presenting them as research findings.
- Student-submitted seat/noise reports. New starter data begins with zero report counts. A database created with an earlier version may still contain prefilled demo counts; verify or clear those before presenting them as submissions.
- Focus and break timers. The break timer is a personal timer and does not reserve a seat.
- Staff controls for updating, adding, editing and removing spaces. Changes require the server-side staff PIN.

## Run locally

1. Install Node.js 18 or newer.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env` and set a private `STAFF_PIN`. Add `MONGODB_URI` if using MongoDB Atlas.
4. Run `npm run dev` and open the local Vite URL (normally `http://localhost:5173`).

If MongoDB is not configured, the server uses in-memory sample data. If the MongoDB connection fails, it reports the fallback mode and continues with in-memory sample data. In-memory edits disappear when the server restarts.

## Data and research integrity

Starter occupancy, noise, and popular-time values are illustrative prototype content, not field research, live sensor readings, or claims about actual campus conditions. Collect and document your own observation and interview evidence separately. Student crowd reports are user-submitted and should not be described as verified research evidence.

## API

- `GET /api/health` — active database mode
- `GET /api/spaces` — list spaces (supports `zone`, `status`, and `q` query filters)
- `POST /api/staff/verify` — verify the configured staff PIN
- `POST /api/spaces`, `PUT /api/spaces/:id`, `PATCH /api/spaces/:id`, `DELETE /api/spaces/:id` — staff-only space management; send `x-staff-pin`
- `POST /api/spaces/:id/feedback` — submit a student seat/noise report
- `POST /api/reset` — restore starter sample spaces; requires `x-staff-pin`

Do not expose the prototype publicly with a simple PIN as its only protection. Use it for local/course demonstration unless stronger authentication and abuse controls are added.
