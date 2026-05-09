import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStore = new Map<string, string>();

const logPrefix = '[Storage]';

const getStorageErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export const storage = {
  async getItem(key: string) {
    try {
      const value = await AsyncStorage.getItem(key);
      console.log(`${logPrefix} getItem(${key}) ->`, value ? 'value found' : 'null');
      return value;
    } catch (error) {
      console.error(`${logPrefix} getItem(${key}) failed:`, getStorageErrorMessage(error));
      return memoryStore.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string) {
    try {
      await AsyncStorage.setItem(key, value);
      console.log(`${logPrefix} setItem(${key}) ok`);
    } catch (error) {
      console.error(`${logPrefix} setItem(${key}) failed:`, getStorageErrorMessage(error));
      memoryStore.set(key, value);
    }
  },

  async removeItem(key: string) {
    try {
      await AsyncStorage.removeItem(key);
      console.log(`${logPrefix} removeItem(${key}) ok`);
    } catch (error) {
      console.error(`${logPrefix} removeItem(${key}) failed:`, getStorageErrorMessage(error));
      memoryStore.delete(key);
    }
  },
};
