import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Colors } from '../theme/colors';
import client from '../api/client';
import { extractError } from '../utils/errorUtils';
import { useAuth } from '../context/AuthContext';

interface TeamMember {
  _id: string;
  name: string;
  mobile: string;
  role: 'admin' | 'staff';
  status?: 'active' | 'inactive';
  created_at?: string;
  leadsCount?: number;
  activeLeadsCount?: number;
}

export const TeamManagementScreen = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newUser, setNewUser] = useState({
    name: '',
    mobile: '',
    password: 'staff@password', // Default password
    role: 'staff' as 'admin' | 'staff'
  });

  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editUser, setEditUser] = useState({
    name: '',
    mobile: '',
    role: 'staff' as 'admin' | 'staff',
    status: 'active' as 'active' | 'inactive'
  });

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/users');
      if (res.data.success) setTeam(res.data.data);
    } catch (e) {
      console.log('[Team] Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleAdd = async () => {
    if (!newUser.name || !newUser.mobile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await client.post('/users', newUser);
      if (res.data.success) {
        setShowAdd(false);
        setNewUser({ name: '', mobile: '', password: 'staff@password', role: 'staff' });
        fetchTeam();
      }
    } catch (e: any) {
      setError(extractError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDetails = (member: TeamMember) => {
    setSelectedMember(member);
    setError(null);
    setShowDetails(true);
  };

  const handleEditFromDetails = () => {
    if (!selectedMember) return;
    setShowDetails(false);
    setEditUser({
      name: selectedMember.name,
      mobile: selectedMember.mobile,
      role: selectedMember.role,
      status: selectedMember.status || 'active'
    });
    setError(null);
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedMember || !editUser.name || !editUser.mobile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await client.put(`/users/${selectedMember._id}`, editUser);
      if (res.data.success) {
        setShowEdit(false);
        setSelectedMember(null);
        fetchTeam();
      }
    } catch (e: any) {
      setError(extractError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedMember) return;
    const newStatus: 'active' | 'inactive' = selectedMember.status === 'inactive' ? 'active' : 'inactive';
    setActionLoading(true);
    setError(null);
    try {
      const res = await client.put(`/users/${selectedMember._id}`, { status: newStatus });
      if (res.data.success) {
        const updatedMember = { ...selectedMember, status: newStatus };
        setSelectedMember(updatedMember);
        
        // Optimistically update list in local state
        setTeam(prev => prev.map(m => m._id === selectedMember._id ? updatedMember : m));
        
        // Background fetch to ensure sync
        fetchTeam();
      }
    } catch (e: any) {
      setError(extractError(e));
    } finally {
      setActionLoading(false);
    }
  };

  const renderMember = ({ item }: { item: TeamMember }) => {
    const isActive = item.status !== 'inactive';
    return (
      <TouchableOpacity 
        style={[s.memberCard, !isActive && { opacity: 0.65 }]}
        onPress={() => handleOpenDetails(item)}
        activeOpacity={0.75}
      >
        <View style={[s.roleIcon, { backgroundColor: item.role === 'admin' ? Colors.primary + '20' : Colors.success + '20' }]}>
          <Text style={s.roleEmoji}>{item.role === 'admin' ? '🏢' : '👤'}</Text>
        </View>
        <View style={s.memberInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.memberName}>{item.name}</Text>
            <View style={{ 
              width: 8, height: 8, borderRadius: 4, 
              backgroundColor: isActive ? Colors.success : Colors.error 
            }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <Text style={s.memberMobile}>{item.mobile}</Text>
            {item.leadsCount !== undefined && (
              <Text style={s.memberLeadsBadge}>📈 {item.leadsCount} leads</Text>
            )}
          </View>
        </View>
        <View style={[s.rolePill, { backgroundColor: item.role === 'admin' ? Colors.primary + '15' : Colors.success + '15' }]}>
          <Text style={[s.rolePillTxt, { color: item.role === 'admin' ? Colors.primary : Colors.success }]}>
            {item.role.toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Team Management</Text>
          <Text style={s.subtitle}>Manage your firm's admins and staff</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={s.addBtnTxt}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={team}
        keyExtractor={item => item._id}
        renderItem={renderMember}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTeam} tintColor={Colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>No team members found.</Text>
            </View>
          ) : null
        }
      />

      {/* ── Add Member Modal ── */}
      <Modal visible={showAdd} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>New Team Member</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={s.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            {error && <View style={s.errorBox}><Text style={s.errorTxt}>{error}</Text></View>}

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.inputGroup}>
                <Text style={s.label}>Full Name</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter name"
                  placeholderTextColor={Colors.textSecondary}
                  value={newUser.name}
                  onChangeText={v => setNewUser(p => ({ ...p, name: v }))}
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.label}>Mobile Number</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter mobile"
                  placeholderTextColor={Colors.textSecondary}
                  value={newUser.mobile}
                  onChangeText={v => setNewUser(p => ({ ...p, mobile: v }))}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.label}>Initial Password</Text>
                <TextInput
                  style={s.input}
                  placeholder="Create password"
                  placeholderTextColor={Colors.textSecondary}
                  value={newUser.password}
                  onChangeText={v => setNewUser(p => ({ ...p, password: v }))}
                  secureTextEntry
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.label}>Role</Text>
                <View style={s.roleRow}>
                  {['staff', 'admin'].map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[s.roleBtn, newUser.role === r && s.roleBtnActive]}
                      onPress={() => setNewUser(p => ({ ...p, role: r as any }))}
                    >
                      <Text style={[s.roleBtnTxt, newUser.role === r && s.roleBtnTxtActive]}>
                        {r.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={s.saveBtn} onPress={handleAdd} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Create Member</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Team Member Details Modal ── */}
      <Modal visible={showDetails} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Member Details</Text>
              <TouchableOpacity onPress={() => { setShowDetails(false); setSelectedMember(null); }}>
                <Text style={s.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            {error && <View style={s.errorBox}><Text style={s.errorTxt}>{error}</Text></View>}

            {selectedMember && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View style={s.profileHeader}>
                  <View style={[s.avatarCircleLarge, { backgroundColor: selectedMember.role === 'admin' ? Colors.primary + '20' : Colors.success + '20' }]}>
                    <Text style={s.avatarEmojiLarge}>{selectedMember.role === 'admin' ? '🏢' : '👤'}</Text>
                  </View>
                  <Text style={s.detailName}>{selectedMember.name}</Text>
                  <View style={s.badgeRow}>
                    <View style={[s.rolePill, { backgroundColor: selectedMember.role === 'admin' ? Colors.primary + '15' : Colors.success + '15' }]}>
                      <Text style={[s.rolePillTxt, { color: selectedMember.role === 'admin' ? Colors.primary : Colors.success }]}>
                        {selectedMember.role.toUpperCase()}
                      </Text>
                    </View>
                    <View style={[s.rolePill, { backgroundColor: selectedMember.status !== 'inactive' ? Colors.success + '15' : Colors.error + '15' }]}>
                      <Text style={[s.rolePillTxt, { color: selectedMember.status !== 'inactive' ? Colors.success : Colors.error }]}>
                        {(selectedMember.status || 'active').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Lead Statistics */}
                <Text style={s.detailSectionTitle}>Performance Metrics</Text>
                <View style={s.statsGrid}>
                  <View style={s.statBox}>
                    <Text style={s.statLabel}>TOTAL LEADS</Text>
                    <Text style={[s.statValue, { color: Colors.primary }]}>{selectedMember.leadsCount ?? 0}</Text>
                  </View>
                  <View style={s.statBox}>
                    <Text style={s.statLabel}>ACTIVE LEADS</Text>
                    <Text style={[s.statValue, { color: Colors.success }]}>{selectedMember.activeLeadsCount ?? 0}</Text>
                  </View>
                </View>

                {/* Account Details */}
                <Text style={s.detailSectionTitle}>Contact & Info</Text>
                <View style={s.infoCard}>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Mobile Number</Text>
                    <Text style={s.infoValue}>{selectedMember.mobile}</Text>
                  </View>
                  <View style={s.infoDivider} />
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Joined On</Text>
                    <Text style={s.infoValue}>
                      {selectedMember.created_at 
                        ? new Date(selectedMember.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
                        : 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* Admin Actions */}
                {selectedMember._id !== user?.id && (
                  <View style={{ marginTop: 24, marginBottom: 20 }}>
                    <Text style={s.detailSectionTitle}>Administrative Controls</Text>
                    <View style={s.actionBtnGroup}>
                      <TouchableOpacity style={s.editActionBtn} onPress={handleEditFromDetails}>
                        <Text style={s.editActionBtnTxt}>✏️ Edit Profile</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[
                          s.statusActionBtn, 
                          selectedMember.status !== 'inactive' 
                            ? { backgroundColor: Colors.error + '15', borderColor: Colors.error } 
                            : { backgroundColor: Colors.success + '15', borderColor: Colors.success }
                        ]} 
                        onPress={handleToggleStatus}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <ActivityIndicator color={selectedMember.status !== 'inactive' ? Colors.error : Colors.success} />
                        ) : (
                          <Text style={[
                            s.statusActionBtnTxt, 
                            { color: selectedMember.status !== 'inactive' ? Colors.error : Colors.success }
                          ]}>
                            {selectedMember.status !== 'inactive' ? '🔒 Deactivate Staff' : '🔓 Activate Staff'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Edit Member Modal ── */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Edit Team Member</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Text style={s.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            {error && <View style={s.errorBox}><Text style={s.errorTxt}>{error}</Text></View>}

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.inputGroup}>
                <Text style={s.label}>Full Name</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter name"
                  placeholderTextColor={Colors.textSecondary}
                  value={editUser.name}
                  onChangeText={v => setEditUser(p => ({ ...p, name: v }))}
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.label}>Mobile Number</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter mobile"
                  placeholderTextColor={Colors.textSecondary}
                  value={editUser.mobile}
                  onChangeText={v => setEditUser(p => ({ ...p, mobile: v }))}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Only let them change role if it's not their own account */}
              {selectedMember?._id !== user?.id && (
                <View style={s.inputGroup}>
                  <Text style={s.label}>Role</Text>
                  <View style={s.roleRow}>
                    {['staff', 'admin'].map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[s.roleBtn, editUser.role === r && s.roleBtnActive]}
                        onPress={() => setEditUser(p => ({ ...p, role: r as any }))}
                      >
                        <Text style={[s.roleBtnTxt, editUser.role === r && s.roleBtnTxtActive]}>
                          {r.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Only let them deactivate if it's not their own account */}
              {selectedMember?._id !== user?.id && (
                <View style={s.inputGroup}>
                  <Text style={s.label}>Account Status</Text>
                  <View style={s.roleRow}>
                    {[
                      { key: 'active', label: 'ACTIVE', color: Colors.success },
                      { key: 'inactive', label: 'INACTIVE', color: Colors.error }
                    ].map(st => (
                      <TouchableOpacity
                        key={st.key}
                        style={[
                          s.roleBtn, 
                          editUser.status === st.key && { backgroundColor: st.color, borderColor: st.color }
                        ]}
                        onPress={() => setEditUser(p => ({ ...p, status: st.key as any }))}
                      >
                        <Text style={[s.roleBtnTxt, editUser.status === st.key && { color: '#fff' }]}>
                          {st.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { padding: 16 },
  memberCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  roleEmoji: { fontSize: 20 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  memberMobile: { fontSize: 13, color: Colors.textSecondary },
  memberLeadsBadge: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rolePillTxt: { fontSize: 10, fontWeight: '800' },
  empty: { marginTop: 100, alignItems: 'center' },
  emptyTxt: { color: Colors.textSecondary, fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  closeX: { fontSize: 20, color: Colors.textSecondary },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 },
  input: { backgroundColor: Colors.background, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.background, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  roleBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleBtnTxt: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  roleBtnTxtActive: { color: '#fff' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24, marginBottom: 20 },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  errorBox: { backgroundColor: Colors.error + '15', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.error + '30' },
  errorTxt: { color: Colors.error, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Member Details Styles
  profileHeader: { alignItems: 'center', marginBottom: 24, marginTop: 10 },
  avatarCircleLarge: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarEmojiLarge: { fontSize: 32 },
  detailName: { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  detailSectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 10, marginTop: 16, letterSpacing: 0.5 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: Colors.background, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statLabel: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, marginBottom: 6, letterSpacing: 0.3 },
  statValue: { fontSize: 24, fontWeight: '900' },
  infoCard: { backgroundColor: Colors.background, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '700' },
  infoDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  actionBtnGroup: { flexDirection: 'row', gap: 10, marginTop: 6 },
  editActionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  editActionBtnTxt: { fontSize: 14, fontWeight: '700', color: Colors.text },
  statusActionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statusActionBtnTxt: { fontSize: 14, fontWeight: '700' },
});
