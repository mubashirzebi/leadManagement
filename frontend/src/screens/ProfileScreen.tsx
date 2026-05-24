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
  platform_owner: { label: 'Platform Owner', color: '#a855f7', emoji: '👑' },
  superadmin:     { label: 'SuperAdmin',     color: Colors.primary, emoji: '🏢' },
  admin:          { label: 'Admin',          color: Colors.warning, emoji: '💼' },
  staff:          { label: 'Staff',          color: Colors.success, emoji: '👤' },
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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<any>(null);

  // Step 1: User Access Token input
  const [userTokenInput, setUserTokenInput] = useState('');
  // Step 2: Page list and selection
  const [fetchingPages, setFetchingPages] = useState(false);
  const [pagesList, setPagesList] = useState<any[]>([]);
  const [pageTokens, setPageTokens] = useState<Record<string, string>>({});
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [connectedPageNames, setConnectedPageNames] = useState<string[]>([]);

  const fetchProfile = useCallback(async () => {
    try {
      // Trying to fetch the user's organization to populate existing config
      const res = await client.get('/auth/organization').catch(() => null);
      if (res?.data?.success) {
        setOrgData(res.data.data);
        const activePages = (res.data.data.meta_config?.pages || []).filter((p: any) => p.is_active !== false);
        if (activePages.length > 0) {
          setSaveSuccess(true);
          setConnectedPageNames(activePages.map((p: any) => p.page_name));
        } else {
          setSaveSuccess(false);
          setConnectedPageNames([]);
        }
      }
    } catch (e) {
      console.error('[Profile] Fetch Error:', e);
    }
  }, []);

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const closeDialog = useCallback(() => setDialog(HIDDEN_DLG), []);

  const openIntegrations = () => {
    setLocalError(null);
    setSaveSuccess(false);
    setPagesList([]);
    setPageTokens({});
    setSelectedPageIds([]);
    setUserTokenInput('');
    setShowIntegrations(true);
  };

  const handleUnlinkPage = async (pageId: string, pageName: string) => {
    setDialog({
      visible: true,
      icon: '🔗',
      title: 'Unlink Facebook Page',
      message: `Are you sure you want to stop syncing leads from "${pageName}"? You can re-link it later.`,
      confirmLabel: 'Unlink Page',
      confirmColor: Colors.error,
      onConfirm: async () => {
        setDialog(HIDDEN_DLG);
        try {
          const res = await client.post('/integrations/meta/unlink', { page_id: pageId });
          if (res.data.success) {
            // Update profile details
            const orgRes = await client.get('/auth/organization').catch(() => null);
            if (orgRes?.data?.success) {
              setOrgData(orgRes.data.data);
              const activePages = (orgRes.data.data.meta_config?.pages || []).filter((p: any) => p.is_active !== false);
              setConnectedPageNames(activePages.map((p: any) => p.page_name));
            }
            Alert.alert('Success', `Unlinked page "${pageName}" successfully.`);
          }
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.message || 'Failed to unlink page.');
        }
      }
    });
  };

  const handleLinkPage = async (pageId: string, pageName: string) => {
    try {
      const res = await client.post('/integrations/meta/link', { page_id: pageId });
      if (res.data.success) {
        // Update profile details
        const orgRes = await client.get('/auth/organization').catch(() => null);
        if (orgRes?.data?.success) {
          setOrgData(orgRes.data.data);
          const activePages = (orgRes.data.data.meta_config?.pages || []).filter((p: any) => p.is_active !== false);
          setConnectedPageNames(activePages.map((p: any) => p.page_name));
        }
        Alert.alert('Success', `Linked page "${pageName}" successfully.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to link page.');
    }
  };

  const handleLinkPageNew = async (pageId: string, pageName: string, pageAccessToken: string) => {
    try {
      const res = await client.post('/integrations/meta/link', {
        page_id: pageId,
        page_name: pageName,
        access_token: pageAccessToken
      });
      if (res.data.success) {
        // Update profile
        const orgRes = await client.get('/auth/organization').catch(() => null);
        if (orgRes?.data?.success) {
          setOrgData(orgRes.data.data);
          const activePages = (orgRes.data.data.meta_config?.pages || []).filter((p: any) => p.is_active !== false);
          setConnectedPageNames(activePages.map((p: any) => p.page_name));
        }
        Alert.alert('Success', `Linked page "${pageName}" successfully.`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to link page.');
    }
  };

  // Step 1: Fetch pages from Meta using the user token
  const handleFetchPages = async () => {
    if (!userTokenInput.trim()) {
      setLocalError('Please paste your User Access Token');
      return;
    }
    setFetchingPages(true);
    setLocalError(null);
    setPagesList([]);
    try {
      const res = await client.post('/integrations/meta/pages', {
        user_access_token: userTokenInput.trim(),
      });
      if (res.data.success) {
        setPagesList(res.data.data);
        setPageTokens(res.data._pageTokens || {});
        // Select all by default if there's only 1
        if (res.data.data.length === 1) {
          setSelectedPageIds([res.data.data[0].id]);
        }
      } else {
        setLocalError(res.data.message || 'Failed to fetch pages');
      }
    } catch (e: any) {
      setLocalError(e.response?.data?.message || 'Failed to fetch pages. Check your token.');
    } finally {
      setFetchingPages(false);
    }
  };

  const handleTogglePage = (id: string) => {
    setSelectedPageIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedPageIds.length === pagesList.length) {
      setSelectedPageIds([]); // deselect all
    } else {
      setSelectedPageIds(pagesList.map(p => p.id)); // select all
    }
  };

  // Step 2: Connect the selected pages
  const handleConnectPage = async () => {
    if (selectedPageIds.length === 0) {
      setLocalError('Please select at least one Facebook Page');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      const pagesPayload = selectedPageIds.map(id => {
        const page = pagesList.find(p => p.id === id);
        return {
          page_id: id,
          page_name: page?.name || 'Unknown Page',
          access_token: pageTokens[id] || userTokenInput,
        };
      });

      const res = await client.post('/integrations/meta/connect', {
        pages: pagesPayload,
      });

      if (res.data.success) {
        setSaveSuccess(true);
        const savedPages = res.data.data?.pages || pagesPayload;
        setConnectedPageNames(savedPages.map((p: any) => p.page_name));
        setOrgData((prev: any) => ({ ...prev, meta_config: { pages: savedPages } }));
      } else {
        setLocalError(res.data.message || 'Failed to connect');
      }
    } catch (e: any) {
      setLocalError(e.response?.data?.message || 'Failed to connect to Meta');
    } finally {
      setSaving(false);
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

  const hasPages = pagesList.length > 0;
  const isAllSelected = hasPages && selectedPageIds.length === pagesList.length;

  const connectedPages = orgData?.meta_config?.pages || [];
  const activePages = connectedPages.filter((p: any) => p.is_active !== false);
  const inactivePages = connectedPages.filter((p: any) => p.is_active === false);

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
 
      {/* ── Integrations (Agency Owner Only) ── */}
      {user?.role === 'superadmin' && (
        <View style={styles.actionsPanel}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.panelTitle}>Marketing Integrations</Text>
            {activePages.length > 0 && (
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
              <Text style={styles.actionTitle}>Facebook Lead Sync</Text>
              <Text style={styles.actionDesc}>
                {activePages.length > 0 
                  ? `Automatic lead sync active for ${activePages.length} page(s)` 
                  : 'Connect Facebook lead synchronization'}
              </Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          {/* Render linked pages list directly in the profile screen */}
          {activePages.length > 0 && (
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 }}>
                Linked Facebook Pages
              </Text>
              {activePages.map((page: any) => (
                <View key={page.page_id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success }} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.text }}>{page.page_name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleUnlinkPage(page.page_id, page.page_name)}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.error }}>Unlink</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Render inactive/previously connected pages that can be instantly re-linked */}
          {inactivePages.length > 0 && (
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 8 }}>
                Previously Linked Pages
              </Text>
              {inactivePages.map((page: any) => (
                <View key={page.page_id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: 0.6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textSecondary }} />
                    <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.textSecondary }}>{page.page_name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleLinkPage(page.page_id, page.page_name)}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>Re-link</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
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
            <Text style={styles.modalSubtitle}>Connect your Facebook Pages to automatically receive leads from your ads.</Text>

            {pagesList.length === 0 ? (
              <>
                {/* ── STEP 1: Paste User Access Token ── */}
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>STEP 1</Text>
                </View>
                <Text style={styles.inputLabel}>User Access Token</Text>
                <TextInput
                  style={[styles.input, { height: 100 }]}
                  placeholder="Paste your User Access Token from Facebook Graph API Explorer..."
                  placeholderTextColor={Colors.textSecondary}
                  value={userTokenInput}
                  onChangeText={setUserTokenInput}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.helperText}>
                  Get this from developers.facebook.com → Graph API Explorer → Generate User Token with leads_retrieval & pages_show_list permissions.
                </Text>

                <TouchableOpacity
                  style={[styles.fbBtn, { opacity: fetchingPages ? 0.6 : 1 }]}
                  onPress={handleFetchPages}
                  disabled={fetchingPages}
                >
                  {fetchingPages ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.fbBtnIcon}>f</Text>
                      <Text style={styles.fbBtnTxt}>Fetch My Pages</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* ── STEP 2: Manage Pages ── */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={[styles.stepBadge, { marginBottom: 0 }]}>
                    <Text style={styles.stepBadgeText}>STEP 2 — MANAGE PAGES</Text>
                  </View>
                </View>

                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                  {pagesList.map((page: any) => {
                    const isLinked = (orgData?.meta_config?.pages || []).some(
                      (p: any) => p.page_id === page.id && p.is_active !== false
                    );

                    return (
                      <View
                        key={page.id}
                        style={[
                          styles.pageCard,
                          isLinked && { borderColor: Colors.success, borderWidth: 1, backgroundColor: Colors.success + '05' }
                        ]}
                      >
                        <View style={styles.pageIconWrap}>
                          <Text style={{ fontSize: 20, color: '#1877F2' }}>f</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pageName}>{page.name}</Text>
                          <Text style={styles.pageCategory}>{page.category}</Text>
                        </View>
                        
                        {isLinked ? (
                          <TouchableOpacity
                            onPress={() => handleUnlinkPage(page.id, page.name)}
                            style={{ backgroundColor: Colors.error + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                          >
                            <Text style={{ color: Colors.error, fontSize: 12, fontWeight: '700' }}>Unlink</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleLinkPageNew(page.id, page.name, pageTokens[page.id] || userTokenInput)}
                            style={{ backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Link</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={[styles.saveBtn, { marginTop: 16, backgroundColor: Colors.success }]}
                  onPress={() => setShowIntegrations(false)}
                >
                  <Text style={styles.saveBtnTxt}>Done</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.diagBtn, { marginTop: 0 }]}
                  onPress={() => {
                    setPagesList([]);
                    setPageTokens({});
                    setSelectedPageIds([]);
                  }}
                >
                  <Text style={styles.diagBtnTxt}>← Back to Token Input</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.divider} />

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

  // Diagnostic test button
  diagBtn: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  diagBtnTxt: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  diagBtnNote: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
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

  // Step Badge
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  stepBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
