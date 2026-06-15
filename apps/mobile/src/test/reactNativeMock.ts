import React from 'react';

function mockComponent(name: string) {
  const Component = ({ children, ...props }: { children?: React.ReactNode }) =>
    React.createElement(name, props, children);
  Component.displayName = name;
  return Component;
}

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
};

export const Text = mockComponent('Text');
export const View = mockComponent('View');
export const Pressable = mockComponent('Pressable');
export const ScrollView = mockComponent('ScrollView');
export const FlatList = mockComponent('FlatList');
export const ActivityIndicator = mockComponent('ActivityIndicator');
