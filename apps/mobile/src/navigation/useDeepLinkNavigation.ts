import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { navigateTo, type DeepLinkTarget } from './deepLinks';

/** Cross-stack navigation from nested stack screens. */
export function useDeepLinkNavigation() {
  const navigation = useNavigation();

  return useCallback(
    (target: DeepLinkTarget) => {
      const root = navigation.getParent() ?? navigation;
      navigateTo(root as never, target);
    },
    [navigation],
  );
}
