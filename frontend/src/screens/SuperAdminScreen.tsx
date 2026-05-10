import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList, TextInput,
  TouchableOpacity, Modal, ActivityIndicator,
  RefreshControl, ScrollView, Alert,
} from 'react-native';
import { Colors } from '../theme/colors';
import client from '../api/client';
import { extractError } from '../utils/errorUtils';

// ─── Types ───────────────────────────────────────────────────────────────────
interface OrgAdmin { _id: string; name: string; mobile: string; }
interface Agency {
  _id: string; name: string; status: 'active' | 'suspended';
  created_at: string; admin: OrgAdmin | null;
  staff_count: number; lead_count: number;
}
interface DialogCfg {
  visible: boolean; icon: string; title: string;
  message: string; confirmLabel: string;
  confirmColor: string; onConfirm: () => void;
}
const HIDDEN_DLG: DialogCfg = {
  visible: false, icon: '', title: '', message: '',
  confirmLabel: '', confirmColor: Colors.primary, onConfirm: () => {},
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const daysSince = (d: string) =>
  Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

// ─── Custom Dialog ────────────────────────────────────────────────────────────
const Dialog = ({ cfg, onCancel }: { cfg: DialogCfg; onCancel: () => void }) => (
  <Modal visible={cfg.visible} transparent animationType="fade">
    <View style={dlg.backdrop}>
      <View style={dlg.card}>
        <Text style={dlg.icon}>{cfg.icon}</Text>
        <Text style={dlg.title}>{cfg.title}</Text>
        <Text style={dlg.msg}>{cfg.message}</Text>
        <View style={dlg.row}>
          <TouchableOpacity style={dlg.cancel} onPress={onCancel}>
            <Text style={dlg.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[dlg.confirm, { backgroundColor: cfg.confirmColor }]}
            onPress={() => { onCancel(); cfg.onConfirm(); }}
          >
            <Text style={dlg.confirmTxt}>{cfg.confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
const dlg = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  card:     { width: '100%', backgroundColor: Colors.surface, borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  icon:     { fontSize: 44, marginBottom: 12 },
  title:    { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  msg:      { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  row:      { flexDirection: 'row', width: '100%' },
  cancel:   { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginRight: 10 },
  cancelTxt:  { color: Colors.textSecondary, fontWeight: '700', fontSize: 15 },
  confirm:    { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  confirmTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

// ─── Firm Card ────────────────────────────────────────────────────────────────
const FirmCard = ({ 
  item, 
  onToggle, 
  onReset 
}: { 
  item: Agency; 
  onToggle: (id: string, status: string) => void;
  onReset: (adminId: string, firmName: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const isActive = item.status === 'active';
  const initial = item.name.charAt(0).toUpperCase();
  return (
    <TouchableOpacity style={s.card} onPress={() => setOpen(v => !v)} activeOpacity={0.85}>
      <View style={s.cardRow}>
        <View style={s.avatar}><Text style={s.avatarTxt}>{initial}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName}>{item.name}</Text>
          <View style={[s.badge, { backgroundColor: isActive ? Colors.success + '20' : Colors.error + '20' }]}>
            <View style={[s.dot, { backgroundColor: isActive ? Colors.success : Colors.error }]} />
            <Text style={[s.badgeTxt, { color: isActive ? Colors.success : Colors.error }]}>
              {isActive ? 'Active' : 'Suspended'}
            </Text>
          </View>
        </View>
        <Text style={s.chevron}>{open ? '▲' : '▼'}</Text>
      </View>

      <View style={s.statsRow}>
        <View style={s.statItem}><Text style={s.statVal}>{item.lead_count}</Text><Text style={s.statLbl}>Leads</Text></View>
        <View style={s.statDiv} />
        <View style={s.statItem}><Text style={s.statVal}>{item.staff_count}</Text><Text style={s.statLbl}>Staff</Text></View>
        <View style={s.statDiv} />
        <View style={s.statItem}><Text style={s.statVal}>{daysSince(item.created_at)}d</Text><Text style={s.statLbl}>On Platform</Text></View>
      </View>

      {open && (
        <View style={s.detail}>
          <View style={s.detailRow}>
            <Text style={s.detailIcon}>📅</Text>
            <View>
              <Text style={s.detailLbl}>Onboarded</Text>
              <Text style={s.detailVal}>{fmt(item.created_at)}</Text>
            </View>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailIcon}>🆔</Text>
            <View>
              <Text style={s.detailLbl}>Organization ID</Text>
              <Text style={s.orgIdVal}>{item._id}</Text>
              <TouchableOpacity
                style={s.copyIdBtn}
                onPress={() => {
                  Alert.alert('Organization ID', item._id);
                }}
              >
                <Text style={s.copyIdBtnTxt}>Show ID</Text>
              </TouchableOpacity>
            </View>
          </View>
          {item.admin && (
            <View style={s.detailRow}>
              <Text style={s.detailIcon}>👤</Text>
              <View>
                <Text style={s.detailLbl}>Firm Admin</Text>
                <Text style={s.detailVal}>{item.admin.name || 'Not set'}</Text>
                {item.admin.mobile ? <Text style={s.detailSub}>📱 {item.admin.mobile}</Text> : null}
              </View>
            </View>
          )}

          <View style={s.actionGrid}>
            <TouchableOpacity
              style={[s.actionBtn, { borderColor: isActive ? Colors.error + '50' : Colors.success + '50' }]}
              onPress={() => onToggle(item._id, item.status)}
            >
              <Text style={[s.actionBtnTxt, { color: isActive ? Colors.error : Colors.success }]}>
                {isActive ? '🔴 Suspend' : '🟢 Activate'}
              </Text>
            </TouchableOpacity>

            {item.admin && (
              <TouchableOpacity
                style={[s.actionBtn, { borderColor: Colors.primary + '50' }]}
                onPress={() => onReset(item.admin!._id, item.name)}
              >
                <Text style={[s.actionBtnTxt, { color: Colors.primary }]}>👤 Edit Admin</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const SuperAdminScreen = ({ navigation }: { navigation: any }) => {
  const [orgs, setOrgs] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState({ 
    id: '', 
    firmName: '', 
    adminName: '', 
    adminMobile: '', 
    password: ''
  });
  const [newFirm, setNewFirm] = useState({ agencyName: '', adminName: '', adminMobile: '', adminPassword: '' });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most_leads' | 'most_staff'>('newest');
  const [filterTab, setFilterTab] = useState<'status' | 'sort'>('status');
  const [dialog, setDialog] = useState<DialogCfg>(HIDDEN_DLG);
  const closeDialog = useCallback(() => setDialog(HIDDEN_DLG), []);

  const closeCreate = () => { setShowCreate(false); setDialog(HIDDEN_DLG); };
  const closeEdit = () => { setShowEdit(false); setEditError(null); };

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.get('/superadmin/organizations');
      if (res.data.success) {
        setOrgs(res.data.data);
      } else {
        setError(res.data.message || 'Failed to load firms');
      }
    } catch (e) { 
      setError(extractError(e));
      console.error('Fetch orgs', e); 
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleCreate = async () => {
    if (!newFirm.agencyName || !newFirm.adminMobile || !newFirm.adminPassword) {
      setDialog({ visible: true, icon: '⚠️', title: 'Missing Fields', message: 'Firm Name, Admin Mobile, and Password are required.', confirmLabel: 'OK', confirmColor: Colors.primary, onConfirm: () => {} });
      return;
    }
    setCreating(true);
    try {
      const res = await client.post('/superadmin/organizations', newFirm);
      if (res.data.success) {
        setShowCreate(false);
        setNewFirm({ agencyName: '', adminName: '', adminMobile: '', adminPassword: '' });
        fetchOrgs();
        setDialog({ visible: true, icon: '✅', title: 'Firm Created', message: 'Share credentials with the Firm Admin.', confirmLabel: 'Done', confirmColor: Colors.success, onConfirm: () => {} });
      }
    } catch (e: any) {
      setDialog({ 
        visible: true, 
        icon: '❌', 
        title: 'Creation Failed', 
        message: extractError(e), 
        confirmLabel: 'Retry', 
        confirmColor: Colors.error, 
        onConfirm: () => {} 
      });
    } finally { setCreating(false); }
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    setEditError(null);
    try {
      // 1. Update Org Status ONLY
      await client.patch(`/superadmin/organizations/${editTarget.id}/status`, { 
        status: undefined // We can still use this to update status if needed
      });

      // 2. Update Admin Info (Name/Mobile)
      const infoRes = await client.patch(`/superadmin/users/${editTarget.id}`, { 
        name: editTarget.adminName?.trim(), 
        mobile: editTarget.adminMobile?.trim() 
      });

      if (!infoRes.data.success) throw new Error(infoRes.data.message);

      // 2. Update Password (if provided)
      if (editTarget.password) {
        const passRes = await client.patch(`/superadmin/users/${editTarget.id}/reset-password`, { 
          newPassword: editTarget.password 
        });
        if (!passRes.data.success) throw new Error(passRes.data.message);
      }

      setShowEdit(false);
      setDialog({ 
        visible: true, 
        icon: '✅', 
        title: 'Admin Updated', 
        message: `${editTarget.firmName}'s admin details saved.`, 
        confirmLabel: 'Done', 
        confirmColor: Colors.success, 
        onConfirm: () => fetchOrgs() 
      });
      setEditTarget({ id: '', firmName: '', adminName: '', adminMobile: '', password: '' });
    } catch (e: any) {
      setEditError(extractError(e));
    } finally { setSavingEdit(false); }
  };

  const handleToggle = (id: string, current: string) => {
    const next = current === 'active' ? 'suspended' : 'active';
    const suspending = next === 'suspended';
    setDialog({
      visible: true,
      icon: suspending ? '🔴' : '🟢',
      title: suspending ? 'Suspend Firm?' : 'Activate Firm?',
      message: suspending
        ? 'This will block all users in this firm from the platform.'
        : 'This will restore access for all users in this firm.',
      confirmLabel: suspending ? 'Suspend' : 'Activate',
      confirmColor: suspending ? Colors.error : Colors.success,
      onConfirm: async () => {
        try { 
          await client.patch(`/superadmin/organizations/${id}/status`, { status: next }); 
          fetchOrgs(); 
        }
        catch (e) { 
          console.log(`[API] Error on toggle: ${extractError(e)}`);
          setDialog({
            visible: true,
            icon: '❌',
            title: 'Action Failed',
            message: extractError(e),
            confirmLabel: 'OK',
            confirmColor: Colors.error,
            onConfirm: () => {}
          });
        }
      },
    });
  };

  const totalLeads    = orgs.reduce((n, o) => n + o.lead_count, 0);
  const activeCount   = orgs.filter(o => o.status === 'active').length;
  const suspendedCount = orgs.filter(o => o.status === 'suspended').length;

  const filtered = orgs
    .filter(o => {
      const q = search.toLowerCase();
      const matchQ = !q 
        || o.name?.toLowerCase().includes(q)
        || (o.admin?.name?.toLowerCase().includes(q) ?? false)
        || (o.admin?.mobile?.includes(q) ?? false);
      
      const matchS = statusFilter === 'all' || o.status === statusFilter;
      return matchQ && matchS;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'most_leads') return b.lead_count - a.lead_count;
      return b.staff_count - a.staff_count;
    });

  const ListHeader = (
    <>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.eyebrow}>PLATFORM OWNER</Text>
        <Text style={s.title}>Firm Management</Text>
        <View style={s.statsBar}>
          {[['Total', orgs.length, Colors.text], ['Active', activeCount, Colors.success], ['Suspended', suspendedCount, Colors.error], ['Leads', totalLeads, Colors.primary]].map(([lbl, val, clr], i, arr) => (
            <React.Fragment key={String(lbl)}>
              <View style={s.statBlock}>
                <Text style={[s.statBig, { color: clr as string }]}>{val}</Text>
                <Text style={s.statSml}>{lbl}</Text>
              </View>
              {i < arr.length - 1 && <View style={s.statSep} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Section row */}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Onboarded Firms</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowCreate(true)}>
          <Text style={s.addBtnTxt}>+ Add Firm</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search name, admin, mobile..."
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={s.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter panel */}
      <View style={s.filterPanel}>
        <View style={s.filterTabs}>
          {(['status', 'sort'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.filterTab, filterTab === tab && s.filterTabActive]}
              onPress={() => setFilterTab(tab)}
            >
              <Text style={[s.filterTabTxt, filterTab === tab && s.filterTabTxtActive]}>
                {tab === 'status' ? 'Status' : 'Sort By'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.chipGroup}>
          {filterTab === 'status' && (
            <>
              {(['all', 'active', 'suspended'] as const).map(v => (
                <TouchableOpacity key={v} style={[s.chip, statusFilter === v && s.chipOn]} onPress={() => setStatusFilter(v)}>
                  {v !== 'all' && <View style={[s.chipDot, { backgroundColor: v === 'active' ? Colors.success : Colors.error }]} />}
                  <Text style={[s.chipTxt, statusFilter === v && s.chipTxtOn]}>
                    {v === 'all' ? 'All' : v === 'active' ? 'Active' : 'Suspended'}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          {filterTab === 'sort' && (
            <>
              {([['newest','Newest'],['oldest','Oldest'],['most_leads','Most Leads'],['most_staff','Most Staff']] as const).map(([v,lbl]) => (
                <TouchableOpacity key={v} style={[s.chip, sortBy === v && s.chipSort]} onPress={() => setSortBy(v)}>
                  <Text style={[s.chipTxt, sortBy === v && s.chipTxtSort]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
        <Text style={s.resultsTxt}>{filtered.length} of {orgs.length} firm{orgs.length !== 1 ? 's' : ''}</Text>
      </View>
    </>
  );

  return (
    <View style={s.container}>
      <Dialog cfg={dialog} onCancel={closeDialog} />

      <FlatList
        data={filtered}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <FirmCard 
            item={item} 
            onToggle={handleToggle} 
            onReset={(adminId, firmName) => {
              setEditTarget({ 
                id: adminId, 
                firmName: firmName, 
                adminName: item.admin?.name || '', 
                adminMobile: item.admin?.mobile || '', 
                password: ''
              });
              setShowEdit(true);
            }} 
          />
        )}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={s.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchOrgs} tintColor={Colors.primary} />}
        ListEmptyComponent={
          !loading ? (
            error ? (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>⚠️</Text>
                <Text style={s.emptyTxt}>Load Failed</Text>
                <Text style={s.emptySubTxt}>{error}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={fetchOrgs}>
                  <Text style={s.retryBtnTxt}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.empty}>
                <Text style={s.emptyIcon}>{search || statusFilter !== 'all' ? '🔍' : '🏢'}</Text>
                <Text style={s.emptyTxt}>{search || statusFilter !== 'all' ? 'No results found' : 'No firms yet'}</Text>
                <Text style={s.emptySubTxt}>
                  {search || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Tap "+ Add Firm" to get started'}
                </Text>
              </View>
            )
          ) : null
        }
      />

      {/* Edit Admin Modal */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <TouchableOpacity style={s.closeModal} onPress={closeEdit}><Text style={s.closeModalTxt}>✕</Text></TouchableOpacity>
            <Text style={s.modalTitle}>👤 Edit Admin Details</Text>
            <Text style={[s.emptySubTxt, { marginBottom: 24 }]}>Managing {editTarget.firmName}</Text>
            
            {editError && (
              <View style={s.localError}>
                <Text style={s.localErrorTxt}>{editError}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>Admin Name</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter full name"
                  placeholderTextColor={Colors.textSecondary}
                  value={editTarget.adminName}
                  onChangeText={v => setEditTarget(p => ({ ...p, adminName: v }))}
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>Mobile Number</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter mobile number"
                  placeholderTextColor={Colors.textSecondary}
                  value={editTarget.adminMobile}
                  onChangeText={v => setEditTarget(p => ({ ...p, adminMobile: v }))}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>New Password (Optional)</Text>
                <TextInput
                  style={s.input}
                  placeholder="Leave blank to keep current"
                  placeholderTextColor={Colors.textSecondary}
                  value={editTarget.password}
                  onChangeText={v => setEditTarget(p => ({ ...p, password: v }))}
                  secureTextEntry
                />
              </View>

              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={closeEdit}>
                  <Text style={s.cancelBtnTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? <ActivityIndicator color={Colors.text} /> : <Text style={s.saveBtnTxt}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <TouchableOpacity style={s.closeModal} onPress={closeCreate}><Text style={s.closeModalTxt}>✕</Text></TouchableOpacity>
            <Text style={s.modalTitle}>🏢 Register New Firm</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { key: 'agencyName', label: 'Firm Name *', placeholder: 'e.g. Skyline Realty', secure: false, phone: false },
                { key: 'adminName', label: 'Admin Name', placeholder: 'e.g. David Manager', secure: false, phone: false },
                { key: 'adminMobile', label: 'Admin Mobile *', placeholder: '9876543210', secure: false, phone: true },
                { key: 'adminPassword', label: 'Initial Password *', placeholder: 'Temporary password', secure: true, phone: false },
              ].map(f => (
                <View key={f.key} style={s.inputGroup}>
                  <Text style={s.inputLabel}>{f.label}</Text>
                  <TextInput
                    style={s.input}
                    placeholder={f.placeholder}
                    placeholderTextColor={Colors.textSecondary}
                    value={newFirm[f.key as keyof typeof newFirm]}
                    onChangeText={v => setNewFirm(p => ({ ...p, [f.key]: v }))}
                    secureTextEntry={f.secure}
                    keyboardType={f.phone ? 'phone-pad' : 'default'}
                  />
                </View>
              ))}
              <View style={s.modalActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={closeCreate}>
                  <Text style={s.cancelBtnTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleCreate} disabled={creating}>
                  {creating ? <ActivityIndicator color={Colors.text} /> : <Text style={s.saveBtnTxt}>Create Firm</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingBottom: 40 },

  // Header
  header:    { backgroundColor: Colors.surface, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  eyebrow:   { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 1.5, marginBottom: 4 },
  title:     { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  statsBar:  { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: 14, padding: 14 },
  statBlock: { flex: 1, alignItems: 'center' },
  statBig:   { fontSize: 22, fontWeight: '800' },
  statSml:   { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  statSep:   { width: 1, height: 32, backgroundColor: Colors.border },

  // Section row
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  addBtn:       { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnTxt:    { color: Colors.text, fontWeight: '700', fontSize: 13 },

  // Search
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: 16, marginBottom: 10, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.border },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 12 },
  searchClear: { fontSize: 14, color: Colors.textSecondary, paddingLeft: 8 },

  // Filter panel
  filterPanel:     { marginHorizontal: 16, marginBottom: 10, backgroundColor: Colors.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border },
  filterTabs:      { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: 10, padding: 3, marginBottom: 12 },
  filterTab:       { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  filterTabActive: { backgroundColor: Colors.surface, elevation: 2 },
  filterTabTxt:    { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  filterTabTxtActive: { color: Colors.text, fontWeight: '700' },
  chipGroup:    { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  chip:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginRight: 8, marginBottom: 6 },
  chipOn:       { backgroundColor: Colors.success + '20', borderColor: Colors.success },
  chipSort:     { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  chipDot:      { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  chipTxt:      { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTxtOn:    { color: Colors.success, fontWeight: '700' },
  chipTxtSort:  { color: Colors.primary, fontWeight: '700' },
  resultsTxt:   { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', opacity: 0.7 },

  // Firm Card
  card:      { backgroundColor: Colors.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  cardRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar:    { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary + '30', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarTxt: { fontSize: 20, fontWeight: '800', color: Colors.primary },
  cardName:  { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  badge:     { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dot:       { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  badgeTxt:  { fontSize: 11, fontWeight: '700' },
  chevron:   { fontSize: 11, color: Colors.textSecondary },
  statsRow:  { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: 10, padding: 10 },
  statItem:  { flex: 1, alignItems: 'center' },
  statVal:   { fontSize: 16, fontWeight: '800', color: Colors.text },
  statLbl:   { fontSize: 10, color: Colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  statDiv:   { width: 1, backgroundColor: Colors.border },

  // Expanded detail
  detail:    { marginTop: 14, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  detailIcon: { fontSize: 16, marginRight: 12, marginTop: 2 },
  detailLbl:  { fontSize: 11, color: Colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  detailVal:  { fontSize: 15, fontWeight: '600', color: Colors.text },
  orgIdVal:   { fontSize: 13, color: Colors.text, fontFamily: 'monospace' },
  copyIdBtn:  { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primary + '20', borderWidth: 1, borderColor: Colors.primary + '50' },
  copyIdBtnTxt: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  detailSub:  { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  toggle:     { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  toggleTxt:  { fontSize: 14, fontWeight: '700' },

  actionGrid: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn:  { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  actionBtnTxt: { fontSize: 13, fontWeight: '700' },

  divider:    { height: 1, backgroundColor: Colors.border, width: '100%' },
  helperText: { color: Colors.textSecondary, fontSize: 11, marginTop: 4, fontStyle: 'italic' },

  localError: {
    backgroundColor: Colors.error + '15',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  localErrorTxt: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Empty
  empty:      { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTxt:   { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptySubTxt: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn:    { marginTop: 20, backgroundColor: Colors.error + '20', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.error + '40' },
  retryBtnTxt: { color: Colors.error, fontWeight: '700', fontSize: 14 },

  // Create Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: Colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' },
  modalTitle:   { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 20, textAlign: 'center' },
  inputGroup:   { marginBottom: 16 },
  inputLabel:   { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
  input:        { backgroundColor: Colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border },
  modalActions: { flexDirection: 'row', marginTop: 8, marginBottom: 20 },
  cancelBtn:    { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, marginRight: 10 },
  cancelBtnTxt: { color: Colors.textSecondary, fontWeight: '700', fontSize: 15 },
  saveBtn:      { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.primary },
  saveBtnTxt:   { color: Colors.text, fontWeight: '700', fontSize: 15 },
  closeModal:   { position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  closeModalTxt: { color: Colors.textSecondary, fontSize: 18, fontWeight: '300' },
});
