import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJhF0Hkz1kIfjb75BKzcHXfHfdZQd-5fM",
  authDomain: "saleweb-ad2f4.firebaseapp.com",
  projectId: "saleweb-ad2f4",
  storageBucket: "saleweb-ad2f4.firebasestorage.app",
  messagingSenderId: "975719202425",
  appId: "1:975719202425:web:458b304679a7456b549ea8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
