import { Transaction } from '../types';
import { getDB } from '../lib/db';

async function loadTransactionsForMonth(date: Date): Promise<Transaction[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly');
    const request = tx.objectStore('transactions').getAll();
    request.onsuccess = () => {
      const month = date.toISOString().slice(0, 7);
      const result = (request.result as Transaction[]).filter(t => t.date.startsWith(month));
      resolve(result);
    };
    request.onerror = () => reject(request.error);
  });
}

function notifyUser(message: string): void {
  if ('Notification' in window) {
    Notification.requestPermission().then(() => {
      new Notification(message);
    });
  } else {
    console.log(message);
  }
}

export const NotificationService = {
  scheduleMonthlyReport(): void {
    const check = () => {
      const now = new Date();
      if (now.getDate() === 1 && now.getHours() === 9 && now.getMinutes() === 0) {
        loadTransactionsForMonth(now).then(() => notifyUser('Monatsübersicht bereit'));
      }
    };
    setInterval(check, 60 * 1000);
  }
};
