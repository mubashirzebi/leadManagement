import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  RefreshControl,
  ScrollView,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, STATUS_COLORS } from '../theme/colors';
import client from '../api/client';
import { Lead, Staff } from '../types';
import { useAuth } from '../context/AuthContext';
import { MultiProjectPickerModal } from '../components/MultiProjectPickerModal';
import { MultiStaffPickerModal } from '../components/MultiStaffPickerModal';
import { formatStatusLabel } from '../utils/statusUtils';

type LeadViewMode = 'organization' | 'mine' | 'unassigned';
type TimePeriod = 'all' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

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
      from.setDate(to.getDate() - 7);
  }
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

const TIME_PERIODS: TimePeriod[] = ['weekly', 'monthly', 'quarterly', 'yearly', 'custom'];
const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  all: 'All Time',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  custom: 'Custom',
};

export const LeadListScreen = ({ navigation }: { navigation: any }) => {
  const { user } = useAuth();

  // ─── Live (applied) filter state ───
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedTemp, setSelectedTemp] = useState('All');
  const [viewMode, setViewMode] = useState<LeadViewMode>('organization');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedProjectNames, setSelectedProjectNames] = useState<string[]>([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [selectedAssigneeNames, setSelectedAssigneeNames] = useState<string[]>([]);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [customFrom, setCustomFrom] = useState<Date>(new Date(Date.now() - 7 * 86400000));
  const [customTo, setCustomTo] = useState<Date>(new Date());

  // ─── Panel UI state ───
  const [filterExpanded, setFilterExpanded] = useState(false);

  // ─── Pending filter state (edits in panel, committed on Apply) ───
  const [pendingStatus, setPendingStatus] = useState('All');
  const [pendingTemp, setPendingTemp] = useState('All');
  const [pendingProjectIds, setPendingProjectIds] = useState<string[]>([]);
  const [pendingProjectNames, setPendingProjectNames] = useState<string[]>([]);
  const [pendingAssigneeIds, setPendingAssigneeIds] = useState<string[]>([]);
  const [pendingAssigneeNames, setPendingAssigneeNames] = useState<string[]>([]);
  const [pendingTimePeriod, setPendingTimePeriod] = useState<TimePeriod>('all');
  const [pendingCustomFrom, setPendingCustomFrom] = useState<Date>(new Date(Date.now() - 7 * 86400000));
  const [pendingCustomTo, setPendingCustomTo] = useState<Date>(new Date());

  // ─── Modals ───
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  // ─── Assign lead modal ───
  const [team, setTeam] = useState<Staff[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLead, setAssignLead] = useState<Lead | null>(null);
  const [unassignedCount, setUnassignedCount] = useState(0);

  const statuses = ['All', 'NEW', 'CALLBACK', 'INTERESTED', 'VISIT_BOOKED', 'RE_VISIT', 'BOOKED', 'NOT_INTERESTED', 'INVALID_NUMBER'];
  const heats = ['All', 'HOT', 'WARM', 'COLD'];
  const canUseManagerViews = user?.role === 'superadmin' || user?.role === 'admin';
  const canAssignLeads = canUseManagerViews;

  // ─── Active count from LIVE state ───
  const activeFilterCount = [
    selectedStatus !== 'All' ? 1 : 0,
    selectedTemp !== 'All' ? 1 : 0,
    selectedProjectIds.length > 0 ? 1 : 0,
    selectedAssigneeIds.length > 0 ? 1 : 0,
    timePeriod !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // ─── Sync live → pending when panel opens ───
  const openFilterPanel = () => {
    setPendingStatus(selectedStatus);
    setPendingTemp(selectedTemp);
    setPendingProjectIds([...selectedProjectIds]);
    setPendingProjectNames([...selectedProjectNames]);
    setPendingAssigneeIds([...selectedAssigneeIds]);
    setPendingAssigneeNames([...selectedAssigneeNames]);
    setPendingTimePeriod(timePeriod);
    setPendingCustomFrom(new Date(customFrom));
    setPendingCustomTo(new Date(customTo));
    setFilterExpanded(true);
  };

  // ─── Apply pending → live ───
  const applyFilters = () => {
    setSelectedStatus(pendingStatus);
    setSelectedTemp(pendingTemp);
    setSelectedProjectIds([...pendingProjectIds]);
    setSelectedProjectNames([...pendingProjectNames]);
    setSelectedAssigneeIds([...pendingAssigneeIds]);
    setSelectedAssigneeNames([...pendingAssigneeNames]);
    setTimePeriod(pendingTimePeriod);
    setCustomFrom(pendingCustomFrom);
    setCustomTo(pendingCustomTo);
    setFilterExpanded(false);
  };

  // ─── Clear all ───
  const clearAllFilters = () => {
    setPendingStatus('All');
    setPendingTemp('All');
    setPendingProjectIds([]);
    setPendingProjectNames([]);
    setPendingAssigneeIds([]);
    setPendingAssigneeNames([]);
    setPendingTimePeriod('all');
  };

  const clearAllAndApply = () => {
    clearAllFilters();
    // Apply immediately
    setSelectedStatus('All');
    setSelectedTemp('All');
    setSelectedProjectIds([]);
    setSelectedProjectNames([]);
    setSelectedAssigneeIds([]);
    setSelectedAssigneeNames([]);
    setTimePeriod('all');
    setFilterExpanded(false);
  };

  const fetchTeam = async () => {
    if (!canAssignLeads) return;
    try {
      const res = await client.get('/users');
      if (res.data.success) setTeam(res.data.data);
    } catch (e) {
      console.log('Fetch team failed', e);
    }
  };

  const fetchUnassignedCount = async () => {
    if (!canUseManagerViews) return;
    try {
      const res = await client.get('/leads/stats');
      if (res.data.success) {
        setUnassignedCount(res.data.data.unassigned_leads ?? 0);
      }
    } catch (e) {
      console.log('Fetch unassigned count failed', e);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = [
        `search=${encodeURIComponent(search)}`,
      ];

      if (selectedStatus !== 'All') {
        params.push(`status=${encodeURIComponent(selectedStatus)}`);
      }
      if (selectedTemp !== 'All') {
        params.push(`heat=${encodeURIComponent(selectedTemp)}`);
      }
      if (selectedProjectIds.length > 0) {
        params.push(`project_ids=${encodeURIComponent(selectedProjectIds.join(','))}`);
      }
      if (canUseManagerViews && viewMode === 'mine' && user?.id) {
        params.push(`assigned_to=${encodeURIComponent(user.id)}`);
      } else if (viewMode === 'unassigned') {
        params.push('assigned_to=null');
      } else if (selectedAssigneeIds.length > 0) {
        params.push(`assigned_to_ids=${encodeURIComponent(selectedAssigneeIds.join(','))}`);
      }
      if (timePeriod !== 'all') {
        if (timePeriod === 'custom') {
          const f = new Date(customFrom); f.setHours(0, 0, 0, 0);
          const t = new Date(customTo); t.setHours(23, 59, 59, 999);
          params.push(`from=${encodeURIComponent(f.toISOString())}`);
          params.push(`to=${encodeURIComponent(t.toISOString())}`);
        } else {
          const { from, to } = getPeriodRange(timePeriod);
          params.push(`from=${encodeURIComponent(from)}`);
          params.push(`to=${encodeURIComponent(to)}`);
        }
      }

      const response = await client.get(`/leads?${params.join('&')}`);
      if (response.data.success) {
        setLeads(response.data.data);
      }
    } catch (error) {
      console.error('Fetch leads failed', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchTeam();
    fetchUnassignedCount();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchLeads();
      fetchTeam();
      fetchUnassignedCount();
    });
    return unsubscribe;
  }, [navigation, search, selectedStatus, selectedTemp, viewMode, user?.id, user?.role, selectedProjectIds, selectedAssigneeIds, timePeriod]);

  useEffect(() => {
    if (timePeriod !== 'all') fetchLeads();
  }, [customFrom, customTo]);

  const openAssign = (lead: Lead) => {
    setAssignLead(lead);
    setAssignOpen(true);
  };

  const closeAssign = () => {
    setAssignOpen(false);
    setAssignLead(null);
  };

  const assignTargets = React.useMemo(() => {
    if (!canAssignLeads) return [];
    const targets: any[] = [{ _id: 'null', name: 'Unassigned' }];
    for (const member of team as any[]) targets.push(member);
    if (user?.id && !targets.some((t) => t._id === user.id)) {
      targets.push({ _id: user.id, name: `${user.name} (Me)` });
    }
    const seen = new Set<string>();
    return targets.filter((t) => {
      const id = String(t._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [team, user?.id, user?.name, canAssignLeads]);

  const doAssign = async (targetId: string) => {
    if (!assignLead) return;
    try {
      await client.patch(`/leads/${assignLead._id}`, { assigned_to: targetId === 'null' ? null : targetId });
      closeAssign();
      fetchLeads();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to assign lead');
    }
  };

  const getAssigneeLabel = (lead: Lead) => {
    const assignee: any = (lead as any).assigned_to;
    if (!assignee) return 'Unassigned';
    if (typeof assignee === 'string') {
      const match = (team as any[]).find((m) => m._id === assignee);
      return match?.name ? `Assigned: ${match.name}` : 'Assigned';
    }
    const name = assignee?.name;
    return name ? `Assigned: ${name}` : 'Assigned';
  };

  const renderLeadItem = ({ item }: { item: Lead }) => (
    <TouchableOpacity 
      style={styles.leadCard}
      onPress={() => navigation.navigate('LeadDetail', { lead: item })}
    >
      <View style={styles.leadInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={styles.leadName}>{item.name}</Text>
          {item.duplicateFlag && (
            <View style={styles.duplicateBadge}>
              <Text style={styles.duplicateBadgeText}>DUPLICATE</Text>
            </View>
          )}
        </View>
        <Text style={styles.leadMobile}>{item.mobile}</Text>
        {canAssignLeads && (
          <Text style={styles.assigneeText}>{getAssigneeLabel(item)}</Text>
        )}
        {item.project ? <Text style={styles.leadProject}>{item.project}</Text> : null}
        {['INTERESTED', 'VISIT_BOOKED', 'VISITED', 'RE_VISIT', 'BOOKED'].includes(item.status) && (item.property_type || item.budget) ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            {item.property_type ? <Text style={styles.leadChip}>{item.property_type}</Text> : null}
            {item.budget ? <Text style={styles.leadChip}>{item.budget}</Text> : null}
          </View>
        ) : null}
        {item.status === 'VISITED' && item.visit_count ? (
          <Text style={[styles.leadChip, { color: '#0d9488', backgroundColor: '#0d948815', marginTop: 4 }]}>🔍 Visited ({item.visit_count})</Text>
        ) : null}
        {(item.status === 'VISIT_BOOKED' || item.status === 'RE_VISIT') && item.site_visit_at ? (
          <Text style={[styles.leadVisitDate, { color: item.status === 'RE_VISIT' ? '#a855f7' : '#06b6d4' }]}>
            📅 {new Date(item.site_visit_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
        ) : null}
      </View>
      <View style={styles.rightCol}>
        <View style={[
          styles.statusBadge,
          {
            borderColor: STATUS_COLORS[item.status] || Colors.border,
            backgroundColor: (STATUS_COLORS[item.status] || Colors.primary) + '18',
          },
        ]}>
          <Text style={[
            styles.statusText,
            { color: STATUS_COLORS[item.status] || Colors.textSecondary },
          ]}>{formatStatusLabel(item.status)}</Text>
        </View>
        {canAssignLeads && (
          <TouchableOpacity style={styles.assignBtn} onPress={() => openAssign(item)}>
            <Text style={styles.assignBtnTxt}>👤</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* ─── Assign Lead Modal ─── */}
      <Modal visible={assignOpen} transparent animationType="fade" onRequestClose={closeAssign}>
        <View style={styles.assignBackdrop}>
          <View style={styles.assignCard}>
            <Text style={styles.assignTitle}>Assign Lead</Text>
            <Text style={styles.assignSubtitle}>{assignLead?.name ?? ''}</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {assignTargets.map((t: any) => (
                <TouchableOpacity key={t._id} style={styles.assignRow} onPress={() => doAssign(String(t._id))}>
                  <Text style={styles.assignRowTxt}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.assignClose} onPress={closeAssign}>
              <Text style={styles.assignCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Multi-Project Picker Modal ─── */}
      <MultiProjectPickerModal
        visible={projectPickerOpen}
        onClose={() => setProjectPickerOpen(false)}
        onConfirm={(ids, names) => {
          setPendingProjectIds(ids);
          setPendingProjectNames(names);
        }}
        selectedProjectIds={pendingProjectIds}
      />

      {/* ─── Multi-Staff Picker Modal ─── */}
      <MultiStaffPickerModal
        visible={assigneePickerOpen}
        onClose={() => setAssigneePickerOpen(false)}
        onConfirm={(ids, names) => {
          setPendingAssigneeIds(ids);
          setPendingAssigneeNames(names);
        }}
        selectedAssigneeIds={pendingAssigneeIds}
      />

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {canUseManagerViews && viewMode === 'mine' ? 'My Leads' : user?.role === 'staff' ? 'My Leads' : 'All Leads'}
        </Text>
        {canUseManagerViews && (
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              onPress={() => setViewMode('organization')}
              style={[
                styles.segmentButton,
                viewMode === 'organization' && styles.segmentButtonActive
              ]}
            >
              <Text style={[
                styles.segmentText,
                viewMode === 'organization' && styles.segmentTextActive
              ]}>Organization Leads</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('mine')}
              style={[
                styles.segmentButton,
                viewMode === 'mine' && styles.segmentButtonActive
              ]}
            >
              <Text style={[
                styles.segmentText,
                viewMode === 'mine' && styles.segmentTextActive
              ]}>My Leads</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setViewMode('unassigned')}
              style={[
                styles.segmentButton,
                viewMode === 'unassigned' && styles.segmentButtonActive,
                unassignedCount > 0 && styles.segmentButtonAlert,
              ]}
            >
              <Text style={[
                styles.segmentText,
                viewMode === 'unassigned' && styles.segmentTextActive,
                unassignedCount > 0 && styles.segmentTextAlert,
              ]}>Unassigned {unassignedCount > 0 ? `(${unassignedCount})` : ''}</Text>
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          style={styles.searchBar}
          placeholder="Search name or mobile..."
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />

        {/* ─── Filter Toggle Button ─── */}
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => filterExpanded ? setFilterExpanded(false) : openFilterPanel()}
          activeOpacity={0.7}
        >
          <Text style={styles.filterToggleText}>
            🔍 Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
          <Text style={styles.filterToggleChevron}>{filterExpanded ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {/* ─── Collapsible Filter Panel ─── */}
        {filterExpanded && (
          <View style={styles.filterPanel}>
            <ScrollView
              style={styles.filterPanelScroll}
              contentContainerStyle={styles.filterPanelContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Status Row */}
              <Text style={styles.filterRowLabel}>Status</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterChipScroll}
                contentContainerStyle={styles.filterChipContent}
              >
                {statuses.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setPendingStatus(s)}
                    style={[
                      styles.filterChip,
                      pendingStatus === s && styles.activeFilterChip
                    ]}
                  >
                    <Text style={[
                      styles.filterText,
                      pendingStatus === s && styles.activeFilterText
                    ]}>{s === 'All' ? 'All' : formatStatusLabel(s)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Heat Row */}
              <Text style={[styles.filterRowLabel, { marginTop: 14 }]}>Heat</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterChipScroll}
                contentContainerStyle={styles.filterChipContent}
              >
                {heats.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setPendingTemp(t)}
                    style={[
                      styles.filterChip,
                      pendingTemp === t && {
                        backgroundColor: t === 'HOT' ? Colors.error : t === 'WARM' ? Colors.warning : Colors.primary,
                        borderColor: 'transparent'
                      }
                    ]}
                  >
                    <Text style={[
                      styles.filterText,
                      pendingTemp === t && styles.activeFilterText
                    ]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Project Row — Multi-Select */}
              <TouchableOpacity
                style={styles.filterSelectRow}
                onPress={() => setProjectPickerOpen(true)}
              >
                <Text style={styles.filterSelectLabel}>
                  🏗️  Project: {pendingProjectNames.length === 0
                    ? 'All Projects'
                    : pendingProjectNames.length === 1
                      ? pendingProjectNames[0]
                      : `${pendingProjectNames.length} selected`}
                </Text>
                {pendingProjectIds.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => { setPendingProjectIds([]); setPendingProjectNames([]); }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.filterClearInlineBtn}
                  >
                    <Text style={styles.filterClearInlineText}>✕</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.filterSelectChevron}>›</Text>
                )}
              </TouchableOpacity>

              {/* Assignee Row — Multi-Select (managers only) */}
              {canUseManagerViews && (
                <TouchableOpacity
                  style={styles.filterSelectRow}
                  onPress={() => setAssigneePickerOpen(true)}
                >
                  <Text style={styles.filterSelectLabel}>
                    👤  Assignee: {pendingAssigneeNames.length === 0
                      ? 'All Staff'
                      : pendingAssigneeNames.length === 1
                        ? pendingAssigneeNames[0]
                        : `${pendingAssigneeNames.length} selected`}
                  </Text>
                  {pendingAssigneeIds.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => { setPendingAssigneeIds([]); setPendingAssigneeNames([]); }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.filterClearInlineBtn}
                    >
                      <Text style={styles.filterClearInlineText}>✕</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.filterSelectChevron}>›</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Time Period Row — horizontal chip bar matching DashboardScreen */}
              <Text style={[styles.filterRowLabel, { marginTop: 14 }]}>Time</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterChipScroll}
                contentContainerStyle={styles.filterChipContent}
              >
                {TIME_PERIODS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPendingTimePeriod(p)}
                    style={[
                      styles.filterChip,
                      pendingTimePeriod === p && styles.activeFilterChip
                    ]}
                  >
                    <Text style={[
                      styles.filterText,
                      pendingTimePeriod === p && styles.activeFilterText
                    ]}>{TIME_PERIOD_LABELS[p]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Custom Date Pickers */}
              {pendingTimePeriod === 'custom' && (
                <View style={styles.customDateRow}>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowFromPicker(true)}
                  >
                    <Text style={styles.dateButtonLabel}>From</Text>
                    <Text style={styles.dateButtonValue}>
                      {pendingCustomFrom.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.dateSeparator}>→</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowToPicker(true)}
                  >
                    <Text style={styles.dateButtonLabel}>To</Text>
                    <Text style={styles.dateButtonValue}>
                      {pendingCustomTo.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {showFromPicker && (
                <DateTimePicker
                  value={pendingCustomFrom}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={pendingCustomTo}
                  onChange={(_, date) => { setShowFromPicker(Platform.OS === 'ios'); if (date) setPendingCustomFrom(date); }}
                />
              )}
              {showToPicker && (
                <DateTimePicker
                  value={pendingCustomTo}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={pendingCustomFrom}
                  onChange={(_, date) => { setShowToPicker(Platform.OS === 'ios'); if (date) setPendingCustomTo(date); }}
                />
              )}

              {/* Buttons Row */}
              <View style={styles.filterButtonsRow}>
                <TouchableOpacity style={styles.clearAllBtn} onPress={clearAllAndApply}>
                  <Text style={styles.clearAllBtnText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                  <Text style={styles.applyBtnText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </View>

      {loading && leads.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item._id}
          renderItem={renderLeadItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchLeads} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No leads found.</Text>
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('AddLead')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 16,
  },
  searchBar: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: Colors.primary,
  },
  segmentButtonAlert: {
    borderWidth: 1.5,
    borderColor: '#f59e0b',
  },
  segmentText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: Colors.text,
  },
  segmentTextAlert: {
    color: '#f59e0b',
  },
  /* ─── Filter Toggle ─── */
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterToggleText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  filterToggleChevron: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  /* ─── Filter Panel ─── */
  filterPanel: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 400,
    overflow: 'hidden',
  },
  filterPanelScroll: {
    maxHeight: 400,
  },
  filterPanelContent: {
    padding: 16,
  },
  filterRowLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  filterChipScroll: {
    marginBottom: 2,
  },
  filterChipContent: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeFilterChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  activeFilterText: {
    color: Colors.text,
  },
  /* ─── Filter Select Rows ─── */
  filterSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterSelectLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  filterSelectChevron: {
    color: Colors.textSecondary,
    fontSize: 20,
    fontWeight: '600',
  },
  filterClearInlineBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.textSecondary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterClearInlineText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  /* ─── Custom Date Pickers ─── */
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  dateButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  dateButtonLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dateButtonValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  dateSeparator: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  /* ─── Filter Buttons ─── */
  filterButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 12,
  },
  clearAllBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.error + '15',
    borderWidth: 1,
    borderColor: Colors.error + '33',
    alignItems: 'center',
  },
  clearAllBtnText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '800',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  applyBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  /* ─── List ─── */
  list: {
    padding: 16,
  },
  leadCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  leadMobile: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  assigneeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: '700',
  },
  leadChip: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  leadVisitDate: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  leadProject: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    backgroundColor: Colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '400',
    marginTop: -4,
  },
  duplicateBadge: {
    backgroundColor: '#ef444422',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    alignSelf: 'center',
  },
  duplicateBadgeText: {
    color: '#ef4444',
    fontSize: 9,
    fontWeight: '800',
  },
  assignBtn: {
    width: 36,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignBtnTxt: {
    fontSize: 14,
  },
  assignBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  assignCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  assignTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
  },
  assignSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  assignRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginBottom: 8,
  },
  assignRowTxt: {
    color: Colors.text,
    fontWeight: '700',
  },
  assignClose: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  assignCloseTxt: {
    color: Colors.text,
    fontWeight: '800',
  },
});
