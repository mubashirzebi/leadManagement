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
} from 'react-native';
import { Colors, STATUS_COLORS } from '../theme/colors';
import client from '../api/client';
import { Lead, Staff } from '../types';
import { useAuth } from '../context/AuthContext';

type LeadViewMode = 'organization' | 'mine' | 'unassigned';

export const LeadListScreen = ({ navigation }: { navigation: any }) => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedTemp, setSelectedTemp] = useState('All');
  const [viewMode, setViewMode] = useState<LeadViewMode>('organization');
  const [team, setTeam] = useState<Staff[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLead, setAssignLead] = useState<Lead | null>(null);
  const [unassignedCount, setUnassignedCount] = useState(0);

  const statuses = ['All', 'NEW', 'CALLBACK', 'INTERESTED', 'VISIT_BOOKED', 'RE_VISIT', 'BOOKED', 'NOT_INTERESTED', 'INVALID_NUMBER'];
  const heats = ['All', 'HOT', 'WARM', 'COLD'];
  const canUseManagerViews = user?.role === 'superadmin' || user?.role === 'admin';
  const canAssignLeads = canUseManagerViews;

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
      const statusParam = selectedStatus === 'All' ? '' : selectedStatus;
      const heatParam = selectedTemp === 'All' ? '' : selectedTemp;
      const params = [
        `search=${encodeURIComponent(search)}`,
        `status=${encodeURIComponent(statusParam)}`,
        `heat=${encodeURIComponent(heatParam)}`,
      ];

      if (canUseManagerViews && viewMode === 'mine' && user?.id) {
        params.push(`assigned_to=${encodeURIComponent(user.id)}`);
      }
      if (viewMode === 'unassigned') {
        params.push('assigned_to=null');
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
  }, [navigation, search, selectedStatus, selectedTemp, viewMode, user?.id, user?.role]);

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
      // Fallback if API ever returns a raw id
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
          ]}>{item.status}</Text>
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
      <View style={styles.header}>
        <Text style={styles.title}>{canUseManagerViews && viewMode === 'mine' ? 'My Leads' : user?.role === 'staff' ? 'My Leads' : 'All Leads'}</Text>
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
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterBar}
          contentContainerStyle={styles.filterContent}
        >
          {statuses.map((s) => (
            <TouchableOpacity 
              key={s} 
              onPress={() => setSelectedStatus(s)}
              style={[
                styles.filterChip,
                selectedStatus === s && styles.activeFilterChip
              ]}
            >
              <Text style={[
                styles.filterText,
                selectedStatus === s && styles.activeFilterText
              ]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={[styles.filterBar, { marginTop: 12 }]}
          contentContainerStyle={styles.filterContent}
        >
          {heats.map((t) => (
            <TouchableOpacity 
              key={t} 
              onPress={() => setSelectedTemp(t)}
              style={[
                styles.filterChip,
                selectedTemp === t && { backgroundColor: t === 'HOT' ? Colors.error : t === 'WARM' ? Colors.warning : Colors.primary, borderColor: 'transparent' }
              ]}
            >
              <Text style={[
                styles.filterText,
                selectedTemp === t && styles.activeFilterText
              ]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  filterBar: {
    marginTop: 16,
    marginHorizontal: -24,
  },
  filterContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterChip: {
    backgroundColor: Colors.background,
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
