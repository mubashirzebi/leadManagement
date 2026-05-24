import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../theme/colors';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Lead, ActivityLog, Staff } from '../types';

export const LeadDetailScreen = ({ route, navigation }: { route: any, navigation: any }) => {
  const [lead, setLead] = React.useState<Lead>(route.params.lead);
  const [logs, setLogs] = React.useState<ActivityLog[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [updating, setUpdating] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'actions' | 'history'>('actions');
  const [remarkDraft, setRemarkDraft] = React.useState('');
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [pendingStatus, setPendingStatus] = React.useState<Lead['status'] | null>(null);
  const [statusRemarkDraft, setStatusRemarkDraft] = React.useState('');
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [remindAt, setRemindAt] = React.useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    return d;
  });
  const [reminderRemark, setReminderRemark] = React.useState('');
  const [nativePickerMode, setNativePickerMode] = React.useState<null | 'date' | 'time'>(null);
  const { user } = useAuth();
  const canAssignLeads = user?.role === 'admin' || user?.role === 'superadmin';

  const fetchStaff = async () => {
    try {
      const response = await client.get('/users');
      if (response.data.success) {
        setStaff(response.data.data);
      }
    } catch (error) {
      console.error('Fetch staff failed', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await client.get(`/leads/${lead._id}/logs`);
      if (response.data.success) {
        setLogs(response.data.data);
      }
    } catch (error) {
      console.error('Fetch logs failed', error);
    }
  };

  React.useEffect(() => {
    fetchLogs();
    if (canAssignLeads) {
      fetchStaff();
    }
  }, [canAssignLeads]);

  const assignableUsers = React.useMemo(() => {
    const users: any[] = [];

    // Always include "Unassigned" for managers
    if (canAssignLeads) {
      users.push({ _id: 'null', name: 'Unassigned', mobile: '' });
    }

    // Add team members returned by API (typically staff/admin in the org)
    for (const member of staff as any[]) {
      users.push(member);
    }

    // Add "Me" for self-assignment
    if (canAssignLeads && user?.id && !users.some((member) => member._id === user.id)) {
      users.push({ _id: user.id, name: `${user.name} (Me)`, mobile: user.mobile });
    }

    // De-dupe by _id while preserving order
    const seen = new Set<string>();
    return users.filter((u) => {
      const id = String(u._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [staff, canAssignLeads, user?.id, user?.name, user?.mobile]);

  const isAssignedTo = (userId: string) => {
    const assigned = lead.assigned_to;
    if (userId === 'null') return assigned === null || assigned === undefined;
    return assigned === userId || assigned?._id === userId;
  };

  const statuses = ['NEW', 'INVALID_NUMBER', 'CALLBACK', 'INTERESTED', 'NOT_INTERESTED'];
  const heats = ['HOT', 'WARM', 'COLD'];

  const handleUpdate = async (updateData: any) => {
    setUpdating(true);
    try {
      const response = await client.patch(`/leads/${lead._id}`, updateData);
      if (response.data.success) {
        setLead(response.data.data);
        fetchLogs(); // Refresh history
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update lead');
    } finally {
      setUpdating(false);
    }
  };

  const openStatusDialog = (status: Lead['status']) => {
    setPendingStatus(status);
    setStatusRemarkDraft('');
    setStatusDialogOpen(true);
  };

  const closeStatusDialog = () => {
    setStatusDialogOpen(false);
    setPendingStatus(null);
    setStatusRemarkDraft('');
  };

  const openReminder = () => {
    const initial = new Date();
    initial.setMinutes(initial.getMinutes() + 60);
    setRemindAt(initial);
    setReminderRemark('');
    setReminderOpen(true);
    setNativePickerMode('date');
  };

  const closeReminder = () => {
    setReminderOpen(false);
    setNativePickerMode(null);
  };

  const saveReminder = async () => {
    setUpdating(true);
    try {
      const response = await client.post('/reminders', {
        lead_id: lead._id,
        remind_at: remindAt,
        remark: reminderRemark.trim() || 'Follow up',
      });
      if (response.data.success) {
        closeReminder();
        fetchLogs();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set reminder');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      scrollEnabled
    >
      <Modal visible={statusDialogOpen} transparent animationType="fade" onRequestClose={closeStatusDialog}>
        <View style={styles.dlgBackdrop}>
          <View style={styles.dlgCard}>
            <Text style={styles.dlgTitle}>Update Status</Text>
            <Text style={styles.dlgSub}>{pendingStatus ?? ''}</Text>
            <TextInput
              value={statusRemarkDraft}
              onChangeText={setStatusRemarkDraft}
              placeholder="Optional remark..."
              placeholderTextColor={Colors.textSecondary}
              style={styles.remarkInput}
              multiline
            />
            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={closeStatusDialog} disabled={updating}>
                <Text style={styles.dlgBtnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dlgBtnPrimary, updating && { opacity: 0.7 }]}
                disabled={updating || !pendingStatus}
                onPress={async () => {
                  const next = pendingStatus;
                  const remark = statusRemarkDraft.trim();
                  closeStatusDialog();
                  await handleUpdate(remark ? { status: next, remark } : { status: next });
                }}
              >
                <Text style={styles.dlgBtnPrimaryTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reminderOpen} transparent animationType="fade" onRequestClose={closeReminder}>
        <View style={styles.dlgBackdrop}>
          <View style={styles.dlgCard}>
            <Text style={styles.dlgTitle}>Schedule Follow-up</Text>
            <Text style={styles.dlgSub}>{remindAt.toLocaleString()}</Text>

            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={() => setNativePickerMode('date')} disabled={updating}>
                <Text style={styles.dlgBtnGhostTxt}>Pick Date</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={() => setNativePickerMode('time')} disabled={updating}>
                <Text style={styles.dlgBtnGhostTxt}>Pick Time</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              value={reminderRemark}
              onChangeText={setReminderRemark}
              placeholder="Optional note..."
              placeholderTextColor={Colors.textSecondary}
              style={[styles.remarkInput, { marginTop: 12, minHeight: 80 }]}
              multiline
            />

            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={closeReminder} disabled={updating}>
                <Text style={styles.dlgBtnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dlgBtnPrimary, updating && { opacity: 0.7 }]} disabled={updating} onPress={saveReminder}>
                <Text style={styles.dlgBtnPrimaryTxt}>Save</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {nativePickerMode ? (
        <DateTimePicker
          value={remindAt}
          mode={nativePickerMode}
          display="default"
          is24Hour={false}
          onChange={(_, selected) => {
            setNativePickerMode(null);
            if (!selected) return;
            if (nativePickerMode === 'date') {
              const next = new Date(remindAt);
              next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
              setRemindAt(next);
              setTimeout(() => setNativePickerMode('time'), 0);
            } else {
              const next = new Date(remindAt);
              next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
              setRemindAt(next);
            }
          }}
        />
      ) : null}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Lead Details</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{lead.name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Mobile</Text>
          <Text style={styles.value}>{lead.mobile}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{lead.status}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Heat</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{lead.heat}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Duplicate Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: lead.duplicateFlag ? Colors.error : Colors.border }]}>
            <Text style={styles.statusText}>{lead.duplicateFlag ? 'Duplicate' : 'Original / Unique'}</Text>
          </View>
        </View>

        {lead.project ? (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Project</Text>
            <Text style={styles.value}>{lead.project}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Text style={styles.label}>Source</Text>
          <Text style={styles.value}>{lead.source}</Text>
        </View>

        {lead.facebook_page_name ? (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Source Page</Text>
            <Text style={styles.value}>{lead.facebook_page_name}</Text>
          </View>
        ) : null}

        {lead.facebook_form_name ? (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Source Form</Text>
            <Text style={styles.value}>{lead.facebook_form_name}</Text>
          </View>
        ) : null}

        {lead.custom_data && Object.keys(lead.custom_data).length > 0 && (
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border }}>
            <Text style={[styles.sectionTitle, { marginBottom: 16, fontSize: 14, color: Colors.textSecondary }]}>
              Form Answers
            </Text>
            {Object.entries(lead.custom_data).map(([key, val]) => {
              // Hide redundant standard fields since they are already displayed
              if (['full_name', 'name', 'phone_number', 'phone', 'email', 'city', 'FIRST_NAME', 'PHONE_NUMBER', 'USER_EMAIL'].includes(key)) return null;
              
              // Prettify the key (Title Casing and replacing underscores/hyphens)
              const prettifiedKey = key
                .replace(/[_-]/g, ' ')
                .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase())
                .replace(/\bId\b/g, 'ID')
                .replace(/\bEmail\b/g, 'Email');

              return (
                <View key={key} style={styles.infoRow}>
                  <Text style={styles.label}>{prettifiedKey}</Text>
                  <Text style={styles.value}>{String(val)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setActiveTab('actions')} style={[styles.tabBtn, activeTab === 'actions' && styles.tabBtnActive]}>
          <Text style={[styles.tabTxt, activeTab === 'actions' && styles.tabTxtActive]}>Actions</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('history')} style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}>
          <Text style={[styles.tabTxt, activeTab === 'history' && styles.tabTxtActive]}>History</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'actions' && (
      <View style={styles.actionSection}>
        <Text style={styles.sectionTitle}>Update Status</Text>
        <View style={styles.statusGrid}>
          {statuses.map((s) => (
            <TouchableOpacity 
              key={s}
              onPress={() => openStatusDialog(s as Lead['status'])}
              disabled={updating}
              style={[
                styles.statusButton, 
                lead.status === s && styles.activeStatusButton
              ]}
            >
              <Text style={[
                styles.statusButtonText,
                lead.status === s && styles.activeStatusButtonText
              ]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Set Heat</Text>
        <View style={styles.statusGrid}>
          {heats.map((t) => (
            <TouchableOpacity 
              key={t}
              onPress={() => handleUpdate({ heat: t })}
              disabled={updating}
              style={[
                styles.statusButton, 
                lead.heat === t && { 
                  backgroundColor: t === 'HOT' ? Colors.error : t === 'WARM' ? Colors.warning : Colors.primary,
                  borderColor: 'transparent'
                }
              ]}
            >
              <Text style={[
                styles.statusButtonText,
                lead.heat === t && styles.activeStatusButtonText
              ]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {lead.status === 'INTERESTED' && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Site Visit</Text>
            <View style={styles.statusGrid}>
              <TouchableOpacity
                onPress={() => handleUpdate({ site_visit_booked: !lead.site_visit_booked })}
                disabled={updating}
                style={[
                  styles.statusButton,
                  lead.site_visit_booked && { backgroundColor: Colors.success, borderColor: 'transparent' }
                ]}
              >
                <Text style={[
                  styles.statusButtonText,
                  lead.site_visit_booked && styles.activeStatusButtonText
                ]}>
                  {lead.site_visit_booked ? 'Site Visit Booked' : 'Book Site Visit'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        
        {updating && <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />}
      </View>
      )}

      <View style={[styles.actionSection, { marginTop: -20 }]}>
        <Text style={styles.sectionTitle}>Follow-up Reminders</Text>
        <View style={styles.statusGrid}>
          <TouchableOpacity onPress={openReminder} style={styles.statusButton} disabled={updating}>
            <Text style={styles.statusButtonText}>Pick Date & Time</Text>
          </TouchableOpacity>
        </View>
      </View>

      {canAssignLeads && (
        <View style={[styles.actionSection, { marginTop: -20 }]}>
          <Text style={styles.sectionTitle}>Assign Lead</Text>
          <View style={styles.statusGrid}>
            {assignableUsers.map((s: any) => (
              <TouchableOpacity 
                key={s._id} 
                onPress={() => handleUpdate({ assigned_to: s._id === 'null' ? null : s._id })}
                disabled={updating}
                style={[
                  styles.statusButton,
                  isAssignedTo(s._id) && styles.activeStatusButton
                ]}
              >
                <Text style={[
                  styles.statusButtonText,
                  isAssignedTo(s._id) && styles.activeStatusButtonText
                ]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <View style={[styles.actionSection, { marginTop: -20 }]}>
          <Text style={styles.sectionTitle}>Duplicate Management</Text>
          <View style={styles.statusGrid}>
            <TouchableOpacity 
              onPress={() => handleUpdate({ duplicateFlag: true })}
              disabled={updating}
              style={[
                styles.statusButton,
                lead.duplicateFlag && { backgroundColor: Colors.error, borderColor: 'transparent' }
              ]}
            >
              <Text style={[
                styles.statusButtonText,
                lead.duplicateFlag && styles.activeStatusButtonText
              ]}>Mark as Duplicate</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleUpdate({ duplicateFlag: false })}
              disabled={updating}
              style={[
                styles.statusButton,
                !lead.duplicateFlag && { backgroundColor: Colors.success, borderColor: 'transparent' }
              ]}
            >
              <Text style={[
                styles.statusButtonText,
                !lead.duplicateFlag && styles.activeStatusButtonText
              ]}>Mark as Original / Unique</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeTab === 'history' && (
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Activity History</Text>
        {logs.map((log: any) => (
          <View key={log._id} style={styles.logItem}>
            <View style={styles.logDot} />
            <View style={styles.logContent}>
              <Text style={styles.logText}>{log.content}</Text>
              <Text style={styles.logMeta}>
                {log.user_id?.name} • {new Date(log.created_at).toLocaleString()}
              </Text>
            </View>
          </View>
        ))}
        {logs.length === 0 && (
          <Text style={styles.emptyLogs}>No history yet.</Text>
        )}
      </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 80,
    flexGrow: 1,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tabBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabTxt: {
    color: Colors.textSecondary,
    fontWeight: '800',
    fontSize: 12,
  },
  tabTxtActive: {
    color: Colors.text,
  },
  header: {
    padding: 24,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    backgroundColor: Colors.surface,
    padding: 8,
    borderRadius: 8,
  },
  backText: {
    color: Colors.text,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    margin: 20,
    padding: 24,
    borderRadius: 24,
  },
  infoRow: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  actionSection: {
    padding: 24,
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeStatusButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusButtonText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  activeStatusButtonText: {
    color: Colors.text,
  },
  historySection: {
    padding: 24,
    paddingTop: 0,
    marginBottom: 40,
  },
  logItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 6,
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  logText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  logMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  emptyLogs: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  value: {
    fontSize: 18,
    color: Colors.text,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  statusText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  remarkInput: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    padding: 12,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  remarkBtn: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  remarkBtnTxt: {
    color: Colors.text,
    fontWeight: '900',
  },
  dlgBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  dlgCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dlgTitle: {
    color: Colors.text,
    fontWeight: '900',
    fontSize: 16,
  },
  dlgSub: {
    color: Colors.textSecondary,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 12,
  },
  dlgRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  dlgBtnGhost: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  dlgBtnGhostTxt: {
    color: Colors.textSecondary,
    fontWeight: '800',
  },
  dlgBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  dlgBtnPrimaryTxt: {
    color: Colors.text,
    fontWeight: '900',
  },
});
