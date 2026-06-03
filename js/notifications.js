// ── NOTIFICATIONS FCM ──
const VAPID_KEY = "BNeOA8ltjt2oKHPsJWCc2KFgjalvllvBGRiGDNvo-eV6bAeokvqOMSIwrZp0iVQzW4xW1-UIoPfK6EsQwuvpvcw";

async function initNotifications(userInitial) {
  if (!("Notification" in window)) return;
  if (!("serviceWorker" in navigator)) return;

  try {
    // Demande permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Permission notifications refusée");
      return;
    }

    // Charge Firebase Messaging
    const { getMessaging, getToken, onMessage } =
      await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js");
    const messaging = getMessaging();

    // Récupère le token FCM
    const swReg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      // Sauvegarde le token dans Firebase sous /fcmTokens/{userInitial}
      await db.ref(`fcmTokens/${userInitial}`).set({
        token,
        updatedAt: Date.now(),
      });
      console.log("Token FCM enregistré");
    }

    // Notification reçue app ouverte
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification;
      // Affiche un toast dans l'app
      if (window.App) App.showToast(`${title} — ${body}`, "success");
    });
  } catch (e) {
    console.error("Erreur init notifications:", e);
  }
}
