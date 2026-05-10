import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import client from '../api/client';
import { useMetaConnect, MetaPage } from '../hooks/useMetaConnect';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';

interface DialogCfg {
  visible: boolean; icon: string; title: string;
  message: string; confirmLabel: string;
  confirmColor: string; onConfirm: () => void;
}
const HIDDEN_DLG: DialogCfg = {
  visible: false, icon: '', title: '', message: '',
  confirmLabel: '', confirmColor: Colors.primary, onConfirm: () => {},
};

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

const roleConfig: Record<string, { label: string; color: string; emoji: string }> = {
  superadmin: { label: 'Platform Owner', color: '#a855f7', emoji: '👑' },
  admin:      { label: 'Firm Admin', color: Colors.primary, emoji: '🏢' },
  staff:      { label: 'Sales Staff',    color: Colors.success, emoji: '👤' },
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

export const ProfileScreen = ({ navigation }: { navigation: any }) => {
  const { user, logout } = useAuth();
  const role = roleConfig[user?.role ?? 'staff'] ?? roleConfig.staff;
  const [dialog, setDialog] = useState<DialogCfg>(HIDDEN_DLG);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectedPage, setConnectedPage] = useState<MetaPage | null>(null);
  const [showPagePicker, setShowPagePicker] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<any>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await client.get('/auth/organization');
      if (res.data.success) {
        setOrgData(res.data.data);
        if (res.data.data.meta_config?.page_id) {
          // If we have a page ID, it's connected
          setSaveSuccess(true);
        }
      }
    } catch (e) {
      console.error('[Profile] Fetch Error:', e);
    }
  }, []);

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const { connect, savePage, pages, loading: metaLoading, error: metaError, setError: setMetaError } = useMetaConnect();

  // Watch for pages coming in from the Facebook connect hook
  React.useEffect(() => {
    if (pages && pages.length > 0) {
      setShowPagePicker(true);
    }
  }, [pages]);

  const closeDialog = useCallback(() => setDialog(HIDDEN_DLG), []);

  const openIntegrations = () => {
    console.log('[Profile] Opening Integrations Modal');
    setLocalError(null);
    setSaveSuccess(false);
    setShowIntegrations(true);
  };

  const handleConnectFacebook = async () => {
    console.log('[Profile] Facebook Button Tapped');
    setLocalError(null);
    setMetaError(null);
    await connect();
  };

  const handleSelectPage = async (page: MetaPage) => {
    setShowPagePicker(false);
    const ok = await savePage(page);
    if (ok) {
      setConnectedPage(page);
      setSaveSuccess(true);
    } else {
      setLocalError('Failed to save page. Please try again.');
    }
  };

  const handleLogout = () => {
    setDialog({
      visible: true,
      icon: '↩',
      title: 'Confirm Logout',
      message: 'Are you sure you want to sign out of your account?',
      confirmLabel: 'Logout',
      confirmColor: Colors.error,
      onConfirm: logout,
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <Dialog cfg={dialog} onCancel={closeDialog} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Profile</Text>
        <Text style={styles.pageSubtitle}>Your account details & settings</Text>
      </View>

      {/* ── Avatar Card ── */}
      <View style={styles.avatarCard}>
        <View style={[styles.avatarCircle, { backgroundColor: role.color + '25', borderColor: role.color + '60' }]}>
          <Text style={styles.avatarEmoji}>{role.emoji}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'User'}</Text>
        <View style={[styles.rolePill, { backgroundColor: role.color + '20' }]}>
          <Text style={[styles.rolePillText, { color: role.color }]}>
            {role.label}
          </Text>
        </View>
      </View>

      {/* ── Info Panel ── */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Account Information</Text>
        <InfoRow label="Mobile" value={user?.mobile || '—'} />
        {user?.email ? <InfoRow label="Email" value={user.email} /> : null}
        <InfoRow label="Role" value={role.label} />
      </View>

      {/* ── Integrations (Admin Only) ── */}
      {user?.role === 'admin' && (
        <View style={styles.actionsPanel}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.panelTitle}>Marketing Integrations</Text>
            {orgData?.meta_config?.page_id && (
              <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                <Text style={[styles.statusText, { color: Colors.success }]}>Active</Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity style={styles.actionRow} onPress={openIntegrations} activeOpacity={0.7}>
            <View style={[styles.actionIconWrap, { backgroundColor: '#1877F220' }]}>
              <Text style={[styles.actionIcon, { color: '#1877F2' }]}>f</Text>
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>
                {orgData?.meta_config?.page_id ? 'Facebook Page Linked' : 'Connect Facebook Ads'}
              </Text>
              <Text style={styles.actionDesc}>
                {orgData?.meta_config?.page_id 
                  ? 'Automatic lead sync is active' 
                  : 'Manage Facebook lead synchronization'}
              </Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Actions ── */}
      <View style={styles.actionsPanel}>
        <Text style={styles.panelTitle}>Security</Text>

        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation.navigate('PasswordChange')}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: Colors.primary + '20' }]}>
            <Text style={styles.actionIcon}>🔑</Text>
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionTitle}>Change Password</Text>
            <Text style={styles.actionDesc}>Update your login credentials</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.actionRow}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: Colors.error + '20' }]}>
            <Text style={styles.actionIcon}>↩</Text>
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={[styles.actionTitle, { color: Colors.error }]}>Logout</Text>
            <Text style={styles.actionDesc}>Sign out of your account</Text>
          </View>
          <Text style={[styles.actionChevron, { color: Colors.error }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Footer ── */}
      <Text style={styles.footer}>Real Estate CRM · v1.0.0</Text>
      </ScrollView>

      {/* ── Integrations Modal ── */}
      <Modal visible={showIntegrations} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowIntegrations(false)}>
              <Text style={styles.closeBtnTxt}>✕</Text>
            </TouchableOpacity>
            
            <Text style={styles.modalTitle}>🔗 Meta Integration</Text>
            <Text style={styles.modalSubtitle}>Connect your Facebook Page to automatically receive leads from your ads.</Text>

            {(localError || metaError) && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{localError || metaError}</Text>
              </View>
            )}

            {saveSuccess && connectedPage ? (
              <View style={styles.successBox}>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.successTitle}>Connected!</Text>
                <Text style={styles.successDesc}>{connectedPage.name}</Text>
                <Text style={styles.successSub}>Leads from this page will now flow into your CRM automatically.</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.fbBtn, { opacity: metaLoading ? 0.6 : 1 }]}
                onPress={handleConnectFacebook}
                disabled={metaLoading}
              >
                {metaLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.fbBtnIcon}>🔵</Text>
                    <Text style={styles.fbBtnTxt}>Connect with Facebook</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={styles.divider} />

          </View>
        </View>
      </Modal>

      {/* ── Page Picker Modal ── */}
      <Modal visible={showPagePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={styles.modalTitle}>Select a Page</Text>
              <TouchableOpacity onPress={() => setShowPagePicker(false)}>
                <Text style={styles.closeBtnTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Choose the Facebook Page to connect for lead capture:</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {pages.map(page => (
                <TouchableOpacity
                  key={page.id}
                  style={styles.pageCard}
                  onPress={() => handleSelectPage(page)}
                >
                  <View style={styles.pageIconWrap}>
                    <Text style={{ fontSize: 22 }}>📝</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pageName}>{page.name}</Text>
                    <Text style={styles.pageCategory}>{page.category}</Text>
                  </View>
                  <Text style={{ color: Colors.primary, fontSize: 22 }}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Header
  header: { marginBottom: 24 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.text },
  pageSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },

  // Avatar Card
  avatarCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingVertical: 28,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 14,
  },
  avatarEmoji: { fontSize: 36 },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  rolePill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Info Panel
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },

  // Actions Panel
  actionsPanel: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionIcon: { fontSize: 18 },
  actionTextWrap: { flex: 1 },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  actionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionChevron: {
    fontSize: 22,
    color: Colors.textSecondary,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },

  // Footer
  footer: {
    color: Colors.textSecondary,
    opacity: 0.5,
  },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: Colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%' },
  closeBtn:     { position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  closeBtnTxt:  { color: Colors.textSecondary, fontSize: 18, fontWeight: '300' },
  modalTitle:   { fontSize: 22, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 24, lineHeight: 18 },
  inputLabel:   { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input:        { backgroundColor: Colors.background, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 15, borderWidth: 1, borderColor: Colors.border },
  helperText:   { color: Colors.textSecondary, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  saveBtn:      { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 32, marginBottom: 20 },
  saveBtnTxt:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  errorBox:     { backgroundColor: Colors.error + '15', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.error + '30' },
  errorText:    { color: Colors.error, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Facebook Connect
  fbBtn:        { backgroundColor: '#1877F2', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  fbBtnIcon:    { fontSize: 20 },
  fbBtnTxt:     { color: '#fff', fontSize: 16, fontWeight: '800' },
  successBox:   { alignItems: 'center', paddingVertical: 24 },
  successIcon:  { fontSize: 48, marginBottom: 8 },
  successTitle: { fontSize: 22, fontWeight: '800', color: Colors.success, marginBottom: 4 },
  successDesc:  { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  successSub:   { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  // Page Picker
  pageCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  pageIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1877F220', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  pageName:     { fontSize: 15, fontWeight: '700', color: Colors.text },
  pageCategory: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  
  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
