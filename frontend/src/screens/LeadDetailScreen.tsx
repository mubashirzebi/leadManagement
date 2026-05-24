import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Colors } from '../theme/colors';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Lead, ActivityLog, Staff } from '../types';

export const LeadDetailScreen = ({ route, navigation }: { route: any, navigation: any }) => {
  const [lead, setLead] = React.useState<Lead>(route.params.lead);
  const [logs, setLogs] = React.useState<ActivityLog[]>([]);
  const [staff, setStaff] = React.useState<Staff[]>([]);
  const [updating, setUpdating] = React.useState(false);
  const { user } = useAuth();

  const fetchStaff = async () => {
    try {
      const response = await client.get('/users/staff');
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
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      fetchStaff();
    }
  }, []);

  const statuses = ['New', 'Contacted', 'Qualified', 'Lost', 'Closed'];
  const temperatures = ['Hot', 'Warm', 'Cold'];

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

  const handleCreateReminder = async (hours: number) => {
    setUpdating(true);
    const remindAt = new Date();
    remindAt.setHours(remindAt.getHours() + hours);

    try {
      const response = await client.post('/reminders', {
        lead_id: lead._id,
        remind_at: remindAt,
        remark: `Follow up after ${hours} hour(s)`
      });
      if (response.data.success) {
        Alert.alert('Success', `Reminder set for ${remindAt.toLocaleTimeString()}`);
        fetchLogs();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to set reminder');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
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

      <View style={styles.actionSection}>
        <Text style={styles.sectionTitle}>Update Status</Text>
        <View style={styles.statusGrid}>
          {statuses.map((s) => (
            <TouchableOpacity 
              key={s}
              onPress={() => handleUpdate({ status: s })}
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

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Set Temperature</Text>
        <View style={styles.statusGrid}>
          {temperatures.map((t) => (
            <TouchableOpacity 
              key={t}
              onPress={() => handleUpdate({ temperature: t })}
              disabled={updating}
              style={[
                styles.statusButton, 
                lead.temperature === t && { 
                  backgroundColor: t === 'Hot' ? Colors.error : t === 'Warm' ? Colors.warning : Colors.primary,
                  borderColor: 'transparent'
                }
              ]}
            >
              <Text style={[
                styles.statusButtonText,
                lead.temperature === t && styles.activeStatusButtonText
              ]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {updating && <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />}
      </View>

      <View style={[styles.actionSection, { marginTop: -20 }]}>
        <Text style={styles.sectionTitle}>Follow-up Reminders</Text>
        <View style={styles.statusGrid}>
          <TouchableOpacity onPress={() => handleCreateReminder(1)} style={styles.statusButton}>
            <Text style={styles.statusButtonText}>In 1 Hour</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleCreateReminder(24)} style={styles.statusButton}>
            <Text style={styles.statusButtonText}>Tomorrow</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleCreateReminder(48)} style={styles.statusButton}>
            <Text style={styles.statusButtonText}>In 2 Days</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <View style={[styles.actionSection, { marginTop: -20 }]}>
          <Text style={styles.sectionTitle}>Assign to Staff</Text>
          <View style={styles.statusGrid}>
            {staff.map((s: any) => (
              <TouchableOpacity 
                key={s._id} 
                onPress={() => handleUpdate({ assigned_to: s._id })}
                disabled={updating}
                style={[
                  styles.statusButton,
                  lead.assigned_to?._id === s._id && styles.activeStatusButton
                ]}
              >
                <Text style={[
                  styles.statusButtonText,
                  lead.assigned_to?._id === s._id && styles.activeStatusButtonText
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
    </ScrollView>
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
});
