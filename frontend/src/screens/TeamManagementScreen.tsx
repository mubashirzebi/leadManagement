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

interface TeamMember {
  _id: string;
  name: string;
  mobile: string;
  role: 'admin' | 'staff';
}

export const TeamManagementScreen = () => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [newUser, setNewUser] = useState({
    name: '',
    mobile: '',
    password: 'staff@password', // Default password
    role: 'staff' as 'admin' | 'staff'
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

  const renderMember = ({ item }: { item: TeamMember }) => (
    <View style={s.memberCard}>
      <View style={[s.roleIcon, { backgroundColor: item.role === 'admin' ? Colors.primary + '20' : Colors.success + '20' }]}>
        <Text style={s.roleEmoji}>{item.role === 'admin' ? '🏢' : '👤'}</Text>
      </View>
      <View style={s.memberInfo}>
        <Text style={s.memberName}>{item.name}</Text>
        <Text style={s.memberMobile}>{item.mobile}</Text>
      </View>
      <View style={[s.rolePill, { backgroundColor: item.role === 'admin' ? Colors.primary + '15' : Colors.success + '15' }]}>
        <Text style={[s.rolePillTxt, { color: item.role === 'admin' ? Colors.primary : Colors.success }]}>
          {item.role.toUpperCase()}
        </Text>
      </View>
    </View>
  );

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
  memberMobile: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
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
});
