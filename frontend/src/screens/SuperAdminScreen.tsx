import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  FlatList,
  TouchableOpacity
} from 'react-native';
import { Colors } from '../theme/colors';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export const SuperAdminScreen = ({ navigation }: any) => {
  const { logout } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newAgency, setNewAgency] = useState({ agencyName: '', adminName: '', adminMobile: '', adminPassword: '' });
  const [creating, setCreating] = useState(false);

  const fetchOrgs = async () => {
    try {
      const response = await client.get('/superadmin/organizations');
      if (response.data.success) {
        setOrgs(response.data.data);
      }
    } catch (error) {
      console.error('Fetch orgs failed', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgency = async () => {
    if (!newAgency.agencyName || !newAgency.adminMobile || !newAgency.adminPassword) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setCreating(true);
    try {
      const response = await client.post('/superadmin/organizations', newAgency);
      if (response.data.success) {
        Alert.alert('Success', 'Organization created! You can now share credentials with the Agency Admin.');
        setShowCreate(false);
        setNewAgency({ agencyName: '', adminName: '', adminMobile: '', adminPassword: '' });
        fetchOrgs();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const renderOrg = ({ item }: { item: any }) => (
    <View style={styles.orgCard}>
      <View>
        <Text style={styles.orgName}>{item.name}</Text>
        <Text style={styles.orgStatus}>{item.status.toUpperCase()}</Text>
      </View>
      <TouchableOpacity 
        style={[styles.statusButton, item.status === 'suspended' ? styles.activeButton : styles.suspendButton]}
        onPress={() => handleToggleStatus(item._id, item.status)}
      >
        <Text style={styles.buttonText}>{item.status === 'suspended' ? 'Activate' : 'Suspend'}</Text>
      </TouchableOpacity>
    </View>
  );

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await client.patch(`/superadmin/organizations/${id}/status`, { status: newStatus });
      fetchOrgs();
    } catch (error) {
      console.error('Toggle status failed', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>SuperAdmin</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => navigation.navigate('PasswordChange')}>
              <Text style={styles.actionText}>Change Password</Text>
            </TouchableOpacity>
            <Text style={styles.divider}>|</Text>
            <TouchableOpacity onPress={logout}>
              <Text style={[styles.actionText, { color: Colors.error }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.createBtnText}>+ Add Agency</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Agency Setup</Text>
            <ScrollView>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Agency Name</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. Skyline Realty" 
                  placeholderTextColor={Colors.textSecondary}
                  value={newAgency.agencyName}
                  onChangeText={(val) => setNewAgency({...newAgency, agencyName: val})}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Admin Name</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. David Manager" 
                  placeholderTextColor={Colors.textSecondary}
                  value={newAgency.adminName}
                  onChangeText={(val) => setNewAgency({...newAgency, adminName: val})}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Admin Mobile</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. 9876543210" 
                  placeholderTextColor={Colors.textSecondary}
                  value={newAgency.adminMobile}
                  onChangeText={(val) => setNewAgency({...newAgency, adminMobile: val})}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Initial Password</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="Set temp password" 
                  placeholderTextColor={Colors.textSecondary}
                  value={newAgency.adminPassword}
                  onChangeText={(val) => setNewAgency({...newAgency, adminPassword: val})}
                  secureTextEntry
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.saveBtn} 
                  onPress={handleCreateAgency}
                  disabled={creating}
                >
                  {creating ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.saveBtnText}>Create Agency</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FlatList
        data={orgs}
        keyExtractor={(item) => item._id}
        renderItem={renderOrg}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchOrgs} tintColor={Colors.primary} />
        }
      />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createBtnText: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  actionText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    color: Colors.border,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 18,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.surface,
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    padding: 18,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  saveBtnText: {
    color: Colors.text,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  orgCard: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orgName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  orgStatus: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 4,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  suspendButton: {
    backgroundColor: Colors.error + '20',
  },
  activeButton: {
    backgroundColor: Colors.success + '20',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
});
