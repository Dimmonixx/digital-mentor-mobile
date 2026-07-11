import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

const API_BASE_URL = 'http://62.238.13.160:8000';

const firebaseConfig = {
  apiKey: "AIzaSyCtqDDa5X8ZWvxIIbZD_P0LdeSMbk7juc",
  authDomain: "digital-mentor-98da3.firebaseapp.com",
  databaseURL: "https://digital-mentor-98da3-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "digital-mentor-98da3",
  storageBucket: "digital-mentor-98da3.firebasestorage.app",
  messagingSenderId: "937962102520",
  appId: "1:937962102520:web:3ea7d6529804c4fef5a50d"
};

const getApp_ = () => {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
};

const getDB = () => getDatabase(getApp_());

export const emailToKey = (email: string): string =>
  email.trim().toLowerCase().replace(/\./g, '_').replace(/@/g, '_');

const _handleResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || 'Ошибка сервера');
  }
  return data;
};

export const registerUser = async (
  email: string,
  password: string,
  name: string,
  role: 'doctor' | 'technician'
) => {
  const emailKey = emailToKey(email);
  console.log('REGISTER: via backend for email:', email, 'key:', emailKey);

  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password, name, role }),
  });

  const data = await _handleResponse(response);
  const userData = {
    id: emailKey,
    uid: emailKey,
    emailKey,
    email: data.user.email,
    name: data.user.name,
    role: data.user.role,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem('user', JSON.stringify(userData));
  return userData;
};

export const loginUser = async (email: string, password: string) => {
  const emailKey = emailToKey(email);
  console.log('LOGIN: via backend for email:', email, 'key:', emailKey);

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const data = await _handleResponse(response);
  const userData = {
    id: emailKey,
    uid: emailKey,
    emailKey,
    email: data.user.email,
    name: data.user.name,
    role: data.user.role,
  };
  await AsyncStorage.setItem('user', JSON.stringify(userData));
  return userData;
};

export const logoutUser = async () => {
  await AsyncStorage.removeItem('user');
  await AsyncStorage.removeItem('userProfile');
};

export const getCurrentUser = async () => {
  const raw = await AsyncStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
};

export const updateUserProfile = async (updates: any) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Не авторизован');
  const db = getDB();
  const emailKey = emailToKey(user.email);
  await set(ref(db, `users/${emailKey}/profile`), { ...updates, updatedAt: Date.now() });
  const updated = { ...user, ...updates };
  await AsyncStorage.setItem('user', JSON.stringify(updated));
  return updated;
};

// Compatibility aliases for existing screens
export const createUserWithEmailAndPassword = async (
  _auth: any,
  email: string,
  password: string
) => {
  const user = await getCurrentUser();
  if (!user) throw new Error('Не авторизован');
  const registered = await registerUser(email, password, user.name || email, user.role || 'doctor');
  return { user: registered };
};

export const signInWithEmailAndPassword = async (
  _auth: any,
  email: string,
  password: string
) => {
  const loggedIn = await loginUser(email, password);
  return { user: loggedIn };
};

export const updateProfile = async (_user: any, _profile: any) => {
  return Promise.resolve();
};

export const changeUserPassword = async (_currentPassword: string, _newPassword: string): Promise<void> => {
  throw new Error('Смена пароля через приложение временно отключена. Обратитесь к администратору.');
};

export const isCurrentUserAdmin = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user?.isAdmin === true || user?.email === 'dimmonix@gmail.com';
};

export const verifyEmail = async (email: string, code: string) => {
  const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), code: code.trim() }),
  });
  return _handleResponse(response);
};

export const resendVerificationCode = async (email: string) => {
  const response = await fetch(`${API_BASE_URL}/auth/resend-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  return _handleResponse(response);
};
