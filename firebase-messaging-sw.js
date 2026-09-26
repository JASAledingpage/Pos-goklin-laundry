// Mengimpor SDK di latar belakang
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

// Inisialisasi Firebase
firebase.initializeApp({
  apiKey: "AIzaSyD3H8LBpYKpQylav3ih2CH3E8Y7GxM3ZS0",
  projectId: "goklin-pos-1bae4",
  messagingSenderId: "787509393508",
  appId: "1:787509393508:web:f5044a97d87564d7bd0771"
});

const messaging = firebase.messaging();

// Menangani notifikasi saat PWA di background / ditutup
messaging.onBackgroundMessage((payload) => {
  console.log("Menerima pesan di latar belakang:", payload);

  const notificationTitle = payload.notification?.title || "GOKLin Laundry";
  const notificationOptions = {
    body: payload.notification?.body || "Laundry Anda sudah siap diantar!",
    icon: "/icon-192.png"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
