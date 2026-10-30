import { getSession, workspaceForRole } from './api/client.js';
const cards = document.querySelectorAll('.role-card');
const form = document.querySelector('#role-form');
const message = document.querySelector('#role-message');
const ROLE_STORAGE_KEY = 'disruptioniq-selected-role';
const roleAuthority = {
  'Operations Analyst':'OPERATIONS_ANALYST',
  'Supply Chain Manager':'SUPPLY_CHAIN_MANAGER',
  'Warehouse Operator':'WAREHOUSE_OPERATOR',
  'Procurement Approver':'PROCUREMENT_APPROVER',
  'Administrator':'ADMIN',
  // Legacy workspace labels map to the nearest supported backend role.
  'Inventory Manager':'WAREHOUSE_OPERATOR',
  'Logistics & Transportation Manager':'SUPPLY_CHAIN_MANAGER',
};
let selectedRole = '';
if (getSession()?.accessToken) location.replace(workspaceForRole(getSession().role));
cards.forEach(card => {
  const role = card.dataset.role;
  if (!Object.hasOwn(roleAuthority, role)) return;
  card.setAttribute('aria-pressed','false');
  card.addEventListener('click', () => {
    selectedRole = role;
    cards.forEach(item => {
      const active = item === card;
      item.classList.toggle('selected', active);
      item.setAttribute('aria-pressed', String(active));
    });
    if (message) message.textContent = '';
  });
});
form?.addEventListener('submit', event => {
  event.preventDefault();
  if (!Object.hasOwn(roleAuthority, selectedRole)) {
    if (message) message.textContent = 'Select a workspace to continue.';
    return;
  }
  // A role selection is only a workspace hint. Spring Boot's JWT role always wins.
  sessionStorage.setItem(ROLE_STORAGE_KEY, selectedRole);
  location.href = '/src/login.html';
});
