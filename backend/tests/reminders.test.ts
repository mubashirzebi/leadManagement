import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import Organization from '../src/models/Organization';
import Lead from '../src/models/Lead';
import User from '../src/models/User';
import Reminder from '../src/models/Reminder';
import { processReminders } from '../src/services/reminderService';

describe('Reminder Service', () => {
  let orgId: any;
  let userId: any;
  let leadId: any;

  beforeEach(async () => {
    const org = await Organization.create({ name: 'Test Org' });
    orgId = org._id;

    const user = await User.create({ name: 'Staff', mobile: 'staff1', password: 'hash', role: 'staff', organization_id: orgId });
    userId = user._id;

    const lead = await Lead.create({ organization_id: orgId, name: 'Lead 1', mobile: '111', assigned_to: userId });
    leadId = lead._id;
  });

  it('should process due reminders and mark them as sent', async () => {
    // Create a due reminder
    const pastDate = new Date();
    pastDate.setMinutes(pastDate.getMinutes() - 5);

    await Reminder.create({
      organization_id: orgId,
      lead_id: leadId,
      user_id: userId,
      remind_at: pastDate,
      remark: 'Follow up now',
      is_sent: false
    });

    const sentCount = await processReminders();
    expect(sentCount).toBe(1);

    const updatedReminder = await Reminder.findOne({ lead_id: leadId });
    expect(updatedReminder?.is_sent).toBe(true);
  });

  it('should not process future reminders', async () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 1);

    await Reminder.create({
      organization_id: orgId,
      lead_id: leadId,
      user_id: userId,
      remind_at: futureDate,
      remark: 'Later',
      is_sent: false
    });

    const sentCount = await processReminders();
    expect(sentCount).toBe(0);
  });
});
