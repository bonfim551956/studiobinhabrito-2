import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD9yKFkMZ9BCcB2llQjqgOLO5XtUi2Q_ak",
  authDomain: "studio-binha-brito.firebaseapp.com",
  projectId: "studio-binha-brito",
  storageBucket: "studio-binha-brito.firebasestorage.app",
  messagingSenderId: "352860066723",
  appId: "1:352860066723:web:8377f62cada0a2ec728016"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
