import Taro from '@tarojs/taro';

interface PendingRetest {
  buildingId: string;
  floor: number;
}

let pendingRetest: PendingRetest | null = null;
const HANDLED_REMINDERS_KEY = 'light_evaluator_handled_reminders';

export const setPendingRetest = (data: PendingRetest) => {
  pendingRetest = data;
};

export const consumePendingRetest = (): PendingRetest | null => {
  const data = pendingRetest;
  pendingRetest = null;
  return data;
};

const getHandledReminderIds = (): Set<string> => {
  try {
    const data = Taro.getStorageSync(HANDLED_REMINDERS_KEY);
    if (data) {
      const arr = JSON.parse(data) as string[];
      return new Set(arr);
    }
  } catch (e) {
    console.error('[retestNavigate] getHandledReminderIds error:', e);
  }
  return new Set();
};

const saveHandledReminderIds = (ids: Set<string>) => {
  try {
    Taro.setStorageSync(HANDLED_REMINDERS_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.error('[retestNavigate] saveHandledReminderIds error:', e);
  }
};

export const markReminderHandled = (reminderId: string) => {
  const ids = getHandledReminderIds();
  ids.add(reminderId);
  saveHandledReminderIds(ids);
};

export const isReminderHandled = (reminderId: string): boolean => {
  return getHandledReminderIds().has(reminderId);
};

export const getAllHandledReminderIds = (): Set<string> => {
  return getHandledReminderIds();
};
