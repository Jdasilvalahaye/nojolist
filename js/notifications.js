// ── NOTIFICATIONS FCM ──
const VAPID_KEY = "BNeOA8ltjt2oKHPsJWCc2KFgjalvllvBGRiGDNvo-eV6bAeokvqOMSIwrZp0iVQzW4xW1-UIoPfK6EsQwuvpvcw";

async function initNotifications(userInitial) {
  if (!("Notification" in window)) {
    console.log("Notifications non supportées");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    console.log("Permission:", permission);
    if (permission !== "granted") return;

    const messaging = firebase.messaging();

    const swReg = await navigator.serviceWorker.ready;
    const token = await messaging.getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      await db.ref(`fcmTokens/${userInitial}`).set({
        token,
        updatedAt: Date.now(),
      });
      console.log("Token FCM enregistré:", token);
    }

    messaging.onMessage((payload) => {
      const { title, body } = payload.notification;
      if (window.App) App.showToast(`${title} — ${body}`, "success");
    });
  } catch (e) {
    console.error("Erreur notifications:", e);
  }
}
