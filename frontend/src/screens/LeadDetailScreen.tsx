import React, { useCallback, useRef, useState } from 'react';
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
  Linking,
  RefreshControl,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../theme/colors';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Lead, ActivityLog, Project } from '../types';
import { ProjectPickerModal } from '../components/ProjectPickerModal';
import { MultiProjectPickerModal } from '../components/MultiProjectPickerModal';
import { formatStatusLabel } from '../utils/statusUtils';

type RouteParams = { params: { lead: Lead } };
type NavigationProp = { goBack: () => void };

const getLogIcon = (type: string): string => {
  switch (type) {
    case 'creation': return '\u{1F195}';
    case 'update':
    case 'status_change': return '\u{1F504}';
    case 'assignment': return '\u{1F464}';
    case 'remark':
    case 'note': return '\u{1F4AC}';
    case 'reminder': return '\u23F0';
    case 'call_init': return '\u{1F4DE}';
    case 'whatsapp_send': return '\u{1F4AC}';
    case 'visit_completed': return '\u2705';
    case 'visit_cancelled': return '\u274C';
    case 'visit_rescheduled': return '\u{1F4C5}';
    default: return '\u2022';
  }
};

const formatDateTime = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
};

const getStatusMeta = (status: Lead['status']): { label: string; color: string; bg: string } => {
  switch (status) {
    case 'NEW': return { label: 'New lead — not contacted yet', color: '#60a5fa', bg: '#3b82f620' };
    case 'CALLBACK': return { label: 'Callback needed', color: '#f59e0b', bg: '#f59e0b20' };
    case 'INTERESTED': return { label: 'Lead is interested', color: '#10b981', bg: '#10b98120' };
    case 'VISIT_BOOKED': return { label: 'Visit scheduled', color: '#06b6d4', bg: '#06b6d420' };
    case 'RE_VISIT': return { label: 'Re-visit scheduled', color: '#a855f7', bg: '#a855f720' };
    case 'VISITED': return { label: 'Visited — been to site', color: '#0d9488', bg: '#0d948820' };
    case 'BOOKED': return { label: '\u2713 Deal closed', color: '#10b981', bg: '#10b98120' };
    case 'NOT_INTERESTED': return { label: 'Not interested', color: '#ef4444', bg: '#ef444420' };
    case 'INVALID_NUMBER': return { label: 'Invalid number', color: '#64748b', bg: '#64748b20' };
    default: return { label: formatStatusLabel(status), color: Colors.textSecondary, bg: 'transparent' };
  }
};

export const LeadDetailScreen = ({ route, navigation }: { route: RouteParams; navigation: NavigationProp }) => {
  const [lead, setLead] = React.useState<Lead>(route.params.lead);
  const [logs, setLogs] = React.useState<ActivityLog[]>([]);
  const [updating, setUpdating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'actions' | 'history' | 'visits'>('actions');
  const [remarkDraft, setRemarkDraft] = React.useState('');
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [pendingStatus, setPendingStatus] = React.useState<Lead['status'] | null>(null);
  const [statusRemarkDraft, setStatusRemarkDraft] = React.useState('');
  const [callbackReasonDraft, setCallbackReasonDraft] = React.useState<Lead['callback_reason']>(undefined);
  const [propertyStatusDraft, setPropertyStatusDraft] = React.useState<Lead['property_status']>(undefined);
  const [propertyTypeDraft, setPropertyTypeDraft] = React.useState('');
  const [preferredAreaDraft, setPreferredAreaDraft] = React.useState('');
  const [projectDraft, setProjectDraft] = React.useState('');
  const [projectPickerOpen, setProjectPickerOpen] = React.useState(false);
  const [markDoneProjectPickerOpen, setMarkDoneProjectPickerOpen] = React.useState(false);
  const [markDoneProjectIds, setMarkDoneProjectIds] = React.useState<string[]>([]);
  const [projectIdDraft, setProjectIdDraft] = React.useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = React.useState('');
  const [notInterestedReasonDraft, setNotInterestedReasonDraft] = React.useState<Lead['not_interested_reason']>(undefined);
  const [editInterestOpen, setEditInterestOpen] = React.useState(false);
  const [visitDraftDate, setVisitDraftDate] = React.useState<Date>(() => { const d = new Date(); d.setHours(d.getHours() + 2); return d; });
  const [visitNativePickerMode, setVisitNativePickerMode] = React.useState<null | 'date' | 'time'>(null);
  // Unified reminder modal
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [remindAt, setRemindAt] = React.useState<Date>(() => { const d = new Date(); d.setMinutes(d.getMinutes() + 60); return d; });
  const [reminderRemark, setReminderRemark] = React.useState('');
  const [reminderDeleteMode, setReminderDeleteMode] = React.useState(false);
  const [nativePickerMode, setNativePickerMode] = React.useState<null | 'date' | 'time'>(null);
  const [sourceExpanded, setSourceExpanded] = React.useState(false);
  // Visit outcome states
  const [markDoneOpen, setMarkDoneOpen] = React.useState(false);
  const [markDoneNotes, setMarkDoneNotes] = useState<Record<string, string>>({});
  const [markDoneProjects, setMarkDoneProjects] = useState<string[]>([]);
  const [activeNoteProject, setActiveNoteProject] = useState<string | null>(null);
  const [chipInputText, setChipInputText] = useState('');
  const chipInputRef = useRef<TextInput>(null);
  const [catalogProjects, setCatalogProjects] = useState<Project[]>([]);
  const [cancelVisitOpen, setCancelVisitOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [rescheduleDate, setRescheduleDate] = React.useState<Date>(() => new Date());
  const [rescheduleNativePickerMode, setRescheduleNativePickerMode] = React.useState<null | 'date' | 'time'>(null);
  const { user } = useAuth();
  const isVisitStatus = lead.status === 'VISIT_BOOKED' || lead.status === 'RE_VISIT';
  const hasVisited = lead.visit_count && lead.visit_count > 0;
  const statusMeta = getStatusMeta(lead.status);

  const fetchLead = useCallback(async () => {
    try {
      const response = await client.get(`/leads/${route.params.lead._id}`);
      if (response.data.success) setLead(response.data.data);
    } catch (error) { console.error('Fetch lead failed', error); }
  }, [route.params.lead._id]);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await client.get(`/leads/${route.params.lead._id}/logs?page=1&limit=50`);
      if (response.data.success) setLogs(response.data.data);
    } catch (error) { console.error('Fetch logs failed', error); }
  }, [route.params.lead._id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchLead(), fetchLogs()]);
    setRefreshing(false);
  }, [fetchLead, fetchLogs]);

  React.useEffect(() => {
    fetchLead();
    fetchLogs();
  }, [fetchLead, fetchLogs]);

  const openWhatsApp = useCallback(() => {
    const digits = lead.mobile.replace(/\D/g, '');
    const whatsappNumber = digits.length === 10 ? `91${digits}` : digits;
    Linking.openURL(`https://wa.me/${whatsappNumber}`).catch(() => Alert.alert('Error', 'Could not open WhatsApp'));
  }, [lead.mobile]);

  const openCall = useCallback(() => {
    Linking.openURL(`tel:${lead.mobile}`).catch(() => Alert.alert('Error', 'Could not open phone dialer'));
  }, [lead.mobile]);

  const statuses: Lead['status'][] = ['NEW', 'CALLBACK', 'INTERESTED', 'VISIT_BOOKED', 'VISITED', 'RE_VISIT', 'BOOKED', 'NOT_INTERESTED', 'INVALID_NUMBER'];
  const heats: Lead['heat'][] = ['HOT', 'WARM', 'COLD'];

  const handleUpdate = async (updateData: Record<string, unknown>) => {
    setUpdating(true);
    try {
      const response = await client.patch(`/leads/${lead._id}`, updateData);
      if (response.data.success) { setLead(response.data.data); fetchLogs(); }
    } catch (error) { Alert.alert('Error', 'Failed to update lead'); }
    finally { setUpdating(false); }
  };

  const openEditInterest = () => {
    setPropertyStatusDraft(lead.property_status || undefined);
    setPropertyTypeDraft(lead.property_type || '');
    setProjectDraft(lead.project || '');
    setProjectIdDraft(lead.project_id || null);
    setBudgetDraft(lead.budget || '');
    setPreferredAreaDraft(lead.preferred_area || '');
    setEditInterestOpen(true);
  };

  const closeEditInterest = () => {
    setEditInterestOpen(false);
    setPropertyStatusDraft(undefined);
    setPropertyTypeDraft('');
    setProjectDraft('');
    setProjectIdDraft(null);
    setBudgetDraft('');
    setPreferredAreaDraft('');
  };

  const saveEditInterest = async () => {
    setUpdating(true);
    try {
      const payload: Record<string, unknown> = {};
      if (propertyStatusDraft) payload.property_status = propertyStatusDraft;
      if (propertyTypeDraft) payload.property_type = propertyTypeDraft;
      if (projectDraft) payload.project = projectDraft;
      if (projectIdDraft) payload.project_id = projectIdDraft;
      if (budgetDraft) payload.budget = budgetDraft;
      if (preferredAreaDraft) payload.preferred_area = preferredAreaDraft;
      const response = await client.patch(`/leads/${lead._id}`, payload);
      if (response.data.success) { setLead(response.data.data); fetchLogs(); closeEditInterest(); }
    } catch (error) { Alert.alert('Error', 'Failed to update interest details'); }
    finally { setUpdating(false); }
  };

  const openStatusDialog = (status: Lead['status']) => {
    setPendingStatus(status);
    setStatusRemarkDraft('');
    setCallbackReasonDraft(undefined);
    setPropertyStatusDraft(undefined);
    setPropertyTypeDraft('');
    setPreferredAreaDraft('');
    setProjectDraft('');
    setProjectIdDraft(null);
    setBudgetDraft('');
    setNotInterestedReasonDraft(undefined);
    const visitDate = new Date(); visitDate.setHours(visitDate.getHours() + 2);
    setVisitDraftDate(visitDate);
    setVisitNativePickerMode(null);
    setStatusDialogOpen(true);
  };

  const closeStatusDialog = () => {
    setStatusDialogOpen(false);
    setPendingStatus(null);
    setStatusRemarkDraft('');
    setCallbackReasonDraft(undefined);
    setPropertyStatusDraft(undefined);
    setPropertyTypeDraft('');
    setPreferredAreaDraft('');
    setProjectDraft('');
    setProjectIdDraft(null);
    setBudgetDraft('');
    setNotInterestedReasonDraft(undefined);
    setVisitNativePickerMode(null);
  };

  const openReminder = (prefill?: { date?: Date; remark?: string; deleteMode?: boolean }) => {
    setRemindAt(prefill?.date || (() => { const d = new Date(); d.setMinutes(d.getMinutes() + 60); return d; })());
    setReminderRemark(prefill?.remark || '');
    setReminderDeleteMode(prefill?.deleteMode || false);
    setReminderOpen(true);
    setNativePickerMode('date');
  };

  const closeReminder = () => {
    setReminderOpen(false);
    setNativePickerMode(null);
    setReminderDeleteMode(false);
  };

  const saveReminder = async () => {
    setUpdating(true);
    try {
      // Delete existing reminder first
      await client.delete(`/reminders?lead_id=${lead._id}`).catch(() => {});
      // Create new reminder
      const response = await client.post('/reminders', {
        lead_id: lead._id,
        remind_at: remindAt,
        remark: reminderRemark.trim() || 'Follow up',
      });
      if (response.data.success) {
        closeReminder();
        fetchLogs();
        fetchLead(); // Refresh to show updated next_reminder_at
      }
    } catch (error) { Alert.alert('Error', 'Failed to save reminder'); }
    finally { setUpdating(false); }
  };

  const deleteReminder = async () => {
    setUpdating(true);
    try {
      await client.delete(`/reminders?lead_id=${lead._id}`);
      closeReminder();
      fetchLogs();
      fetchLead();
    } catch (error) { Alert.alert('Error', 'Failed to delete reminder'); }
    finally { setUpdating(false); }
  };

  // === VISIT OUTCOME HANDLERS ===

  const openMarkDone = () => {
    setMarkDoneNotes({});
    setMarkDoneProjects(lead.project ? [lead.project] : []);
    setMarkDoneProjectIds(lead.project_id ? [lead.project_id] : []);
    setChipInputText('');
    setMarkDoneOpen(true);
  };

  const closeMarkDone = () => {
    setMarkDoneOpen(false);
    setMarkDoneNotes({});
    setMarkDoneProjects([]);
    setMarkDoneProjectIds([]);
    setChipInputText('');
  };

  const addProjectChip = () => {
    const trimmed = chipInputText.trim().replace(/,+$/, '');
    if (!trimmed) return;
    const newProjects = trimmed.split(',').map(p => p.trim()).filter(p => p.length > 0);
    setMarkDoneProjects(prev => [...prev, ...newProjects.filter(p => !prev.includes(p))]);
    setChipInputText('');
  };

  const removeProjectChip = (index: number) => {
    // Remove from names array
    setMarkDoneProjects(prev => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      if (removed) {
        setMarkDoneNotes(n => { const c = { ...n }; delete c[removed]; return c; });
      }
      return next;
    });
    // Keep markDoneProjectIds in sync — remove the corresponding ID
    setMarkDoneProjectIds(prev => prev.filter((_, i) => i !== index));
  };

  const handleMarkVisitDone = async () => {
    setUpdating(true);
    try {
      const projectList = markDoneProjects.length > 0
        ? markDoneProjects.join(', ')
        : 'site visit';
      await client.patch(`/leads/${lead._id}`, {
        status: 'VISITED',
        site_visit_at: null,
        next_reminder_at: null,
        visit_projects: markDoneProjects,
        visit_notes: markDoneNotes,
        activity_type: 'visit_completed',
        activity_content: `Site visit completed — ${projectList} on ${new Date(lead.site_visit_at!).toLocaleDateString()}`,
      });
      await client.delete(`/reminders?lead_id=${lead._id}`).catch(() => {});
      closeMarkDone();
      fetchLead();
      fetchLogs();
    } catch (error) { Alert.alert('Error', 'Failed to mark visit as done'); }
    finally { setUpdating(false); }
  };

  const openCancelVisit = () => {
    setCancelReason(null);
    setCancelVisitOpen(true);
  };

  const closeCancelVisit = () => {
    setCancelVisitOpen(false);
    setCancelReason(null);
  };

  const handleCancelVisit = async () => {
    if (!cancelReason) { Alert.alert('Select Reason', 'Please pick a cancellation reason'); return; }
    setUpdating(true);
    try {
      // Determine destination status: if they've visited before, stay in VISITED
      const cancelToStatus = hasVisited ? 'VISITED' : 'INTERESTED';
      await client.patch(`/leads/${lead._id}`, {
        status: cancelToStatus,
        site_visit_at: null,
        activity_type: 'visit_cancelled',
        activity_content: `Site visit cancelled — ${cancelReason.replace(/_/g, ' ')}`,
      });
      await client.delete(`/reminders?lead_id=${lead._id}`).catch(() => {});
      closeCancelVisit();
      fetchLead();
      fetchLogs();
    } catch (error) { Alert.alert('Error', 'Failed to cancel visit'); }
    finally { setUpdating(false); }
  };

  const openReschedule = () => {
    setRescheduleDate(lead.site_visit_at ? new Date(lead.site_visit_at) : new Date());
    setRescheduleNativePickerMode(null);
    setRescheduleOpen(true);
  };

  const closeReschedule = () => {
    setRescheduleOpen(false);
    setRescheduleNativePickerMode(null);
  };

  const handleReschedule = async () => {
    const oldDate = lead.site_visit_at ? formatDateTime(lead.site_visit_at) : 'unknown';
    const newDateIso = rescheduleDate.toISOString();
    setUpdating(true);
    try {
      await client.patch(`/leads/${lead._id}`, {
        site_visit_at: newDateIso,
        activity_type: 'visit_rescheduled',
        activity_content: `Site visit rescheduled from ${oldDate} to ${formatDateTime(newDateIso)}`,
      });
      // Overwrite reminder to day-before
      await client.delete(`/reminders?lead_id=${lead._id}`).catch(() => {});
      const dayBefore = new Date(rescheduleDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(10, 0, 0, 0);
      await client.post('/reminders', {
        lead_id: lead._id,
        remind_at: dayBefore,
        remark: 'Reminder: site visit tomorrow',
      }).catch(() => {});
      closeReschedule();
      fetchLead();
      fetchLogs();
    } catch (error) { Alert.alert('Error', 'Failed to reschedule visit'); }
    finally { setUpdating(false); }
  };

  const assignedToName = lead.assigned_to
    ? (typeof lead.assigned_to === 'string' ? 'Assigned' : lead.assigned_to.name)
    : 'Unassigned';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      scrollEnabled
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
    >
      {/* === STATUS DIALOG === */}
      <Modal visible={statusDialogOpen} transparent animationType="fade" onRequestClose={closeStatusDialog}>
        <View style={styles.dlgBackdrop}>
          <View style={styles.dlgCard}>
            <Text style={styles.dlgTitle}>Update Status</Text>
            <Text style={styles.dlgSub}>{pendingStatus ? formatStatusLabel(pendingStatus) : ''}</Text>

            {pendingStatus === 'CALLBACK' && (
              <>
                <Text style={styles.dlgFieldLabel}>Callback Reason</Text>
                <View style={styles.dlgOptionRow}>
                  {(['busy', 'switched_off', 'ringing', 'disconnected'] as const).map((reason) => (
                    <TouchableOpacity key={reason} onPress={() => setCallbackReasonDraft(reason)}
                      style={[styles.dlgOptionChip, callbackReasonDraft === reason && styles.dlgOptionChipActive]}>
                      <Text style={[styles.dlgOptionChipTxt, callbackReasonDraft === reason && styles.dlgOptionChipTxtActive]}>{reason.replace('_', ' ')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {pendingStatus === 'INTERESTED' && (
              <>
                <Text style={styles.dlgFieldLabel}>Looking For</Text>
                <View style={styles.dlgOptionRow}>
                  {(['under_construction', 'nearing_possession', 'ready_to_move'] as const).map((opt) => (
                    <TouchableOpacity key={opt} onPress={() => setPropertyStatusDraft(opt)}
                      style={[styles.dlgOptionChip, propertyStatusDraft === opt && styles.dlgOptionChipActive]}>
                      <Text style={[styles.dlgOptionChipTxt, propertyStatusDraft === opt && styles.dlgOptionChipTxtActive]}>
                        {opt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput value={propertyTypeDraft} onChangeText={setPropertyTypeDraft} placeholder="Property Type (e.g. 2BHK, Villa)" placeholderTextColor={Colors.textSecondary} style={styles.dlgTextInput} />
                <TouchableOpacity
                  onPress={() => { setProjectIdDraft(null); setProjectPickerOpen(true); }}
                  style={[styles.dlgTextInput, { justifyContent: 'center', paddingVertical: 14 }]}
                >
                  <Text style={{ color: projectDraft ? Colors.text : Colors.textSecondary, fontSize: 14 }}>
                    {projectDraft || 'Project Interested In (tap to select)'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.dlgFieldLabel, { marginTop: 0 }]}>Budget</Text>
                <View style={styles.dlgOptionRow}>
                  {['30L', '50L', '80L', '1 Cr', '1.5 Cr', '2 Cr+'].map((opt) => (
                    <TouchableOpacity key={opt} onPress={() => setBudgetDraft(opt)}
                      style={[styles.dlgOptionChip, budgetDraft === opt && styles.dlgOptionChipActive]}>
                      <Text style={[styles.dlgOptionChipTxt, budgetDraft === opt && styles.dlgOptionChipTxtActive]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput value={budgetDraft} onChangeText={setBudgetDraft} placeholder="Or type your own..." placeholderTextColor={Colors.textSecondary} style={styles.dlgTextInput} />
                <TextInput value={preferredAreaDraft} onChangeText={setPreferredAreaDraft} placeholder="Preferred Location" placeholderTextColor={Colors.textSecondary} style={styles.dlgTextInput} />
              </>
            )}

            {(pendingStatus === 'VISIT_BOOKED' || pendingStatus === 'RE_VISIT') && (
              <>
                <Text style={styles.dlgFieldLabel}>Visit Date & Time</Text>
                <View style={styles.dlgOptionRow}>
                  <TouchableOpacity style={styles.dlgBtnGhost} onPress={() => setVisitNativePickerMode('date')}><Text style={styles.dlgBtnGhostTxt}>Pick Date</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.dlgBtnGhost} onPress={() => setVisitNativePickerMode('time')}><Text style={styles.dlgBtnGhostTxt}>Pick Time</Text></TouchableOpacity>
                </View>
                <Text style={[styles.dlgSub, { fontSize: 13 }]}>📅 {visitDraftDate.toLocaleString()}</Text>
              </>
            )}

            {visitNativePickerMode && pendingStatus && (pendingStatus === 'VISIT_BOOKED' || pendingStatus === 'RE_VISIT') ? (
              <DateTimePicker value={visitDraftDate} mode={visitNativePickerMode} display="default" is24Hour={false}
                onChange={(_, selected) => {
                  setVisitNativePickerMode(null);
                  if (!selected) return;
                  if (visitNativePickerMode === 'date') {
                    const next = new Date(visitDraftDate);
                    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                    setVisitDraftDate(next);
                    setTimeout(() => setVisitNativePickerMode('time'), 0);
                  } else {
                    const next = new Date(visitDraftDate);
                    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                    setVisitDraftDate(next);
                  }
                }}
              />
            ) : null}

            {pendingStatus === 'NOT_INTERESTED' && (
              <>
                <Text style={styles.dlgFieldLabel}>Reason</Text>
                <View style={styles.dlgOptionRow}>
                  {(['too_expensive', 'not_looking', 'already_purchased', 'bad_location', 'fake_lead', 'others'] as const).map((reason) => (
                    <TouchableOpacity key={reason} onPress={() => setNotInterestedReasonDraft(reason)}
                      style={[styles.dlgOptionChip, notInterestedReasonDraft === reason && styles.dlgOptionChipActive]}>
                      <Text style={[styles.dlgOptionChipTxt, notInterestedReasonDraft === reason && styles.dlgOptionChipTxtActive]}>{reason.replace(/_/g, ' ')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TextInput value={statusRemarkDraft} onChangeText={setStatusRemarkDraft} placeholder="Optional remark..." placeholderTextColor={Colors.textSecondary} style={styles.remarkInput} multiline />

            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={closeStatusDialog} disabled={updating}><Text style={styles.dlgBtnGhostTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.dlgBtnPrimary, updating && { opacity: 0.7 }]} disabled={updating || !pendingStatus}
                onPress={async () => {
                  const next = pendingStatus;
                  const remark = statusRemarkDraft.trim();
                  const payload: Record<string, unknown> = { status: next };
                  if (remark) payload.remark = remark;
                  if (next === 'CALLBACK' && callbackReasonDraft) payload.callback_reason = callbackReasonDraft;
                  if (next === 'INTERESTED') {
                    if (propertyStatusDraft) payload.property_status = propertyStatusDraft;
                    if (propertyTypeDraft) payload.property_type = propertyTypeDraft;
                    if (projectDraft) payload.project = projectDraft;
                    if (projectIdDraft) payload.project_id = projectIdDraft;
                    if (budgetDraft) payload.budget = budgetDraft;
                    if (preferredAreaDraft) payload.preferred_area = preferredAreaDraft;
                  }
                  if (next === 'NOT_INTERESTED' && notInterestedReasonDraft) payload.not_interested_reason = notInterestedReasonDraft;
                  if (next === 'VISIT_BOOKED' || next === 'RE_VISIT') payload.site_visit_at = visitDraftDate.toISOString();

                  closeStatusDialog();
                  setUpdating(true);
                  try {
                    if (next === 'BOOKED') await client.delete(`/reminders?lead_id=${lead._id}`).catch(() => {});
                    const response = await client.patch(`/leads/${lead._id}`, payload);
                    if (response.data.success) { setLead(response.data.data); fetchLogs(); fetchLead(); }
                  } catch (error) { Alert.alert('Error', 'Failed to update lead'); }
                  finally { setUpdating(false); }
                }}
              >
                <Text style={styles.dlgBtnPrimaryTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* === UNIFIED REMINDER MODAL === */}
      <Modal visible={reminderOpen} transparent animationType="fade" onRequestClose={closeReminder}>
        <View style={styles.dlgBackdrop}>
          <View style={styles.dlgCard}>
            <Text style={styles.dlgTitle}>Schedule Reminder</Text>
            <Text style={styles.dlgSub}>{remindAt.toLocaleString()}</Text>

            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={() => setNativePickerMode('date')} disabled={updating}><Text style={styles.dlgBtnGhostTxt}>Pick Date</Text></TouchableOpacity>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={() => setNativePickerMode('time')} disabled={updating}><Text style={styles.dlgBtnGhostTxt}>Pick Time</Text></TouchableOpacity>
            </View>

            <TextInput value={reminderRemark} onChangeText={setReminderRemark} placeholder="Note / reason" placeholderTextColor={Colors.textSecondary}
              style={[styles.remarkInput, { marginTop: 12, minHeight: 80 }]} multiline />

            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={closeReminder} disabled={updating}><Text style={styles.dlgBtnGhostTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.dlgBtnPrimary, updating && { opacity: 0.7 }]} disabled={updating} onPress={saveReminder}>
                <Text style={styles.dlgBtnPrimaryTxt}>{reminderDeleteMode ? 'Update' : 'Save'}</Text>
              </TouchableOpacity>
            </View>

            {lead.next_reminder_at && (
              <TouchableOpacity onPress={deleteReminder} disabled={updating} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ color: Colors.error, fontWeight: '700', fontSize: 14 }}>Delete Reminder</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* === EDIT INTEREST DETAILS MODAL === */}
      <Modal visible={editInterestOpen} transparent animationType="fade" onRequestClose={closeEditInterest}>
        <View style={styles.dlgBackdrop}>
          <View style={styles.dlgCard}>
            <Text style={styles.dlgTitle}>Edit Interest Details</Text>
            <Text style={styles.dlgFieldLabel}>Looking For</Text>
            <View style={styles.dlgOptionRow}>
              {(['under_construction', 'nearing_possession', 'ready_to_move'] as const).map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setPropertyStatusDraft(opt)}
                  style={[styles.dlgOptionChip, propertyStatusDraft === opt && styles.dlgOptionChipActive]}>
                  <Text style={[styles.dlgOptionChipTxt, propertyStatusDraft === opt && styles.dlgOptionChipTxtActive]}>
                    {opt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput value={propertyTypeDraft} onChangeText={setPropertyTypeDraft} placeholder="Property Type (e.g. 2BHK, Villa)" placeholderTextColor={Colors.textSecondary} style={styles.dlgTextInput} />
            <TouchableOpacity
              onPress={() => { setProjectIdDraft(null); setProjectPickerOpen(true); }}
              style={[styles.dlgTextInput, { justifyContent: 'center', paddingVertical: 14 }]}
            >
              <Text style={{ color: projectDraft ? Colors.text : Colors.textSecondary, fontSize: 14 }}>
                {projectDraft || 'Project Interested In (tap to select)'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.dlgFieldLabel, { marginTop: 0 }]}>Budget</Text>
            <View style={styles.dlgOptionRow}>
              {['30L', '50L', '80L', '1 Cr', '1.5 Cr', '2 Cr+'].map((opt) => (
                <TouchableOpacity key={opt} onPress={() => setBudgetDraft(opt)}
                  style={[styles.dlgOptionChip, budgetDraft === opt && styles.dlgOptionChipActive]}>
                  <Text style={[styles.dlgOptionChipTxt, budgetDraft === opt && styles.dlgOptionChipTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput value={budgetDraft} onChangeText={setBudgetDraft} placeholder="Or type your own..." placeholderTextColor={Colors.textSecondary} style={styles.dlgTextInput} />
            <TextInput value={preferredAreaDraft} onChangeText={setPreferredAreaDraft} placeholder="Preferred Location" placeholderTextColor={Colors.textSecondary} style={styles.dlgTextInput} />
            <TextInput value={statusRemarkDraft} onChangeText={setStatusRemarkDraft} placeholder="Optional note..." placeholderTextColor={Colors.textSecondary} style={[styles.dlgTextInput, { minHeight: 60 }]} multiline />
            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={closeEditInterest} disabled={updating}><Text style={styles.dlgBtnGhostTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.dlgBtnPrimary, updating && { opacity: 0.7 }]} disabled={updating} onPress={saveEditInterest}>
                <Text style={styles.dlgBtnPrimaryTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ProjectPickerModal
        visible={projectPickerOpen}
        onClose={() => setProjectPickerOpen(false)}
        onSelect={(proj, customName) => {
          if (proj) {
            setProjectDraft(proj.name);
            setProjectIdDraft(proj._id);
          } else if (customName) {
            setProjectDraft(customName);
            setProjectIdDraft(null);
          }
          setProjectPickerOpen(false);
        }}
      />

      {nativePickerMode ? (
        <DateTimePicker value={remindAt} mode={nativePickerMode} display="default" is24Hour={false}
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

      {/* === MARK DONE MODAL === */}
      <Modal visible={markDoneOpen} transparent animationType="fade" onRequestClose={closeMarkDone}>
        <View style={styles.dlgBackdrop}>
          <View style={styles.dlgCard}>
            <Text style={styles.dlgTitle}>✓ Mark Visit as Done</Text>
            <Text style={styles.dlgSub}>Projects visited</Text>

            {/* Select Projects button — opens MultiProjectPickerModal */}
            <TouchableOpacity
              style={styles.markDoneSelectBtn}
              onPress={() => setMarkDoneProjectPickerOpen(true)}
            >
              <Text style={styles.markDoneSelectBtnText}>🏗️ Select Projects</Text>
            </TouchableOpacity>

            <View style={styles.chipContainer}>
              {markDoneProjects.map((proj, idx) => (
                <View key={idx} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>{proj}</Text>
                  <TouchableOpacity onPress={() => removeProjectChip(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.chipClose}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TextInput
                value={chipInputText}
                onChangeText={setChipInputText}
                onSubmitEditing={addProjectChip}
                placeholder="+ Type custom project name, press Enter"
                placeholderTextColor={Colors.textSecondary}
                style={styles.chipInput}
                returnKeyType="done"
                blurOnSubmit={false}
              />
            </View>

            {markDoneProjects.length > 0 && (
              <>
                <Text style={[styles.dlgSub, { marginTop: 14 }]}>Notes per project (optional)</Text>
                {markDoneProjects.map((proj, idx) => (
                  <View key={proj} style={{ marginBottom: idx < markDoneProjects.length - 1 ? 10 : 0 }}>
                    <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
                      🏗️ {proj}
                    </Text>
                    <TextInput
                      value={markDoneNotes[proj] || ''}
                      onChangeText={(t) => setMarkDoneNotes(prev => ({ ...prev, [proj]: t }))}
                      placeholder={`Notes for ${proj}...`}
                      placeholderTextColor={Colors.textSecondary}
                      style={[styles.dlgTextInput, { minHeight: 50 }]}
                      multiline
                    />
                  </View>
                ))}
              </>
            )}

            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={closeMarkDone} disabled={updating}>
                <Text style={styles.dlgBtnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dlgBtnPrimary, updating && { opacity: 0.7 }]} disabled={updating} onPress={handleMarkVisitDone}>
                <Text style={styles.dlgBtnPrimaryTxt}>✓ Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Multi-Project Picker for Mark Visit Done (renders AFTER Mark Done modal so it appears on top) ─── */}
      <MultiProjectPickerModal
        visible={markDoneProjectPickerOpen}
        onClose={() => setMarkDoneProjectPickerOpen(false)}
        onConfirm={(ids, names) => {
          setMarkDoneProjectIds(ids);
          setMarkDoneProjects(names);
        }}
        selectedProjectIds={markDoneProjectIds}
      />

      {/* === CANCEL VISIT MODAL === */}
      <Modal visible={cancelVisitOpen} transparent animationType="fade" onRequestClose={closeCancelVisit}>
        <View style={styles.dlgBackdrop}>
          <View style={styles.dlgCard}>
            <Text style={styles.dlgTitle}>Cancel Visit</Text>
            <Text style={styles.dlgSub}>Why is this visit being cancelled?</Text>

            <Text style={styles.dlgFieldLabel}>Reason</Text>
            <View style={styles.dlgOptionRow}>
              {(['client_busy', 'client_not_responding', 'client_lost_interest', 'other'] as const).map((reason) => (
                <TouchableOpacity key={reason} onPress={() => setCancelReason(reason)}
                  style={[styles.dlgOptionChip, cancelReason === reason && styles.dlgOptionChipActive]}>
                  <Text style={[styles.dlgOptionChipTxt, cancelReason === reason && styles.dlgOptionChipTxtActive]}>
                    {reason.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={closeCancelVisit} disabled={updating}>
                <Text style={styles.dlgBtnGhostTxt}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dlgBtnPrimary, updating && { opacity: 0.7 }]} disabled={updating || !cancelReason} onPress={handleCancelVisit}>
                <Text style={styles.dlgBtnPrimaryTxt}>Confirm Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* === RESCHEDULE VISIT MODAL === */}
      <Modal visible={rescheduleOpen} transparent animationType="fade" onRequestClose={closeReschedule}>
        <View style={styles.dlgBackdrop}>
          <View style={styles.dlgCard}>
            <Text style={styles.dlgTitle}>Reschedule Visit</Text>
            <Text style={styles.dlgSub}>Pick a new date & time</Text>

            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={() => setRescheduleNativePickerMode('date')} disabled={updating}>
                <Text style={styles.dlgBtnGhostTxt}>Pick Date</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={() => setRescheduleNativePickerMode('time')} disabled={updating}>
                <Text style={styles.dlgBtnGhostTxt}>Pick Time</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.dlgSub, { fontSize: 13 }]}>📅 {rescheduleDate.toLocaleString()}</Text>

            {rescheduleNativePickerMode && (
              <DateTimePicker value={rescheduleDate} mode={rescheduleNativePickerMode} display="default" is24Hour={false}
                onChange={(_, selected) => {
                  setRescheduleNativePickerMode(null);
                  if (!selected) return;
                  if (rescheduleNativePickerMode === 'date') {
                    const next = new Date(rescheduleDate);
                    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                    setRescheduleDate(next);
                    setTimeout(() => setRescheduleNativePickerMode('time'), 0);
                  } else {
                    const next = new Date(rescheduleDate);
                    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                    setRescheduleDate(next);
                  }
                }}
              />
            )}

            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={closeReschedule} disabled={updating}>
                <Text style={styles.dlgBtnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dlgBtnPrimary, updating && { opacity: 0.7 }]} disabled={updating} onPress={handleReschedule}>
                <Text style={styles.dlgBtnPrimaryTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* === HEADER === */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Lead Details</Text>
      </View>

      {/* === QUICK ACTIONS === */}
      <View style={styles.quickActions}>
        <TouchableOpacity onPress={openWhatsApp} style={styles.quickActionBtn}><Text style={styles.quickActionBtnText}>💬 WhatsApp</Text></TouchableOpacity>
        <TouchableOpacity onPress={openCall} style={styles.quickActionBtn}><Text style={styles.quickActionBtnText}>📞 Call</Text></TouchableOpacity>
      </View>

      {/* === STATUS CONTEXT BANNER === */}
      <View style={[styles.statusBanner, { backgroundColor: statusMeta.bg, borderLeftColor: statusMeta.color, borderLeftWidth: 3 }]}>
        <Text style={[styles.statusBannerText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
      </View>

      {/* === VISIT SCHEDULE CARD === */}
      {isVisitStatus && lead.site_visit_at && (
        <View style={styles.visitCard}>
          <View style={styles.visitCardHeader}>
            <Text style={styles.visitCardTitle}>📅 {lead.status === 'RE_VISIT' ? 'Re-Visit Scheduled' : 'Upcoming Visit'}</Text>
          </View>
          <Text style={styles.visitCardDate}>{formatDateTime(lead.site_visit_at)}</Text>

          {/* Three action buttons */}
          <View style={styles.visitCardActions}>
            <TouchableOpacity style={styles.visitBtnDone} onPress={openMarkDone} disabled={updating}>
              <Text style={styles.visitBtnDoneText}>✓ Mark Done</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.visitBtnReschedule} onPress={openReschedule} disabled={updating}>
              <Text style={styles.visitBtnRescheduleText}>📅 Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.visitBtnCancel} onPress={openCancelVisit} disabled={updating}>
              <Text style={styles.visitBtnCancelText}>✕ Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.visitCardDivider} />

          {lead.next_reminder_at ? (
            <View style={styles.visitCardFooter}>
              <View style={{ flex: 1 }}>
                <Text style={styles.visitCardRemindLabel}>⏰ Reminder</Text>
                <Text style={styles.visitCardRemindDate}>{formatDateTime(lead.next_reminder_at)}</Text>
                {lead.next_reminder_remark ? <Text style={styles.visitCardRemindNote}>{lead.next_reminder_remark}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => openReminder({ date: new Date(lead.next_reminder_at!), remark: lead.next_reminder_remark || '', deleteMode: true })}>
                <Text style={styles.visitCardAction}>Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.visitCardRemindBtn} onPress={() => openReminder()}>
              <Text style={styles.visitCardRemindBtnText}>⏰ Schedule Reminder</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* === INFO CARD === */}
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{lead.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Mobile</Text>
          <Text style={styles.value}>{lead.mobile}</Text>
        </View>

        {lead.email ? (<View style={styles.infoRow}><Text style={styles.label}>Email</Text><Text style={styles.value}>{lead.email}</Text></View>) : null}
        {lead.city ? (<View style={styles.infoRow}><Text style={styles.label}>City</Text><Text style={styles.value}>{lead.city}</Text></View>) : null}
        {lead.budget ? (<View style={styles.infoRow}><Text style={styles.label}>Budget</Text><Text style={styles.value}>{lead.budget}</Text></View>) : null}

        {/* Status + Heat inline */}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Status</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.statusBadge}><Text style={styles.statusText}>{formatStatusLabel(lead.status)}</Text></View>
            <View style={styles.heatBadge}>
              <Text style={styles.heatText}>
                {lead.heat === 'HOT' ? '🔥' : lead.heat === 'WARM' ? '🌤️' : '❄️'} {lead.heat}
              </Text>
            </View>
          </View>
        </View>

        {lead.status === 'CALLBACK' && lead.callback_reason ? (<View style={styles.infoRow}><Text style={styles.label}>Callback Reason</Text><Text style={styles.value}>{lead.callback_reason.replace(/_/g, ' ')}</Text></View>) : null}
        {['INTERESTED', 'VISIT_BOOKED', 'VISITED', 'RE_VISIT', 'BOOKED'].includes(lead.status) && (lead.property_status || lead.property_type || lead.project || lead.budget || lead.preferred_area) && (
          <View style={[styles.infoRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <Text style={styles.label}>Interest Details</Text>
            <TouchableOpacity onPress={openEditInterest}><Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 13 }}>Edit</Text></TouchableOpacity>
          </View>
        )}
        {['INTERESTED', 'VISIT_BOOKED', 'VISITED', 'RE_VISIT', 'BOOKED'].includes(lead.status) && lead.property_status ? (<View style={styles.infoRow}><Text style={styles.label}>Looking For</Text><Text style={styles.value}>{lead.property_status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text></View>) : null}
        {['INTERESTED', 'VISIT_BOOKED', 'VISITED', 'RE_VISIT', 'BOOKED'].includes(lead.status) && lead.property_type ? (<View style={styles.infoRow}><Text style={styles.label}>Property Type</Text><Text style={styles.value}>{lead.property_type}</Text></View>) : null}
        {['INTERESTED', 'VISIT_BOOKED', 'VISITED', 'RE_VISIT', 'BOOKED'].includes(lead.status) && lead.preferred_area ? (<View style={styles.infoRow}><Text style={styles.label}>Preferred Location</Text><Text style={styles.value}>{lead.preferred_area}</Text></View>) : null}
        {lead.status === 'NOT_INTERESTED' && lead.not_interested_reason ? (<View style={styles.infoRow}><Text style={styles.label}>Not Interested Reason</Text><Text style={styles.value}>{lead.not_interested_reason.replace(/_/g, ' ')}</Text></View>) : null}

        <View style={styles.infoRow}>
          <Text style={styles.label}>Assigned To</Text>
          <Text style={styles.value}>{assignedToName}</Text>
        </View>

        {/* Duplicate status - inline badge for admin */}
        {lead.duplicateFlag && (
          <View style={styles.infoRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.label}>Duplicate</Text>
              <View style={{ backgroundColor: Colors.error + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: Colors.error, fontSize: 10, fontWeight: '800' }}>DUPLICATE</Text>
              </View>
            </View>
          </View>
        )}

        {lead.project ? (<View style={styles.infoRow}><Text style={styles.label}>Project</Text><Text style={styles.value}>{lead.project}</Text></View>) : null}

        {/* Source with expandable details */}
        <TouchableOpacity onPress={() => setSourceExpanded(!sourceExpanded)} style={[styles.infoRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={styles.label}>Source</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.value}>{lead.source}</Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{sourceExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {sourceExpanded && (
          <>
            {lead.facebook_page_name ? (<View style={styles.infoRow}><Text style={[styles.label, { fontSize: 11 }]}>Facebook Page</Text><Text style={[styles.value, { fontSize: 14 }]}>{lead.facebook_page_name}</Text></View>) : null}
            {lead.facebook_form_name ? (<View style={styles.infoRow}><Text style={[styles.label, { fontSize: 11 }]}>Facebook Form</Text><Text style={[styles.value, { fontSize: 14 }]}>{lead.facebook_form_name}</Text></View>) : null}
          </>
        )}

        {/* Next Reminder (only when not shown in Visit Schedule Card) */}
        {!isVisitStatus && lead.next_reminder_at ? (
          <View style={[styles.infoRow, { paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.label}>Next Reminder</Text>
              <TouchableOpacity onPress={() => openReminder({ date: new Date(lead.next_reminder_at!), remark: lead.next_reminder_remark || '', deleteMode: true })}>
                <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 13 }}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.value}>{formatDateTime(lead.next_reminder_at)}</Text>
            {lead.next_reminder_remark ? (<Text style={[styles.value, { fontSize: 14, marginTop: 4, color: Colors.textSecondary }]}>{lead.next_reminder_remark}</Text>) : null}
          </View>
        ) : null}

        {lead.custom_data && Object.keys(lead.custom_data).length > 0 && (
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border }}>
            <Text style={[styles.sectionTitle, { marginBottom: 16, fontSize: 14, color: Colors.textSecondary }]}>Form Answers</Text>
            {Object.entries(lead.custom_data).map(([key, val]) => {
              if (['full_name', 'name', 'phone_number', 'phone', 'email', 'city', 'FIRST_NAME', 'PHONE_NUMBER', 'USER_EMAIL'].includes(key)) return null;
              const prettifiedKey = key.replace(/[_-]/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()).replace(/\bId\b/g, 'ID').replace(/\bEmail\b/g, 'Email');
              return (<View key={key} style={styles.infoRow}><Text style={styles.label}>{prettifiedKey}</Text><Text style={styles.value}>{String(val)}</Text></View>);
            })}
          </View>
        )}
      </View>

      {/* === TABS === */}
      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setActiveTab('actions')} style={[styles.tabBtn, activeTab === 'actions' && styles.tabBtnActive]}>
          <Text style={[styles.tabTxt, activeTab === 'actions' && styles.tabTxtActive]}>Actions</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('history')} style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}>
          <Text style={[styles.tabTxt, activeTab === 'history' && styles.tabTxtActive]}>History</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('visits')} style={[styles.tabBtn, activeTab === 'visits' && styles.tabBtnActive]}>
          <Text style={[styles.tabTxt, activeTab === 'visits' && styles.tabTxtActive]}>Visits{lead.visit_count ? ` (${lead.visit_count})` : ''}</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'actions' && (
      <View style={styles.actionSection}>
        <Text style={styles.sectionTitle}>Update Status</Text>
        <View style={styles.statusGrid}>
          {statuses.map((s) => (
            <TouchableOpacity key={s} onPress={() => openStatusDialog(s)} disabled={updating}
              style={[styles.statusButton, lead.status === s && styles.activeStatusButton]}>
              <Text style={[styles.statusButtonText, lead.status === s && styles.activeStatusButtonText]}>{formatStatusLabel(s)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Compact heat chips inline */}
        <View style={[styles.statusGrid, { marginTop: 16 }]}>
          {heats.map((t) => (
            <TouchableOpacity key={t} onPress={() => handleUpdate({ heat: t })} disabled={updating}
              style={[styles.statusButton, { flexDirection: 'row', alignItems: 'center', gap: 4 },
                lead.heat === t && { backgroundColor: t === 'HOT' ? Colors.error : t === 'WARM' ? Colors.warning : Colors.primary, borderColor: 'transparent' }]}>
              <Text style={{ fontSize: 12 }}>{t === 'HOT' ? '🔥' : t === 'WARM' ? '🌤️' : '❄️'}</Text>
              <Text style={[styles.statusButtonText, lead.heat === t && styles.activeStatusButtonText]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Compact reminder button */}
        <View style={{ flexDirection: 'row', marginTop: 20 }}>
          <TouchableOpacity onPress={() => openReminder()} style={[styles.statusButton, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]} disabled={updating}>
            <Text style={{ fontSize: 14 }}>⏰</Text>
            <Text style={styles.statusButtonText}>Set Reminder</Text>
          </TouchableOpacity>
        </View>

        {updating && <ActivityIndicator color={Colors.primary} style={{ marginTop: 16 }} />}
      </View>
      )}
      {activeTab === 'actions' && (user?.role === 'admin' || user?.role === 'superadmin') && (
        <View style={[styles.actionSection, { marginTop: -20 }]}>
          <Text style={styles.sectionTitle}>Duplicate Management</Text>
          <View style={styles.statusGrid}>
            <TouchableOpacity onPress={() => handleUpdate({ duplicateFlag: true })} disabled={updating}
              style={[styles.statusButton, lead.duplicateFlag && { backgroundColor: Colors.error, borderColor: 'transparent' }]}>
              <Text style={[styles.statusButtonText, lead.duplicateFlag && styles.activeStatusButtonText]}>Mark as Duplicate</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleUpdate({ duplicateFlag: false })} disabled={updating}
              style={[styles.statusButton, !lead.duplicateFlag && { backgroundColor: Colors.success, borderColor: 'transparent' }]}>
              <Text style={[styles.statusButtonText, !lead.duplicateFlag && styles.activeStatusButtonText]}>Mark as Original / Unique</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeTab === 'history' && (
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Activity History</Text>
        {logs.map((log) => (
          <View key={log._id} style={styles.logItem}>
            <Text style={styles.logIcon}>{getLogIcon(log.type)}</Text>
            <View style={styles.logContent}>
              <Text style={styles.logText}>{log.content}</Text>
              <Text style={styles.logMeta}>{log.user_id?.name} • {new Date(log.created_at).toLocaleString()}</Text>
            </View>
          </View>
        ))}
        {logs.length === 0 && (<Text style={styles.emptyLogs}>No history yet.</Text>)}
      </View>
      )}

      {activeTab === 'visits' && (
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Visit History</Text>
        {lead.visit_history && lead.visit_history.length > 0 ? (
          lead.visit_history.map((visit, idx) => (
            <View key={idx} style={styles.visitHistoryCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 18 }}>
                  {visit.outcome === 'completed' ? '✅' : visit.outcome === 'cancelled' ? '❌' : '⚠️'}
                </Text>
                <Text style={styles.visitHistoryTitle}>
                  {visit.outcome === 'completed' ? 'Completed' : visit.outcome === 'cancelled' ? 'Cancelled' : 'No Show'}
                </Text>
              </View>
              <Text style={styles.visitHistoryDetail}>
                Scheduled: {new Date(visit.scheduled_at).toLocaleString()}
              </Text>
              {visit.completed_at && (
                <Text style={styles.visitHistoryDetail}>
                  Completed: {new Date(visit.completed_at).toLocaleString()}
                </Text>
              )}
              {visit.project && (
                <Text style={styles.visitHistoryDetail}>Project: {visit.project}</Text>
              )}
              {visit.cancellation_reason && (
                <Text style={styles.visitHistoryDetail}>
                  Reason: {visit.cancellation_reason.replace(/_/g, ' ')}
                </Text>
              )}
              {visit.notes && (
                <Text style={styles.visitHistoryDetail}>Notes: {visit.notes}</Text>
              )}
              <Text style={styles.visitHistoryTime}>
                {new Date(visit.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyLogs}>No visit history yet.</Text>
        )}
      </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 80, flexGrow: 1 },
  tabs: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 4 },
  tabBtn: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabTxt: { color: Colors.textSecondary, fontWeight: '800', fontSize: 12 },
  tabTxtActive: { color: Colors.text },
  header: { padding: 24, paddingTop: 60, flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 16, backgroundColor: Colors.surface, padding: 8, borderRadius: 8 },
  backText: { color: Colors.text, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text },
  quickActions: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, gap: 12 },
  quickActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  quickActionBtnText: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  statusBanner: { marginHorizontal: 20, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  statusBannerText: { fontSize: 13, fontWeight: '700' },
  visitCard: { marginHorizontal: 20, marginBottom: 12, backgroundColor: Colors.surface, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  visitCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  visitCardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  visitCardAction: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  visitCardDate: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  visitCardDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 8 },
  visitCardFooter: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  visitCardRemindLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 2 },
  visitCardRemindDate: { fontSize: 15, fontWeight: '600', color: Colors.text },
  visitCardRemindNote: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  visitCardRemindBtn: { paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  visitCardRemindBtnText: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  // Visit outcome action buttons
  visitCardActions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  visitBtnDone: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#10b98120', borderWidth: 1, borderColor: '#10b981', alignItems: 'center' },
  visitBtnDoneText: { color: '#10b981', fontWeight: '800', fontSize: 13 },
  visitBtnReschedule: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.primary + '20', borderWidth: 1, borderColor: Colors.primary, alignItems: 'center' },
  visitBtnRescheduleText: { color: Colors.primary, fontWeight: '800', fontSize: 13 },
  visitBtnCancel: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#ef444420', borderWidth: 1, borderColor: '#ef4444', alignItems: 'center' },
  visitBtnCancelText: { color: '#ef4444', fontWeight: '800', fontSize: 13 },
  card: { backgroundColor: Colors.surface, margin: 20, padding: 24, borderRadius: 24 },
  infoRow: { marginBottom: 20 },
  label: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  actionSection: { padding: 24, backgroundColor: Colors.surface, marginHorizontal: 20, marginBottom: 40, borderRadius: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusButton: { backgroundColor: Colors.background, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  activeStatusButton: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  statusButtonText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13 },
  activeStatusButtonText: { color: Colors.text },
  heatBadge: { backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  heatText: { color: Colors.text, fontWeight: '600', fontSize: 12 },
  historySection: { padding: 24, paddingTop: 0, marginBottom: 40 },
  logItem: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-start' },
  logIcon: { fontSize: 16, marginRight: 10, marginTop: 2 },
  logContent: { flex: 1 },
  logText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  logMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  emptyLogs: { color: Colors.textSecondary, fontSize: 14, fontStyle: 'italic' },
  visitHistoryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  visitHistoryTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  visitHistoryDetail: { fontSize: 13, color: Colors.textSecondary, marginTop: 3 },
  visitHistoryTime: { fontSize: 11, color: Colors.textSecondary, marginTop: 8, textAlign: 'right' as const },
  value: { fontSize: 18, color: Colors.text, fontWeight: '600' },
  statusBadge: { alignSelf: 'flex-start', backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginTop: 4 },
  statusText: { color: Colors.text, fontWeight: '700', fontSize: 12 },
  remarkInput: { minHeight: 110, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, padding: 12, color: Colors.text, textAlignVertical: 'top' },
  dlgBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22 },
  dlgCard: { width: '100%', maxWidth: 520, backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  dlgTitle: { color: Colors.text, fontWeight: '900', fontSize: 16 },
  dlgSub: { color: Colors.textSecondary, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  dlgFieldLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  dlgOptionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dlgOptionChip: { backgroundColor: Colors.background, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  dlgOptionChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dlgOptionChipTxt: { color: Colors.textSecondary, fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },
  dlgOptionChipTxtActive: { color: Colors.text },
  dlgTextInput: { borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, padding: 12, color: Colors.text, marginBottom: 10 },
  dlgRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  dlgBtnGhost: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background, alignItems: 'center' },
  dlgBtnGhostTxt: { color: Colors.textSecondary, fontWeight: '800' },
  dlgBtnPrimary: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  dlgBtnPrimaryTxt: { color: Colors.text, fontWeight: '900' },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '18',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  chipText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 140,
  },
  chipClose: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 2,
  },
  chipInput: {
    flex: 1,
    minWidth: 120,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 4,
  },
  markDoneSelectBtn: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 10,
  },
  markDoneSelectBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionsList: { backgroundColor: Colors.background, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: 4, maxHeight: 180 },
  suggestionItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionName: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  suggestionSub: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  suggestionCustom: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed' as const, marginTop: 4, alignItems: 'center' as const },
  suggestionCustomText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
});

