import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { get, getDatabase, push, ref, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCtqDDa5X8ZWvxIIbZD_P0LdeSMbk7juc",
  authDomain: "digital-mentor-98da3.firebaseapp.com",
  databaseURL: "https://digital-mentor-98da3-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "digital-mentor-98da3",
  storageBucket: "digital-mentor-98da3.firebasestorage.app",
  messagingSenderId: "937962102520",
  appId: "1:937962102520:web:3ea7d6529804c4fef5a50d"
};

// Ensure app is initialized before using database
const getApp_ = () => {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
};

// Lazy getter — never call getDatabase at module top level
const getDB = () => getDatabase(getApp_());

const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

export const registerUser = async (email: string, password: string, name: string, role: 'doctor' | 'technician') => {
  const db = getDB();
  const emailKey = email.replace(/\./g, '_').replace(/@/g, '_at_');
  const userRef = ref(db, `users/${emailKey}`);
  const snap = await get(userRef);
  if (snap.exists()) throw new Error('Пользователь уже существует');
  const uid = push(ref(db, 'users')).key!;
  const userData = { uid, email, name, role, passwordHash: simpleHash(password), createdAt: Date.now() };
  await set(userRef, userData);
  await AsyncStorage.setItem('user', JSON.stringify(userData));
  return userData;
};

export const loginUser = async (email: string, password: string) => {
  const db = getDB();
  const emailKey = email.replace(/\./g, '_').replace(/@/g, '_at_');
  const snap = await get(ref(db, `users/${emailKey}`));
  if (!snap.exists()) throw new Error('Пользователь не найден');
  const userData = snap.val();
  if (userData.passwordHash !== simpleHash(password)) throw new Error('Неверный пароль');
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
  const emailKey = user.email.replace(/\./g, '_').replace(/@/g, '_at_');
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
