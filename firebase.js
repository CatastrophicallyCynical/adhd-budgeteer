// Firebase init
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging.js";

export const firebaseConfig = {
  apiKey: "AIzaSyANub2HfbC4cxtMA5KLF_koMcg88Sn3TbM",
  authDomain: "adhd-budgeteer.firebaseapp.com",
  projectId: "adhd-budgeteer",
  storageBucket: "adhd-budgeteer.firebasestorage.app",
  messagingSenderId: "745115474281",
  appId: "1:745115474281:web:bf6c4e944a77f98676c5f8",
  measurementId: "G-D5F4EGX034"
};

const VAPID_PUBLIC_KEY = "BJ4kDlusoRDU_BM7xUlHcljbQ3ZqX3EeOAmTe_sT6MIJM2i8BdZAB2jtJwas1xnDHifRuEuGsgK6ZqvhQpvMY-k";

export const app = initializeApp(firebaseConfig);

export async function ensurePushPermission() {
  try {
    if (!(await isSupported())) return { ok:false, reason:"unsupported" };
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: await navigator.serviceWorker.getRegistration() });
    if (!token) return { ok:false };
    localStorage.setItem("fcm_token", token);
    return { ok:true, token };
  } catch (e) {
    console.error("Push permission error", e);
    return { ok:false, error: e?.message || String(e) };
  }
}

export async function listenForegroundMessages() {
  if (!(await isSupported())) return;
  const messaging = getMessaging(app);
  onMessage(messaging, (payload) => {
    console.log("Foreground message:", payload);
  });
}