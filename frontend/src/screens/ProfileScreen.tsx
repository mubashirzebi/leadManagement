import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
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
  const closeDialog = useCallback(() => setDialog(HIDDEN_DLG), []);

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
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textSecondary,
    opacity: 0.5,
  },
});
