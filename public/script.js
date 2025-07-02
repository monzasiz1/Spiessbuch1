if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js")
    .then(() => console.log("✅ Service Worker aktiv"))
    .catch(err => console.error("SW-Fehler:", err));
}
