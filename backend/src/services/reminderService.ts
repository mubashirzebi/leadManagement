import Reminder from '../models/Reminder';
import cron from 'node-cron';

export const processReminders = async (): Promise<number> => {
  const now = new Date();
  
  // Find all reminders that are due and haven't been sent
  const dueReminders = await Reminder.find({
    remind_at: { $lte: now },
    is_sent: false
  });

  if (dueReminders.length === 0) return 0;

  // Mark them as sent
  // Note: In Phase 3, we will add FCM/Web Push trigger here
  const reminderIds = dueReminders.map(r => r._id);
  
  await Reminder.updateMany(
    { _id: { $in: reminderIds } },
    { $set: { is_sent: true } }
  );

  return dueReminders.length;
};

export const initCronJobs = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const count = await processReminders();
      if (count > 0) {
        console.log(`[Cron] Sent ${count} reminders.`);
      }
    } catch (error) {
      console.error('[Cron] Error processing reminders:', error);
    }
  });
};
