import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  RefreshControl, 
  TouchableOpacity 
} from 'react-native';
import { Colors } from '../theme/colors';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ActivityLog } from '../types';

const StatCard = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <View style={styles.statCard}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export const DashboardScreen = () => {
  const [stats, setStats] = useState({ total: 0, new: 0, callback: 0, interested: 0, visit_booked: 0, visited: 0, re_visit: 0, visits_today: 0, booked: 0, not_interested: 0, invalid_number: 0 });
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, activitiesRes] = await Promise.all([
        client.get('/leads/stats'),
        client.get('/leads/activities')
      ]);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (activitiesRes.data.success) setActivities(activitiesRes.data.data);
    } catch (err: any) {
      setError('Unable to connect to server. Please check your internet connection.');
      console.log('[Dashboard] Fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={Colors.primary} />
      }
    >
      {error && !loading && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={fetchData} style={styles.retrySmall}>
            <Text style={styles.retrySmallTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Hello, {user?.name}</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.row}>
          <StatCard label="Total Leads" value={stats.total} color={Colors.primary} />
          <StatCard label="New" value={stats.new} color={Colors.secondary} />
        </View>
        <View style={[styles.row, { marginTop: -8 }]}>
          <StatCard label={"Today's Visits"} value={stats.visits_today} color="#06b6d4" />
          <View style={{ width: '47%' }} />
        </View>
        <View style={styles.pipelineSection}>
          <Text style={styles.pipelineTitle}>Pipeline Status</Text>
          <View style={styles.pipelineRow}>
            <View style={[styles.pipelineStat, { borderLeftColor: '#3b82f6' }]}>
              <Text style={[styles.pipelineValue, { color: '#3b82f6' }]}>{stats.callback}</Text>
              <Text style={styles.pipelineLabel}>Callback</Text>
            </View>
            <View style={[styles.pipelineStat, { borderLeftColor: '#10b981' }]}>
              <Text style={[styles.pipelineValue, { color: '#10b981' }]}>{stats.interested}</Text>
              <Text style={styles.pipelineLabel}>Interested</Text>
            </View>
            <View style={[styles.pipelineStat, { borderLeftColor: '#06b6d4' }]}>
              <Text style={[styles.pipelineValue, { color: '#06b6d4' }]}>{stats.visit_booked}</Text>
              <Text style={styles.pipelineLabel}>Visit Booked</Text>
            </View>
            <View style={[styles.pipelineStat, { borderLeftColor: '#0d9488' }]}>
              <Text style={[styles.pipelineValue, { color: '#0d9488' }]}>{stats.visited}</Text>
              <Text style={styles.pipelineLabel}>Visited</Text>
            </View>
          </View>
          <View style={styles.pipelineRow}>
            <View style={[styles.pipelineStat, { borderLeftColor: '#a855f7' }]}>
              <Text style={[styles.pipelineValue, { color: '#a855f7' }]}>{stats.re_visit}</Text>
              <Text style={styles.pipelineLabel}>Re-visit</Text>
            </View>
            <View style={[styles.pipelineStat, { borderLeftColor: Colors.success }]}>
              <Text style={[styles.pipelineValue, { color: Colors.success }]}>{stats.booked}</Text>
              <Text style={styles.pipelineLabel}>Booked</Text>
            </View>
            <View style={[styles.pipelineStat, { borderLeftColor: Colors.error }]}>
              <Text style={[styles.pipelineValue, { color: Colors.error }]}>{stats.not_interested}</Text>
              <Text style={styles.pipelineLabel}>Not Interested</Text>
            </View>
            <View style={[styles.pipelineStat, { borderLeftColor: Colors.textSecondary }]}>
              <Text style={[styles.pipelineValue, { color: Colors.textSecondary }]}>{stats.invalid_number}</Text>
              <Text style={styles.pipelineLabel}>Invalid</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityList}>
          {activities.map((act: any) => (
            <View key={act._id} style={styles.activityCard}>
              <Text style={styles.activityUser}>{act.user_id?.name}</Text>
              <Text style={styles.activityContent}>{act.content}</Text>
              <Text style={styles.activityTarget}>Lead: {act.lead_id?.name}</Text>
              <Text style={styles.activityTime}>{new Date(act.created_at).toLocaleTimeString()}</Text>
            </View>
          ))}
          {activities.length === 0 && (
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>No activities recorded yet.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  welcome: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  date: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  logoutText: {
    color: Colors.error,
    fontWeight: '600',
  },
  statsGrid: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: Colors.surface,
    width: '47%',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  pipelineSection: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    marginTop: 4,
  },
  pipelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  pipelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pipelineStat: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 4,
    borderLeftWidth: 3,
    alignItems: 'center',
  },
  pipelineValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  pipelineLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  section: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  activityList: {
    gap: 12,
  },
  activityCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
  },
  activityUser: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  activityContent: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  activityTarget: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  activityTime: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  placeholderCard: {
    backgroundColor: Colors.surface,
    padding: 40,
    borderRadius: 20,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  placeholderText: {
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: Colors.error + '15',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.error + '30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  retrySmall: {
    backgroundColor: Colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retrySmallTxt: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
