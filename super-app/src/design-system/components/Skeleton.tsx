import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeContext';

export interface SkeletonProps {
  readonly width?: number | string;
  readonly height?: number;
  readonly borderRadius?: number;
  readonly style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 6,
  style,
}: SkeletonProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.skeleton,
        {
          width: width as unknown as number,
          height,
          borderRadius,
          backgroundColor: colors.surfaceHover,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    opacity: 0.6,
    marginVertical: 4,
  },
});
