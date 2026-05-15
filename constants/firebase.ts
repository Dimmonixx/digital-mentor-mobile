import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
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

const app = initializeApp(firebaseConfig);

let auth: any = null;
let database: any = null;
let storage: any = null;

export const getFirebaseAuth = () => {
  if (!auth) {
    auth = getAuth(app);
  }
  return auth;
};

export const getFirebaseDatabase = () => {
  if (!database) {
    database = getDatabase(app);
  }
  return database;
};

export const getFirebaseStorage = () => {
  if (!storage) {
    storage = getStorage(app);
  }
  return storage;
};
