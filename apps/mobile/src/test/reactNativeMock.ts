import React from 'react';

type MockProps = {
  children?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  [key: string]: unknown;
};

function mockComponent(name: string) {
  const Component = ({ children, ...props }: MockProps) =>
    React.createElement(name, props, children);
  Component.displayName = name;
  return Component;
}

export const Platform = { OS: 'ios' as const, select: <T,>(options: { ios: T; android: T }) => options.ios };

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
};

export const Text = mockComponent('Text');
export const View = mockComponent('View');
export const Pressable = ({ children, onPress, testID, accessibilityLabel, ...props }: MockProps) =>
  React.createElement(
    'Pressable',
    { ...props, testID, onPress, accessibilityLabel },
    children,
  );
export const ScrollView = mockComponent('ScrollView');
export const FlatList = mockComponent('FlatList');
export const ActivityIndicator = mockComponent('ActivityIndicator');
