const webpush = require('web-push');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

if (!publicKey || !privateKey || !subject) {
  console.error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT environment variables are required.');
  console.error('Generate keys with: npx web-push generate-vapid-keys');
  process.exit(1);
}

console.log('VAPID configured:');
console.log('- Public key:', publicKey.substring(0, 20) + '...');
console.log('- Private key:', privateKey.substring(0, 20) + '...');
console.log('- Subject:', subject);

webpush.setVapidDetails(subject, publicKey, privateKey);

module.exports = {
  publicKey,
  sendNotification(subscription, payload) {
    return webpush.sendNotification(subscription, JSON.stringify(payload));
  },
};
