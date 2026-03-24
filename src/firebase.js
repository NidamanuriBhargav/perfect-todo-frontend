import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; 

const firebaseConfig = {
  apiKey: "AIzaSyBv0dzty5BhCu6Ctc-1qWglbJyWu-gDO9I",
  authDomain: "perfect-todo-app-e4bef.firebaseapp.com",
  projectId: "perfect-todo-app-e4bef",
  storageBucket: "perfect-todo-app-e4bef.firebasestorage.app",
  messagingSenderId: "72824514257",
  appId: "1:72824514257:web:577d7ddda7ed13402907f0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);