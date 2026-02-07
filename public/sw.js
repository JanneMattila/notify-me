self.addEventListener('push', (event) => {
  let data = { text: 'New notification', url: '' };
  try {
    data = event.data.json();
  } catch {
    data = { text: event.data.text(), url: '' };
  }

  const options = {
    body: data.text,
    icon: data.icon || '/images/android-chrome-192x192.png',
    image: data.image,
    data: { url: data.url || '' },
  };

  event.waitUntil(self.registration.showNotification('Notify Me', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data.url;

  if (url) {
    // Try to open the URL directly; if it fails, use the redirect page
    event.waitUntil(
      clients.openWindow(url).catch(() => {
        const redirectUrl = new URL('/redirect', self.location.origin);
        redirectUrl.searchParams.set('text', event.notification.body || '');
        redirectUrl.searchParams.set('url', url);
        return clients.openWindow(redirectUrl.href);
      })
    );
  } else {
    event.waitUntil(clients.openWindow('/'));
  }
});
