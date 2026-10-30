# DisruptionIQ Backend Integration Notes

## What changed
- Replaced browser-local account creation/password hashing with Spring Boot authentication.
- Login sends `{ "username": "...", "password": "..." }` to `POST /api/auth/login`.
- Stores the returned `accessToken` and role in `sessionStorage`; authenticated API requests use `Authorization: Bearer <token>`.
- Backend role, not a role chosen on the role-selection screen, determines the workspace.
- Added role guards to Operations Analyst, Supply Chain Manager, Warehouse Operator, Procurement Approver, and Administrator workspaces.
- Unsupported demo-only roles (Inventory Manager and Logistics & Transportation Manager) are hidden from role selection because the backend's five supported roles do not include them. Their functionality must be incorporated into the Warehouse Operator and Supply Chain Manager workspaces respectively, not represented as new backend roles.
- The root route now opens the backend login flow instead of the independent mock 3D WareTrack simulation.

## Backend contract used
- `POST /api/auth/login` with username/password.
- Expected response fields: `accessToken`, `tokenType`, `expiresIn`, `userId`, `username`, `role`.
- `GET /api/shipments`, `/api/suppliers`, `/api/warehouses`, `/api/inventory`, `/api/products`, `/api/orders`, `/api/customers`.
- API base URL defaults to `http://localhost:8080`; configure `VITE_API_BASE_URL` in `.env`.

## Important existing limitations identified
The original frontend is a standalone Vite/Three.js demonstration, not a React application. Its seven role workspaces use local demo records and `localStorage` workflow state. The project README itself says that all role workspaces are frontend-only demonstrations and that approval, execution, progress, imports, AI services, notifications and audit retrieval need backend services.

The uploaded repository did not include the backend source code, only the backend folder-structure README. Therefore this integration deliberately does not invent recovery, approval, execution, notification or audit endpoint contracts. Those workflow actions remain demo implementations until connected to exact controller mappings and DTOs from the actual backend source.

## Run
```bash
npm install
cp .env.example .env
npm run dev
```
Open `http://localhost:5173`. Ensure Spring Boot is running on port 8080 and CORS allows `http://localhost:5173`.

## UI preservation
Existing page HTML, workspace CSS, theme files, colour tokens, layout and component markup were not redesigned. Only login field semantics, role selection behavior, root navigation, backend auth guards, and integration code were changed.


## Data integration details
The shared Operations Analyst data module now hydrates its shipment, inventory, and warehouse views from the authenticated master-data GET endpoints. It maps backend records into the existing view-model fields expected by the current pages, and derives shipment-delay / low-stock alerts from returned backend records. Existing HTML/CSS templates and styles are preserved.

The procurement and warehouse pages' existing backend request helpers now use the shared JWT-aware API client instead of unauthenticated `fetch()` calls.

## Not yet connected
The repository's original local recovery-workflow store still contains demo plans and localStorage state. The source archive did not include the actual backend controllers/DTOs, so approval, rejection, modification, execution authorization, recovery-progress, audit and import UI actions have not been rewritten against unverified request contracts. Do not treat those local workflow records as backend records. The service helpers in `src/api/disruptioniq.js` expose the verified dashboard, import, AI, notification and audit API calls for the next integration pass.
