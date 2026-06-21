import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCtqDDa5X8ZWvxIIbZD_P0LdeSMbk7juc",
  authDomain: "digital-mentor-98da3.firebaseapp.com",
  databaseURL: "https://digital-mentor-98da3-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "digital-mentor-98da3",
  storageBucket: "digital-mentor-98da3.firebasestorage.app",
  messagingSenderId: "937962102520",
  appId: "1:937962102520:web:3ea7d6529804c4fef5a50d"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);
const firestore = getFirestore(app);
const storage = getStorage(app);

export { app, database, firestore, storage };
export const getFirebaseDatabase = () => database;
export const getFirebaseFirestore = () => firestore;
export const getFirebaseStorage = () => storage;
export const getFirebaseDB = () => database;
export const getFirebaseAuth = () => null;

export { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from './auth';

