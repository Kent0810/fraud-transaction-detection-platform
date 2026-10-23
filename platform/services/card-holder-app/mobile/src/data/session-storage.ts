import * as SecureStore from 'expo-secure-store';

const KEY = 'cardholder.session';

export const readSession = () => SecureStore.getItemAsync(KEY);

export const writeSession = (value: string) => SecureStore.setItemAsync(KEY, value);

export const clearSession = () => SecureStore.deleteItemAsync(KEY);
