// Αλλάζεις την έκδοση αν θέλεις να καθαρίσεις τα πάντα χειροκίνητα
const CACHE_NAME = 'app-cache-v1';
const FONT_CACHE = 'app-fonts-cache';

// 1. Εγκατάσταση και ΑΜΕΣΗ ενεργοποίηση (χωρίς να περιμένει κλείσιμο καρτελών)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. Ενεργοποίηση, ανάληψη ελέγχου των ανοιχτών σελίδων και καθαρισμός παλιάς cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== FONT_CACHE)
            .map((key) => caches.delete(key))
        );
      })
    ])
  );
});

// 3. Διαχείριση αιτημάτων (Fetch Strategy)
self.addEventListener('fetch', (event) => {
  // Επεξεργαζόμαστε μόνο GET αιτήματα
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Εξαιρέσεις: Αγνοούμε dynamic APIs/Realtime databases (π.χ. Firebase, Supabase κ.λπ.)
  if (
    url.hostname.includes('firebasedatabase.app') ||
    url.hostname.includes('firebaseio.com')
  ) {
    return;
  }

  // Α. Cache-First ΜΟΝΟ για Google Fonts (για ταχύτητα και εξοικονόμηση δεδομένων)
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse;
        }
      })
    );
    return;
  }

  // Β. NETWORK-FIRST ΓΙΑ ΟΛΑ ΤΑ ΥΠΟΛΟΙΠΑ (HTML, JS, CSS, Media)
  // Προσπαθεί πάντα να φέρει την τελευταία έκδοση από το δίκτυο
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' }) // Παράκαμψη browser HTTP cache για άμεση λήψη αλλαγών
      .then((networkResponse) => {
        // Ενημερώνουμε την cache στο παρασκήνιο με τη νέα έκδοση
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Αν δεν υπάρχει σύνδεση (Offline), σερβίρει ό,τι υπάρχει αποθηκευμένο
        return caches.match(event.request);
      })
  );
});
