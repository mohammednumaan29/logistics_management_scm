# WareTrack 3D — Trung tâm điều hành kho vận 3D (demo ERP)

Bản dựng lại web app trong video tham chiếu (`docs/ref/reference_video.mp4`):
- bản đồ thành phố 3D isometric với 5 kho;
- xe tải, xe nâng, pallet chuyển động theo thời gian thực;
- giao diện điều hành kính mờ: KPI, panel chi tiết, theo dõi đơn hàng, Fleet.

Toàn bộ dữ liệu là dữ liệu giả lập.

**Demo trực tuyến:** https://nguyenthong251.github.io/waretrack-3d/ — mỗi lần push lên `main`, GitHub Actions tự build và deploy lại (`.github/workflows/deploy.yml`).

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Bản build production: `npm run build`, rồi `npm run preview`.

Link sâu (mở thẳng một kho / một đối tượng):
`/?site=WH-04&select=truck:TRK-2205&tab=trucks` · `/?site=ALL` (tổng quan mạng lưới) · `/?select=forklift:FL-01`

## Thao tác

- Kéo chuột trái để di chuyển bản đồ, chuột phải để xoay, cuộn để zoom. Có thêm các nút + − ⟲ ⟳ ⌂.
- Rê chuột vào xe, pallet, dock, trạm sạc hoặc tòa nhà sẽ hiện nhãn. Click để mở panel chi tiết; Esc hoặc ✕ để đóng.
- Chọn kho ở thanh trên cùng: `›` sang kho kế tiếp, `⌄` mở danh sách (gồm "Network overview").
- Tìm kiếm: nhấn `/` rồi gõ (ví dụ "helmet", "TRK-2205", "FL-12").
- Panel xe: nút ⌖ đưa camera tới đối tượng, nút ↗ cho camera bám theo xe.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/data/mockData.js` | Dữ liệu ERP giả lập: kho, mã hàng (SKU), hãng vận tải, xe tải, xe nâng, pallet (LPN), dock, trạm sạc, đơn vận chuyển, thông báo |
| `src/data/db.js`, `selectors.js`, `format.js` | Lớp truy cập dữ liệu, số liệu dẫn xuất (KPI, tiến độ, hàng đợi) và định dạng hiển thị |
| `src/data/layout.js` | Bố cục không gian: vị trí dock, bãi, tuyến đường, góc camera từng kho |
| `src/state/store.js` | Trạng thái giao diện và event bus |
| `src/state/simulation.js` | Mô phỏng vận hành: xe vào cổng, lùi vào dock, bốc/dỡ hàng, xe nâng, sạc pin, đồng hồ |
| `src/three/` | Scene, camera, tương tác, thế giới 3D, các mô hình (`models/`) |
| `src/ui/` | Toàn bộ giao diện overlay |
| `docs/SPEC.md` | Đặc tả và hợp đồng API giữa các module |
| `dev/*.html` | Trang thử riêng từng phần, ví dụ http://localhost:5173/dev/buildings.html |

Các dashboard theo vai trò dùng giao diện dữ liệu 2D; bản đồ 3D WareTrack chỉ xuất hiện trong demo độc lập, không nhúng vào workspace của người dùng.

Workspace Operations Analyst gồm tổng quan KPI, supply-chain monitoring, quản lý disruption, order impact, shipment risk, inventory impact, giải thích rủi ro theo dữ liệu, recovery planning, what-if simulation, recovery tracking, báo cáo, activity log, thông báo và cài đặt. Workspace đọc dữ liệu demo dùng chung; recovery plans được lưu ở shared workflow store, còn kịch bản mô phỏng được lưu tách biệt. Analyst chỉ theo dõi task và kết quả, không thể phê duyệt recovery plan, xác nhận shipment/nhập kho, điều chỉnh tồn kho hoặc thực thi task qua giao diện. Điểm rủi ro và chi phí/thời gian mô phỏng là ước tính minh bạch theo rule, không phải dự báo AI hay kết quả thực tế. Sơ đồ kho trong workspace là minh họa 2D, không phải theo dõi thiết bị trực tiếp.

Workspace Inventory Manager là dashboard riêng, sử dụng giao diện bảng và biểu đồ 2D cho tồn kho, bổ sung hàng, luân chuyển, nhận hàng, điều chỉnh, kiểm kê, nhà cung cấp, cảnh báo, báo cáo, nhật ký và cài đặt. Các quy trình demo được tính từ cùng bộ dữ liệu sản phẩm, lưu trong trình duyệt; phê duyệt mua hàng và điều chỉnh vẫn cần vai trò được cấp quyền. Không sử dụng bản đồ kho 3D trong workspace này.

Workspace Logistics & Transportation Manager là dashboard 2D riêng cho shipment, transport planning, fleet, carriers, tracking mô phỏng, disruptions, routes, reports, activity, notifications và settings. KPI và thao tác dùng chung dữ liệu shipment demo; trạng thái xe được suy ra từ phân công shipment. Chi phí, GPS, hình học tuyến đường và tích hợp carrier trực tiếp không có trong dữ liệu demo nên không được giả lập thành số liệu thật.

Workspace Supply Chain Manager is a dedicated 2D management dashboard for network disruptions, risk review, recovery-plan decisions, execution authorization, performance, monitoring, reports, notifications, and audit history. Operations Analysts can submit or revise plans from incident records; the manager reviews those same plans from the shared browser workflow store. Approval and execution authorization are separate, and additional Procurement/Warehouse approvals are checked before authorization creates tasks. Manager decisions, prerequisite approvals, and execution updates are recorded in the demo audit history.

Workspace Procurement Approver is a dedicated 2D read-only procurement and recovery-review dashboard with operational record views, risk context, plan review, pending approval decisions, notifications, and personal activity. Shared operational and recovery records are browser demo data. The expected approval, notification, and audit endpoints are not implemented in this frontend-only repository; the dashboard never updates a recovery decision locally and requires the backend to validate identity, role, plan status, and separation of duties.

Workspace Administrator is a 2D platform overview using the same black, yellow, and off-white visual theme as the other role dashboards. It surfaces shared operational demo records, recovery workflow state, derived disruption context, notifications, and demo recovery audit entries. Orders and customers remain unavailable when not present in the shared demo data. Recovery decisions, execution, progress updates, authenticated notifications, imports, AI services, and system-wide audit retrieval require backend services and are not simulated as successful.

All role workspaces in this project are frontend-only demonstrations. The shared recovery workflow uses browser `localStorage`; its role/creator checks demonstrate the intended rules but are not a security boundary or backend authorization. A production deployment must enforce identity, separation of duties, immutable audit storage, and approval/task creation in a trusted server. Demo simulations and recorded actual outcomes are labeled separately.

## Nối với ERP thật

UI và 3D chỉ đọc dữ liệu qua `db.js` và `selectors.js`. Muốn nối ERP/WMS thật thì làm 3 bước:

1. Thay `mockData.js` bằng dữ liệu tải từ API, giữ nguyên tên trường.
2. Đưa vị trí xe thật (GPS/RTLS) vào `position` / `heading`, hoặc để `simulation.js` nội suy giữa các mốc.
3. Mỗi khi dữ liệu thay đổi, gọi `bus.emit('data:update')` để giao diện cập nhật.


---

## DisruptionIQ backend connection

The original WareTrack 3D scene remains a standalone demonstration. The DisruptionIQ role workspaces now use backend-managed authentication:

- `POST /api/auth/login` is the only sign-in mechanism.
- Usernames and passwords are verified by Spring Boot; no browser-local user database or password hashing is used.
- The backend-issued JWT is attached to authenticated API requests.
- The role returned by the backend controls which workspace can be opened.
- Supported backend roles: Operations Analyst, Supply Chain Manager, Warehouse Operator, Procurement Approver, Administrator.
- Inventory Manager and Logistics & Transportation Manager are legacy demo workspaces, not backend roles. They are mapped to Warehouse Operator and Supply Chain Manager permissions respectively and are hidden from role selection.

Set `VITE_API_BASE_URL=http://localhost:8080` in `.env` (see `.env.example`).

See [BACKEND_INTEGRATION_NOTES.md](./BACKEND_INTEGRATION_NOTES.md) for the exact scope and remaining backend integration work.
