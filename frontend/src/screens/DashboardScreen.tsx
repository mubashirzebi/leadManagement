import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, STATUS_COLORS } from '../theme/colors';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { WeekDay, WeekVisitsResponse } from '../types';

/* ─────────────────────────── Types ─────────────────────────── */
interface PerUserStat {
  _id: string;
  name: string;
  role: string;
  mobile: string;
  total_leads: number;
  total_visits: number;
  total_revisited: number;
  NEW: number;
  CALLBACK: number;
  INTERESTED: number;
  VISIT_BOOKED: number;
  VISITED: number;
  RE_VISIT: number;
  BOOKED: number;
  NOT_INTERESTED: number;
  INVALID_NUMBER: number;
}

type TimePeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

const STATUS_ORDER: Array<keyof PerUserStat> = ['NEW','CALLBACK','INTERESTED','VISIT_BOOKED','VISITED','RE_VISIT','BOOKED','NOT_INTERESTED','INVALID_NUMBER'];

const STATUS_LABELS: Record<string, string> = {
  NEW: 'New', CALLBACK: 'Callback', INTERESTED: 'Interested',
  VISIT_BOOKED: 'Visit Booked', VISITED: 'Visited', RE_VISIT: 'Re-Visit',
  BOOKED: 'Booked', NOT_INTERESTED: 'Not Interested', INVALID_NUMBER: 'Invalid',
};

/* ────────────────────────── Helpers ────────────────────────── */
function getPeriodRange(period: TimePeriod): { from: string; to: string } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const from = new Date(to);

  switch (period) {
    case 'weekly':
      from.setDate(to.getDate() - 7);
      break;
    case 'monthly':
      from.setMonth(to.getMonth() - 1);
      break;
    case 'quarterly':
      from.setMonth(to.getMonth() - 3);
      break;
    case 'yearly':
      from.setFullYear(to.getFullYear() - 1);
      break;
    default:
      from.setDate(to.getDate() - 7); // fallback to weekly
  }
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

/* ────────────────────── Stat Card ──────────────────────────── */
const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={styles.statCard}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/* ────────────────────── Main Screen ────────────────────────── */
export const DashboardScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const isManager = user?.role === 'admin' || user?.role === 'superadmin';

  /* ─── Common State ─── */
  const [period, setPeriod] = useState<TimePeriod>('weekly');
  const [customFrom, setCustomFrom] = useState<Date>(new Date(Date.now() - 7 * 86400000));
  const [customTo, setCustomTo] = useState<Date>(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ─── Org-wide Stats (all roles) ─── */
  const [stats, setStats] = useState({
    total: 0, new: 0, callback: 0, interested: 0,
    visit_booked: 0, visited: 0, re_visit_booked: 0,
    revisited: 0, visits_today: 0, total_visited: 0,
    booked: 0, not_interested: 0, invalid_number: 0,
    unassigned_leads: 0,
  });

  /* ─── Per-User Stats (manager only) ─── */
  const [perUser, setPerUser] = useState<PerUserStat[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  /* ─── Week Strip (manager only) ─── */
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [weekTotal, setWeekTotal] = useState(0);
  const [weekStartDay, setWeekStartDay] = useState(1); // Monday
  const [showWeekPicker, setShowWeekPicker] = useState(false);

  /* ─── Get query params (common) ─── */
  const getQueryParams = useCallback(() => {
    if (period === 'custom') {
      const f = new Date(customFrom);
      f.setHours(0, 0, 0, 0);
      const t = new Date(customTo);
      t.setHours(23, 59, 59, 999);
      return `?from=${f.toISOString()}&to=${t.toISOString()}`;
    }
    const { from, to } = getPeriodRange(period);
    return `?from=${from}&to=${to}`;
  }, [period, customFrom, customTo]);

  /* ─── Fetch ─── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = getQueryParams();

      if (isManager) {
        const [statsRes, perUserRes, weekRes] = await Promise.all([
          client.get(`/leads/stats${query}`),
          client.get(`/leads/per-user-stats${query}`),
          client.get(`/leads/week-visits`),
        ]);
        if (statsRes.data.success) setStats(statsRes.data.data);
        if (perUserRes.data.success) setPerUser(perUserRes.data.data);
        if (weekRes.data.success) {
          const w: WeekVisitsResponse = weekRes.data.data;
          setWeekDays(w.days);
          setWeekTotal(w.total);
        }
      } else {
        const statsRes = await client.get(`/leads/stats${query}`);
        if (statsRes.data.success) setStats(statsRes.data.data);
      }
    } catch (err: any) {
      setError('Unable to connect to server. Please check your internet connection.');
      console.log('[Dashboard] Fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [getQueryParams, isManager]);

  /* ─── Week start day change handler ─── */
  const handleWeekStartChange = async (day: number) => {
    setWeekStartDay(day);
    setShowWeekPicker(false);
    try {
      await client.patch('/users/week-start', { week_start_day: day });
      // Re-fetch week visits with new start day
      const weekRes = await client.get('/leads/week-visits');
      if (weekRes.data.success) {
        const w: WeekVisitsResponse = weekRes.data.data;
        setWeekDays(w.days);
        setWeekTotal(w.total);
      }
    } catch (err: any) {
      console.log('[Dashboard] Week start update failed:', err.message);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Toggle user expand ─── */
  const toggleExpand = (userId: string) => {
    setExpandedUserId(prev => (prev === userId ? null : userId));
  };

  /* ─── User Detail Panel ─── */
  const renderUserDetail = (u: PerUserStat) => (
    <View style={styles.userDetailPanel}>
      <View style={styles.userSummaryRow}>
        <View style={styles.userSummaryItem}>
          <Text style={[styles.userSummaryValue, { color: Colors.primary }]}>{u.total_leads}</Text>
          <Text style={styles.userSummaryLabel}>Assigned</Text>
        </View>
        <View style={styles.userSummaryItem}>
          <Text style={[styles.userSummaryValue, { color: STATUS_COLORS.VISITED }]}>{u.total_visits}</Text>
          <Text style={styles.userSummaryLabel}>Visited</Text>
        </View>
        <View style={styles.userSummaryItem}>
          <Text style={[styles.userSummaryValue, { color: STATUS_COLORS.RE_VISIT }]}>{u.total_revisited}</Text>
          <Text style={styles.userSummaryLabel}>Revisited</Text>
        </View>
      </View>
      <View style={styles.statusGridMini}>
        {STATUS_ORDER.map(status => (
          <View key={status} style={[styles.statusChip, { borderLeftColor: STATUS_COLORS[status] }]}>
            <Text style={[styles.statusChipValue, { color: STATUS_COLORS[status] }]}>
              {u[status] ?? 0}
            </Text>
            <Text style={styles.statusChipLabel}>{STATUS_LABELS[status]}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  /* ─── User Row for Manager ─── */
  const renderUserRow = (u: PerUserStat) => {
    const expanded = expandedUserId === u._id;
    return (
      <View key={u._id} style={styles.userCardWrapper}>
        <TouchableOpacity
          style={styles.userCard}
          onPress={() => toggleExpand(u._id)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{u.name}</Text>
            <Text style={styles.userRole}>{u.role === 'admin' ? 'Admin' : u.role === 'superadmin' ? 'Super Admin' : 'Staff'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.userLeads}>{u.total_leads}</Text>
              <Text style={styles.userLeadsLabel}>Assigned</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.userLeads, { color: '#0d9488' }]}>{u.total_visits}</Text>
              <Text style={styles.userLeadsLabel}>Visited</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.userLeads, { color: '#a855f7' }]}>{u.total_revisited}</Text>
              <Text style={styles.userLeadsLabel}>Revisited</Text>
            </View>
            <Text style={{ color: Colors.textSecondary, fontSize: 18, fontWeight: '800' }}>
              {expanded ? '▲' : '▼'}
            </Text>
          </View>
        </TouchableOpacity>
        {expanded && renderUserDetail(u)}
      </View>
    );
  };

  /* ─── Render ─── */
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

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Hello, {user?.name}</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* ─── Time Period Filters ─── */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['weekly','monthly','quarterly','yearly','custom'] as TimePeriod[]).map(p => {
            const active = period === p && !(p === 'custom' && (showFromPicker || showToPicker));
            return (
              <TouchableOpacity
                key={p}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── Custom Date Range Pickers ─── */}
      {period === 'custom' && (
        <View style={styles.customDateRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
            <Text style={styles.dateBtnLabel}>From</Text>
            <Text style={styles.dateBtnValue}>{customFrom.toLocaleDateString()}</Text>
          </TouchableOpacity>
          <Text style={{ color: Colors.textSecondary, fontWeight: '700' }}>→</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowToPicker(true)}>
            <Text style={styles.dateBtnLabel}>To</Text>
            <Text style={styles.dateBtnValue}>{customTo.toLocaleDateString()}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showFromPicker && (
        <DateTimePicker
          value={customFrom}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => { setShowFromPicker(Platform.OS === 'ios'); if (d) setCustomFrom(d); }}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={customTo}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, d) => { setShowToPicker(Platform.OS === 'ios'); if (d) setCustomTo(d); }}
        />
      )}

      {/* ─── Stats Grid ─── */}
      <View style={styles.statsGrid}>
        <View style={styles.row}>
          <StatCard label="Total Leads" value={stats.total} color={Colors.primary} />
          <StatCard label="Visit Booked" value={stats.visit_booked} color="#06b6d4" />
        </View>
        <View style={[styles.row, { marginTop: -8 }]}>
          <StatCard label="Total Visited" value={stats.total_visited} color="#0d9488" />
          <StatCard label="Revisited" value={stats.revisited} color="#a855f7" />
        </View>

        {/* ─── Week Strip (Manager only) ─── */}
        {isManager && weekDays.length > 0 && (
          <View style={styles.weekStrip}>
            <View style={styles.weekStripHeader}>
              <Text style={styles.weekStripTitle}>This Week</Text>
              <View style={styles.weekTotalBadge}>
                <Text style={styles.weekTotalText}>{weekTotal} visit{weekTotal !== 1 ? 's' : ''}</Text>
              </View>
              {user?.role === 'superadmin' && (
                <TouchableOpacity
                  style={styles.weekPickerBtn}
                  onPress={() => setShowWeekPicker(!showWeekPicker)}
                >
                  <Text style={styles.weekPickerBtnText}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekStartDay]} ▼
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Week start day dropdown (superadmin only) */}
            {showWeekPicker && user?.role === 'superadmin' && (
              <View style={styles.weekPickerDropdown}>
                {[
                  { label: 'Monday', value: 1 },
                  { label: 'Tuesday', value: 2 },
                  { label: 'Wednesday', value: 3 },
                  { label: 'Thursday', value: 4 },
                  { label: 'Friday', value: 5 },
                  { label: 'Saturday', value: 6 },
                  { label: 'Sunday', value: 0 },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.weekPickerOption, weekStartDay === opt.value && styles.weekPickerOptionActive]}
                    onPress={() => handleWeekStartChange(opt.value)}
                  >
                    <Text style={[styles.weekPickerOptionText, weekStartDay === opt.value && styles.weekPickerOptionTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Day cards */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.weekDayRow}>
                {weekDays.map((day, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.weekDayCard,
                      day.is_today && styles.weekDayCardToday,
                      day.is_weekend && !day.is_today && styles.weekDayCardWeekend,
                    ]}
                  >
                    <Text style={[styles.weekDayLabel, day.is_today && styles.weekDayLabelToday]}>
                      {day.label}
                    </Text>
                    <Text style={[styles.weekDayDate, day.is_today && styles.weekDayDateToday]}>
                      {day.date_num}
                    </Text>
                    <Text style={[styles.weekDayMonth, day.is_today && styles.weekDayMonthToday]}>
                      {day.month_short}
                    </Text>
                    <View style={[
                      styles.weekDayBadge,
                      day.count > 0 && styles.weekDayBadgeActive,
                      day.is_today && day.count > 0 && styles.weekDayBadgeToday,
                    ]}>
                      <Text style={[
                        styles.weekDayBadgeText,
                        day.count > 0 && styles.weekDayBadgeTextActive,
                        day.is_today && day.count > 0 && styles.weekDayBadgeTextToday,
                      ]}>
                        {day.count}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ─── Pipeline Section ─── */}
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
            <View style={[styles.pipelineStat, { borderLeftColor: '#0d9488' }]}>
              <Text style={[styles.pipelineValue, { color: '#0d9488' }]}>{stats.visited}</Text>
              <Text style={styles.pipelineLabel}>Visited</Text>
            </View>
            <View style={[styles.pipelineStat, { borderLeftColor: Colors.success }]}>
              <Text style={[styles.pipelineValue, { color: Colors.success }]}>{stats.booked}</Text>
              <Text style={styles.pipelineLabel}>Booked</Text>
            </View>
          </View>
          <View style={styles.pipelineRow}>
            <View style={[styles.pipelineStat, { borderLeftColor: '#a855f7' }]}>
              <Text style={[styles.pipelineValue, { color: '#a855f7' }]}>{stats.re_visit_booked}</Text>
              <Text style={styles.pipelineLabel}>Re-Visit Booked</Text>
            </View>
            <View style={[styles.pipelineStat, { borderLeftColor: Colors.error }]}>
              <Text style={[styles.pipelineValue, { color: Colors.error }]}>{stats.not_interested}</Text>
              <Text style={styles.pipelineLabel}>Not Interested</Text>
            </View>
            <View style={[styles.pipelineStat, { borderLeftColor: Colors.textSecondary }]}>
              <Text style={[styles.pipelineValue, { color: Colors.textSecondary }]}>{stats.invalid_number}</Text>
              <Text style={styles.pipelineLabel}>Invalid</Text>
            </View>
            <View style={[styles.pipelineStat, { borderLeftColor: '#06b6d4' }]}>
              <Text style={[styles.pipelineValue, { color: '#06b6d4' }]}>{stats.visits_today}</Text>
              <Text style={styles.pipelineLabel}>Today's Visits</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ─── Projects Button ─── */}
      <TouchableOpacity
        style={styles.manageBtn}
        onPress={() => navigation.navigate('ProjectManagement')}
      >
        <Text style={styles.manageBtnText}>
          {isManager ? '🏗️ Manage Projects' : '🏗️ Project Catalog'}
        </Text>
      </TouchableOpacity>

      {/* ─── Per-User Breakdown (Manager only) ─── */}
      {isManager && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Performance</Text>
          {loading && perUser.length === 0 ? null : perUser.map(renderUserRow)}
          {!loading && perUser.length === 0 && (
            <View style={styles.placeholderCard}>
              <Text style={styles.placeholderText}>No team members with leads in this period.</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

/* ─────────────────────── Styles ─────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 24, paddingTop: 60,
  },
  welcome: { fontSize: 24, fontWeight: '800', color: Colors.text },
  date: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },

  /* Filters */
  filterRow: { paddingHorizontal: 20, marginBottom: 8 },
  filterScroll: { gap: 8 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  filterChipTextActive: { color: Colors.text },

  /* Custom date */
  customDateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, marginBottom: 12, paddingHorizontal: 20,
  },
  dateBtn: {
    backgroundColor: Colors.surface, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', minWidth: 110,
  },
  dateBtnLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  dateBtnValue: { color: Colors.text, fontSize: 14, fontWeight: '800', marginTop: 2 },

  /* Stats */
  statsGrid: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statCard: {
    backgroundColor: Colors.surface, width: '47%', padding: 20,
    borderRadius: 20, alignItems: 'center',
  },
  statValue: { fontSize: 32, fontWeight: '800', marginBottom: 4 },
  statLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },

  /* Unassigned badge */
  unassignedBadgeRow: {
    marginHorizontal: 16, marginBottom: 8,
  },
  unassignedBadge: {
    backgroundColor: Colors.warning + '20',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: Colors.warning + '40',
    alignItems: 'center',
  },
  unassignedBadgeText: {
    color: Colors.warning, fontSize: 13, fontWeight: '700',
  },

  /* Pipeline */
  pipelineSection: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 16, marginTop: 4,
  },
  pipelineTitle: {
    fontSize: 14, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5,
  },
  pipelineRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  pipelineStat: {
    flex: 1, backgroundColor: Colors.background, borderRadius: 12,
    padding: 10, marginHorizontal: 4, borderLeftWidth: 3, alignItems: 'center',
  },
  pipelineValue: { fontSize: 20, fontWeight: '800' },
  pipelineLabel: {
    fontSize: 10, color: Colors.textSecondary, fontWeight: '600',
    marginTop: 2, textTransform: 'uppercase',
  },

  /* Manage button */
  section: { padding: 24 },
  myPerfSection: { padding: 24, paddingTop: 0 },
  myPerfCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  manageBtn: {
    backgroundColor: Colors.surface, marginHorizontal: 24, marginTop: 16,
    padding: 18, borderRadius: 14, borderWidth: 1, borderColor: Colors.primary,
    alignItems: 'center',
  },
  manageBtnText: { color: Colors.primary, fontSize: 16, fontWeight: '700' },

  /* User cards (manager) */
  userCardWrapper: { marginBottom: 10 },
  userCard: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  userName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  userRole: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 2 },
  userLeads: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  userLeadsLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },

  /* User detail panel */
  userDetailPanel: {
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
    padding: 16, borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
  },
  userSummaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  userSummaryItem: { alignItems: 'center' },
  userSummaryValue: { fontSize: 22, fontWeight: '800', color: Colors.text },
  userSummaryLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },

  /* Status grid mini */
  statusGridMini: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    backgroundColor: Colors.background, borderRadius: 12, padding: 12,
  },
  statusChip: {
    width: '31%', backgroundColor: Colors.surface, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 6, borderLeftWidth: 3, alignItems: 'center',
  },
  statusChipValue: { fontSize: 16, fontWeight: '800' },
  statusChipLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', marginTop: 1 },

  /* Placeholder */
  placeholderCard: {
    backgroundColor: Colors.surface, padding: 40, borderRadius: 20,
    borderStyle: 'dashed', borderWidth: 2, borderColor: Colors.border, alignItems: 'center',
  },
  placeholderText: { color: Colors.textSecondary, textAlign: 'center' },

  /* Error */
  errorBanner: {
    backgroundColor: Colors.error + '15', margin: 16, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.error + '30',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  errorText: { color: Colors.error, fontSize: 13, fontWeight: '600', flex: 1, marginRight: 12 },
  retrySmall: {
    backgroundColor: Colors.error, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  retrySmallTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  /* ─── Week Strip ─── */
  weekStrip: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 16,
    marginTop: 4, marginHorizontal: 0,
  },
  weekStripHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
    justifyContent: 'space-between',
  },
  weekStripTitle: {
    fontSize: 14, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  weekTotalBadge: {
    backgroundColor: Colors.primary + '18', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 4, marginLeft: 8,
  },
  weekTotalText: {
    color: Colors.primary, fontSize: 13, fontWeight: '700',
  },
  weekPickerBtn: {
    backgroundColor: Colors.background, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, marginLeft: 'auto',
  },
  weekPickerBtnText: {
    color: Colors.text, fontSize: 13, fontWeight: '700',
  },
  weekPickerDropdown: {
    backgroundColor: Colors.background, borderRadius: 12, padding: 8,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  weekPickerOption: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8,
    marginBottom: 2,
  },
  weekPickerOptionActive: {
    backgroundColor: Colors.primary + '20',
  },
  weekPickerOptionText: {
    color: Colors.textSecondary, fontSize: 14, fontWeight: '600',
  },
  weekPickerOptionTextActive: {
    color: Colors.primary, fontWeight: '700',
  },
  weekDayRow: {
    flexDirection: 'row', gap: 8,
  },
  weekDayCard: {
    width: 62, backgroundColor: Colors.background, borderRadius: 14,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'transparent',
  },
  weekDayCardToday: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  weekDayCardWeekend: {
    borderColor: '#f59e0b40', backgroundColor: '#f59e0b08',
  },
  weekDayLabel: {
    fontSize: 10, color: Colors.textSecondary, fontWeight: '700',
    textTransform: 'uppercase',
  },
  weekDayLabelToday: {
    color: '#fff',
  },
  weekDayDate: {
    fontSize: 20, fontWeight: '800', color: Colors.text, marginTop: 2,
  },
  weekDayDateToday: {
    color: '#fff',
  },
  weekDayMonth: {
    fontSize: 10, color: Colors.textSecondary, fontWeight: '600',
  },
  weekDayMonthToday: {
    color: 'rgba(255,255,255,0.8)',
  },
  weekDayBadge: {
    marginTop: 6, width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center',
  },
  weekDayBadgeActive: {
    backgroundColor: Colors.primary + '20',
  },
  weekDayBadgeToday: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  weekDayBadgeText: {
    fontSize: 12, fontWeight: '800', color: Colors.textSecondary,
  },
  weekDayBadgeTextActive: {
    color: Colors.primary,
  },
  weekDayBadgeTextToday: {
    color: '#fff',
  },
});
