import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MiniAppProps, UserScopedProfile } from '../../kernel/types';
import { SportsRepository, SportsActivity } from '../../repositories/sports.repository';
import { VirtualizedList } from '../../design-system/components/VirtualizedList';
import { Card } from '../../design-system/components/Card';
import { Button } from '../../design-system/components/Button';
import { ToastBanner } from '../../design-system/components/Toast';
import { useTheme } from '../../design-system/ThemeContext';
import { OfflineSyncQueue } from '../../kernel/offline/syncQueue';

export function SportsMiniApp({ sdk }: MiniAppProps): React.ReactElement {
  const { colors, spacing, borderRadius, typography } = useTheme();

  const [user, setUser] = useState<UserScopedProfile | null>(null);
  const [activities, setActivities] = useState<readonly SportsActivity[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [bookingInProgressId, setBookingInProgressId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ title: string; message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const [shouldDeliberatelyCrash, setShouldDeliberatelyCrash] = useState<boolean>(false);
  const [benchmarkMode250, setBenchmarkMode250] = useState<boolean>(false);

  // Reproducible crash test
  if (shouldDeliberatelyCrash) {
    throw new Error('REPRODUCIBLE CRASH TEST: Deliberate runtime exception in Sports Mini-App to test Fault Isolation Error Boundary!');
  }

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch user via injected SDK capability boundary
      const scopedUser = await sdk.auth.getUser();
      setUser(scopedUser);

      // 2. Load stored filter preference from namespaced storage
      const savedCategory = await sdk.storage.get<string>('pref_category');
      if (savedCategory) {
        setSelectedCategory(savedCategory);
      }

      // 3. Fetch activities via typed repository
      const list = await SportsRepository.getActivities();
      setActivities(list);
    } catch (err) {
      console.error('Failed to load sports data:', err);
      // Fallback sample data if backend is offline during early start
      const now = Date.now();
      const mockList: SportsActivity[] = [
        {
          id: 'act_tennis_01',
          title: 'Sunset Clay Court Tennis Doubles',
          category: 'tennis',
          hostName: 'Coach Marcus',
          venue: 'Grand Central Tennis Club, Court 3',
          startTime: new Date(now + 2 * 3600 * 1000).toISOString(),
          endTime: new Date(now + 4 * 3600 * 1000).toISOString(),
          capacity: 4,
          bookedCount: 3,
          availableSpots: 1,
          priceCents: 1500,
          lat: 37.7749,
          lng: -122.4194,
        },
        {
          id: 'act_bball_02',
          title: '3v3 Half-Court Basketball Pick-up',
          category: 'basketball',
          hostName: 'Jordan Bell',
          venue: 'Mission Rec Center Gym A',
          startTime: new Date(now + 5 * 3600 * 1000).toISOString(),
          endTime: new Date(now + 7 * 3600 * 1000).toISOString(),
          capacity: 6,
          bookedCount: 2,
          availableSpots: 4,
          priceCents: 800,
          lat: 37.7599,
          lng: -122.4148,
        },
        {
          id: 'act_yoga_03',
          title: 'Sunrise Vinyasa Flow & Breathwork',
          category: 'yoga',
          hostName: 'Elena Vance',
          venue: 'Dolores Park Hillside Lawn',
          startTime: new Date(now + 24 * 3600 * 1000).toISOString(),
          endTime: new Date(now + 25.5 * 3600 * 1000).toISOString(),
          capacity: 20,
          bookedCount: 14,
          availableSpots: 6,
          priceCents: 1200,
          lat: 37.7596,
          lng: -122.4269,
        },
        {
          id: 'act_full_04',
          title: 'High-Intensity Futsal Tournament',
          category: 'football',
          hostName: 'Diego Silva',
          venue: 'SOMA Indoor Arena Court 1',
          startTime: new Date(now + 3 * 3600 * 1000).toISOString(),
          endTime: new Date(now + 5 * 3600 * 1000).toISOString(),
          capacity: 10,
          bookedCount: 10,
          availableSpots: 0,
          priceCents: 2000,
          lat: 37.7812,
          lng: -122.4045,
        },
      ];
      setActivities(mockList);
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  useEffect(() => {
    loadData();

    // Listen for conflict rollbacks to notify user and update state
    const unsubscribeConflict = OfflineSyncQueue.getInstance().onConflictRollback((_item, reason) => {
      setNotification({
        title: 'Booking Conflict (409)',
        message: `Your booking could not be completed: ${reason}. Optimistic update rolled back.`,
        type: 'error',
      });
      // Revert booking status
      loadData();
    });

    return () => {
      unsubscribeConflict();
    };
  }, [loadData]);

  const handleCategorySelect = async (category: string) => {
    setSelectedCategory(category);
    // Persist to namespaced mini-app storage
    await sdk.storage.set('pref_category', category);
  };

  const handleBookSession = async (activity: SportsActivity, simulate409: boolean = false) => {
    setBookingInProgressId(activity.id);

    try {
      // 1. Book via repository with offline queue & optimistic UI
      await SportsRepository.bookActivity(
        activity.id,
        activity.title,
        activity.startTime,
        activity.endTime,
        activity.venue,
        simulate409
      );

      // 2. Optimistically update local view
      setActivities((prev) =>
        prev.map((a) =>
          a.id === activity.id
            ? {
                ...a,
                bookedCount: a.bookedCount + 1,
                availableSpots: Math.max(0, a.availableSpots - 1),
                isBookedByCurrentUser: true,
              }
            : a
        )
      );

      if (!simulate409) {
        setNotification({
          title: 'Session Reserved (Pending Sync / Confirmed)',
          message: `Booked "${activity.title}". Cross-mini-app handoff event emitted!`,
          type: 'success',
        });

        // 3. Emit cross-mini-app coordination bridge event!
        sdk.bridge.emit('sports:booking_created', {
          activityId: activity.id,
          title: activity.title,
          category: activity.category,
          startTime: activity.startTime,
          endTime: activity.endTime,
          venue: activity.venue,
          bookedByUserId: user?.id,
        });
      }
    } catch (err) {
      setNotification({
        title: 'Booking Error',
        message: (err as Error).message,
        type: 'error',
      });
    } finally {
      setBookingInProgressId(null);
    }
  };

  // Generate 250 items benchmark if requested
  const displayActivities: readonly SportsActivity[] = benchmarkMode250
    ? Array.from({ length: 250 }).map((_, index) => {
        const base = activities[index % Math.max(1, activities.length)] ?? {
          id: 'act_0',
          title: 'Sports Session',
          category: 'tennis',
          hostName: 'Coach',
          venue: 'Club',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          capacity: 10,
          bookedCount: 2,
          availableSpots: 8,
          priceCents: 1000,
          lat: 37.77,
          lng: -122.41,
        };
        return {
          ...base,
          id: `bench_act_${index}`,
          title: `[#${index + 1}] ${base.title}`,
        };
      })
    : activities.filter(
        (act) => selectedCategory === 'all' || act.category.toLowerCase() === selectedCategory.toLowerCase()
      );

  const categories = ['all', 'tennis', 'basketball', 'yoga', 'football', 'running', 'swimming'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Mini-App Header & Scoped User Profile */}
      <View style={[styles.headerBox, { borderBottomColor: colors.border, padding: spacing.md }]}>
        <View>
          <Text style={[styles.appName, { color: colors.textPrimary, fontSize: typography.sizes.xl }]}>
            Sports & Activities
          </Text>
          <Text style={[styles.userInfo, { color: colors.textMuted, fontSize: typography.sizes.sm }]}>
            {user ? `Logged in as: ${user.firstName} ${user.lastName} (${user.role})` : 'Guest Session'}
          </Text>
        </View>

        {/* Action controls */}
        <View style={styles.debugActionsRow}>
          <Button
            title={benchmarkMode250 ? '250 Items (Active)' : 'Benchmark 250+'}
            onPress={() => setBenchmarkMode250(!benchmarkMode250)}
            variant={benchmarkMode250 ? 'primary' : 'outline'}
            size="sm"
          />
          <Button
            title="Crash Mini-App (Test)"
            onPress={() => setShouldDeliberatelyCrash(true)}
            variant="danger"
            size="sm"
          />
        </View>
      </View>

      {/* Notifications */}
      {notification && (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ToastBanner
            title={notification.title}
            message={notification.message}
            type={notification.type}
            onClose={() => setNotification(null)}
          />
        </View>
      )}

      {/* Filter Categories */}
      <View style={[styles.categoriesRow, { paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              onPress={() => handleCategorySelect(cat)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderRadius: borderRadius.full,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs + 2,
                },
              ]}
            >
              <Text
                style={{
                  color: isSelected ? colors.primaryForeground : colors.textSecondary,
                  fontSize: typography.sizes.sm,
                  fontWeight: isSelected ? typography.weights.semibold : typography.weights.regular,
                  textTransform: 'capitalize',
                }}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Virtualized List of Sports Activities */}
      <VirtualizedList<SportsActivity>
        data={displayActivities}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyTitle="No Activities Found"
        emptyMessage="No sports activities match this category right now."
        renderItem={({ item }) => {
          const isFull = item.availableSpots <= 0;
          const isBooked = item.isBookedByCurrentUser;
          const isBooking = bookingInProgressId === item.id;
          const startTimeFormatted = new Date(item.startTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          const endTimeFormatted = new Date(item.endTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              <Card elevated>
                <View style={styles.cardHeader}>
                  <View style={styles.titleCol}>
                    <Text style={[styles.categoryBadge, { color: colors.primary, fontSize: typography.sizes.xs }]}>
                      {item.category.toUpperCase()}
                    </Text>
                    <Text style={[styles.activityTitle, { color: colors.textPrimary, fontSize: typography.sizes.lg }]}>
                      {item.title}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.priceBadge,
                      {
                        backgroundColor: colors.surfaceHover,
                        borderRadius: borderRadius.md,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                      },
                    ]}
                  >
                    <Text style={[styles.priceText, { color: colors.textPrimary, fontSize: typography.sizes.sm }]}>
                      {item.priceCents === 0 ? 'FREE' : `$${(item.priceCents / 100).toFixed(2)}`}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.venueText, { color: colors.textSecondary, fontSize: typography.sizes.sm, marginTop: 4 }]}>
                  📍 {item.venue}
                </Text>
                <Text style={[styles.timeText, { color: colors.textMuted, fontSize: typography.sizes.xs + 1, marginTop: 2 }]}>
                  🕒 {startTimeFormatted} - {endTimeFormatted} • Host: {item.hostName}
                </Text>

                <View style={[styles.footerRow, { marginTop: spacing.md }]}>
                  <View style={styles.spotsBox}>
                    <Text
                      style={{
                        color: isFull ? colors.danger : colors.success,
                        fontSize: typography.sizes.xs + 1,
                        fontWeight: typography.weights.semibold,
                      }}
                    >
                      {isFull ? '● FULL CAPACITY' : `● ${item.availableSpots} SPOTS LEFT (${item.bookedCount}/${item.capacity})`}
                    </Text>
                  </View>

                  <View style={styles.actionButtonsGroup}>
                    {/* Standard Book Button */}
                    <Button
                      title={isBooked ? 'Reserved ✓' : isFull ? 'Full' : 'Book Session'}
                      onPress={() => handleBookSession(item, false)}
                      disabled={isFull || isBooked}
                      loading={isBooking}
                      size="sm"
                      variant={isBooked ? 'secondary' : 'primary'}
                    />

                    {/* Simulate 409 Conflict Button */}
                    <Button
                      title="Simulate 409 Conflict"
                      onPress={() => handleBookSession(item, true)}
                      variant="outline"
                      size="sm"
                      style={{ borderColor: colors.warning }}
                      textStyle={{ color: colors.warning, fontSize: 11 }}
                    />
                  </View>
                </View>
              </Card>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBox: {
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  appName: {
    fontWeight: '700',
  },
  userInfo: {
    marginTop: 2,
  },
  debugActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryChip: {
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleCol: {
    flex: 1,
    paddingRight: 8,
  },
  categoryBadge: {
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  activityTitle: {
    fontWeight: '700',
  },
  priceBadge: {},
  priceText: {
    fontWeight: '700',
  },
  venueText: {},
  timeText: {},
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  spotsBox: {},
  actionButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
