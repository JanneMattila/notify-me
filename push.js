const webpush = require('web-push');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

if (!publicKey || !privateKey || !subject) {
  console.error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT environment variables are required.');
  console.error('Generate keys with: npx web-push generate-vapid-keys');
  process.exit(1);
}

webpush.setVapidDetails(subject, publicKey, privateKey);

module.exports = {
  publicKey,
  sendNotification(subscription, payload) {
    return webpush.sendNotification(subscription, JSON.stringify(payload));
  },
};
