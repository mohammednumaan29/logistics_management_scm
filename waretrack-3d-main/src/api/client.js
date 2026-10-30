const API_BASE = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const SESSION_KEY = 'disruptioniq.backend.session.v1';

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
export function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('disruptioniq-selected-role');
}
export function roleOf(session = getSession()) {
  return String(session?.role || '').replace(/^ROLE_/, '').toUpperCase();
}
export function roleName(role) {
  return ({
    OPERATIONS_ANALYST: 'Operations Analyst',
    SUPPLY_CHAIN_MANAGER: 'Supply Chain Manager',
    WAREHOUSE_OPERATOR: 'Warehouse Operator',
    PROCUREMENT_APPROVER: 'Procurement Approver',
    ADMIN: 'Administrator',
  })[roleOf({role})] || 'Unknown role';
}
export function workspaceForRole(role) {
  return ({
    OPERATIONS_ANALYST: '/src/operations-analyst.html',
    SUPPLY_CHAIN_MANAGER: '/src/supply-chain-manager.html',
    WAREHOUSE_OPERATOR: '/src/warehouse-operator.html',
    PROCUREMENT_APPROVER: '/src/procurement-approver.html',
    ADMIN: '/src/administrator.html',
  })[roleOf({role})] || '/src/login.html';
}
export async function apiRequest(path, options = {}) {
  const session = getSession();
  const headers = new Headers(options.headers || {});
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  if (!(options.body instanceof FormData) && options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
      ...options, headers,
    });
  } catch (error) {
    throw new Error(`Cannot connect to DisruptionIQ backend at ${API_BASE}. ${error.message}`);
  }
  const raw = await response.text();
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  if (response.status === 401) {
    clearSession();
    if (!location.pathname.endsWith('/login.html')) location.replace('/src/login.html?expired=1');
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (!response.ok) {
    const message = payload?.message || payload?.error || payload?.details?.[0] || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}
export const get = path => apiRequest(path);
export const post = (path, body) => apiRequest(path, {method:'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {})});
export const patch = (path, body) => apiRequest(path, {method:'PATCH', body:JSON.stringify(body ?? {})});
export const put = (path, body) => apiRequest(path, {method:'PUT', body:JSON.stringify(body ?? {})});

export async function login(username, password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({username, password}),
  });
  const raw = await response.text();
  let payload;
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
  if (!response.ok) throw new Error(payload.message || payload.error || 'Invalid username or password.');
  if (!payload.accessToken || !payload.role) throw new Error('The backend login response did not include accessToken and role.');
  saveSession(payload);
  return payload;
}

export async function requireRole(allowedRoles) {
  const session = getSession();
  if (!session?.accessToken) {
    location.replace('/src/login.html');
    return new Promise(() => {});
  }
  const current = roleOf(session);
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!allowed.includes(current)) {
    const target = workspaceForRole(current);
    location.replace(target);
    return new Promise(() => {});
  }
  return true;
}

export async function fetchWorkspaceData() {
  const paths = {
    shipments:'/api/shipments', suppliers:'/api/suppliers', warehouses:'/api/warehouses',
    inventory:'/api/inventory', products:'/api/products', orders:'/api/orders', customers:'/api/customers'
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key,path]) => {
    try { return [key, await get(path), null]; }
    catch (error) { return [key, null, error.message]; }
  }));
  return Object.fromEntries(entries.map(([key,data,error]) => [key,{data,error}]));
}
