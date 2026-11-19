// Runs on Netlify's published production deploy, even with no visitors.
// It writes status to Function logs; it does NOT send alerts or store history.
import { checkHealth } from './health.mjs';
export default async () => {
  try {
    const data = await checkHealth();
    console.log(JSON.stringify({ monitor: 'red-devils-daily', ...data }));
    if (data.status !== 'ok') console.warn('RED DEVILS DAILY: review source freshness and service availability');
  } catch (err) {
    console.error('RED DEVILS DAILY monitor failed:', err?.message || 'unknown error');
  }
};
export const config = { schedule: '*/30 * * * *' }; // UTC, every 30 minutes
