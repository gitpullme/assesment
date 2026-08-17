import type { ReactElement } from 'react';
import { FlatList, FlatListProps, ListRenderItemInfo, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface VirtualizedListProps<T> extends Omit<FlatListProps<T>, 'renderItem' | 'data'> {
  readonly data: readonly T[];
  readonly renderItem: (info: ListRenderItemInfo<T>) => ReactElement | null;
  readonly isLoading?: boolean;
  readonly emptyTitle?: string;
  readonly emptyMessage?: string;
  readonly onEmptyAction?: () => void;
  readonly emptyActionTitle?: string;
  readonly itemEstimatedHeight?: number;
}

export function VirtualizedList<T>({
  data,
  renderItem,
  isLoading = false,
  emptyTitle = 'No Items Found',
  emptyMessage = 'There are no records to display at this time.',
  onEmptyAction,
  emptyActionTitle,
  itemEstimatedHeight = 120,
  keyExtractor,
  ...rest
}: VirtualizedListProps<T>): ReactElement {
  const { colors, spacing } = useTheme();

  if (isLoading) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Skeleton height={itemEstimatedHeight} style={{ marginBottom: spacing.md }} />
        <Skeleton height={itemEstimatedHeight} style={{ marginBottom: spacing.md }} />
        <Skeleton height={itemEstimatedHeight} style={{ marginBottom: spacing.md }} />
        <Skeleton height={itemEstimatedHeight} style={{ marginBottom: spacing.md }} />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        actionTitle={emptyActionTitle}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <FlatList
      data={data as T[]}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      initialNumToRender={10}
      maxToRenderPerBatch={15}
      windowSize={7}
      removeClippedSubviews={true}
      getItemLayout={
        itemEstimatedHeight
          ? (_data, index) => ({
              length: itemEstimatedHeight,
              offset: itemEstimatedHeight * index,
              index,
            })
          : undefined
      }
      ListFooterComponent={
        data.length > 50 ? (
          <View style={[styles.footer, { padding: spacing.md }]}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              Showing {data.length} items (Virtualized)
            </Text>
          </View>
        ) : null
      }
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 12,
  },
});
