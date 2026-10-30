// Authentication is performed by Spring Boot. Never create users or verify passwords in the browser.
import { login, getSession, clearSession, saveSession } from '../api/client.js';
export { login, getSession, clearSession, saveSession };
export function findUserByEmail() {
  throw new Error('Local demo accounts are disabled. Sign in with a backend-managed username.');
}
export function createUser() {
  throw new Error('Self-registration is disabled. Ask an Administrator to provision your account.');
}
export async function signInUser(_user, password) {
  throw new Error('Local password verification is disabled. Use the backend login endpoint.');
}
