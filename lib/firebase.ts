import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'PASTE_FROM_FIREBASE',
  authDomain: 'PASTE_FROM_FIREBASE',
  projectId: 'PASTE_FROM_FIREBASE',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const initAuth = async () => {
  try {
    await signInAnonymously(auth);
    console.log('User signed in:', auth.currentUser?.uid);
  } catch (error) {
    console.log('Auth error:', error);
  }
};