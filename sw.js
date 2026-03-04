// sw.js - Service Worker per le Notifiche Web Push Standard
// Questo file scavalca OneSignal e gestisce nativamente i messaggi APNS/FCM

self.addEventListener('push', function (event) {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const title = data.title || "Cantiere";
        const message = data.message || "Nuovo messaggio";

        const options = {
            body: message,
            icon: 'https://i.imgur.com/aBWW2ry.png', // Icona dell'app
            badge: 'https://i.imgur.com/aBWW2ry.png', // Iconcina monocromatica sulla barra di stato (speciale per Android)
            vibrate: [200, 100, 200], // Vibrazione per Android
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2'
            },
            // requireInteraction: true // De-commenta se vuoi che la notifica stia fissa finché non la cliccano
        };

        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    } catch (e) {
        console.error("Errore nel parsing del push payload:", e);
    }
});

self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notifica cliccata.');
    event.notification.close();

    // Comportamento fighissimo: se clicchi la notifica, cerca se c'è già una scheda aperta
    // della PWA. Se c'è, la porta in primo piano. Altrimenti, apre una nuova scheda.
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes('/Test/') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                // Modifica con l'URL corretto della tua repo se cambia
                return clients.openWindow('/Test/');
            }
        })
    );
});
