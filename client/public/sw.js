// Peptide Calculator service worker — push notifications only.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Peptide reminder", body: "Time for your dose." };
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    // ignore
  }
  const title = payload.title || "Peptide reminder";
  const options = {
    body: payload.body || "Time for your dose.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: payload.tag || "peptide-dose",
    data: payload.data || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow("/");
    })
  );
});
