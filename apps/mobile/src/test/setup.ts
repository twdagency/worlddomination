import { vi } from 'vitest';

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

vi.mock('../navigation/navigationRef', () => ({
  rootNavigationRef: {
    isReady: () => false,
    navigate: vi.fn(),
    getRootState: vi.fn(),
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
    multiRemove: vi.fn(async () => undefined),
  },
}));
