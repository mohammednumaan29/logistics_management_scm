import { login, workspaceForRole, roleName, getSession, clearSession } from './api/client.js';

const form = document.querySelector('#login-form');
const message = document.querySelector('#login-message');
const password = document.querySelector('#password');
const togglePassword = document.querySelector('#toggle-password');
const roleLabel = document.querySelector('#selected-role');
const createAccountForm = document.querySelector('#create-account-form');
const emailInput = document.querySelector('#email');
const expired = new URLSearchParams(location.search).get('expired') === '1';

if (createAccountForm) createAccountForm.hidden = true;
const roleHint = sessionStorage.getItem('disruptioniq-selected-role');
if (roleLabel) roleLabel.textContent = roleHint || 'Your assigned role is detected after sign in';
const emailLabel = document.querySelector('label[for="email"]');
if (emailLabel) emailLabel.textContent = 'Username';
if (emailInput) {
  emailInput.type = 'text';
  emailInput.name = 'username';
  emailInput.placeholder = 'Enter your username';
  emailInput.autocomplete = 'username';
}
const note = document.querySelector('.prototype-note');
if (note) note.textContent = 'Secure sign-in · Your role and permissions are managed by DisruptionIQ.';
if (expired && message) {
  message.textContent = 'Your session has expired. Please sign in again.';
  message.classList.add('is-error');
}
if (getSession()?.accessToken) {
  location.replace(workspaceForRole(getSession().role));
}

togglePassword?.addEventListener('click', () => {
  if (!password) return;
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  togglePassword.textContent = visible ? 'Hide' : 'Show';
});

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!message) return;
  message.textContent = '';
  message.classList.remove('is-error');
  const username = emailInput?.value.trim() || '';
  const enteredPassword = password?.value || '';
  if (!username || !enteredPassword) {
    message.textContent = 'Enter your username and password.';
    message.classList.add('is-error');
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  if (submit) { submit.disabled = true; submit.dataset.originalText = submit.textContent; submit.textContent = 'Signing in…'; }
  try {
    const session = await login(username, enteredPassword);
    const actualRole = roleName(session.role);
    if (roleHint && roleHint !== actualRole) {
      // The selected role is only a navigation hint; backend identity always wins.
      sessionStorage.removeItem('disruptioniq-selected-role');
    }
    location.replace(workspaceForRole(session.role));
  } catch (error) {
    message.textContent = error.message;
    message.classList.add('is-error');
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = submit.dataset.originalText || 'Continue →'; }
  }
});
