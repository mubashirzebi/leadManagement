import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

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
    <View style={dlgStyles.backdrop}>
      <View style={dlgStyles.card}>
        <Text style={dlgStyles.icon}>{cfg.icon}</Text>
        <Text style={dlgStyles.title}>{cfg.title}</Text>
        <Text style={dlgStyles.msg}>{cfg.message}</Text>
        <View style={dlgStyles.row}>
          <TouchableOpacity 
            onPress={() => { onCancel(); cfg.onConfirm(); }}
            style={[dlgStyles.confirm, { backgroundColor: cfg.confirmColor, width: '100%' }]}
          >
            <Text style={dlgStyles.confirmTxt}>{cfg.confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const dlgStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  card:     { width: '100%', backgroundColor: Colors.surface, borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  icon:     { fontSize: 44, marginBottom: 12 },
  title:    { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 8, textAlign: 'center' },
  msg:      { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  row:      { flexDirection: 'row', width: '100%' },
  confirm:    { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  confirmTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

export const PasswordChangeScreen = ({ navigation }: { navigation: any }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<DialogCfg>(HIDDEN_DLG);
  const { login, token, user } = useAuth();

  const handleUpdate = async () => {
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await client.patch('/auth/update-password', { newPassword: password });
      if (response.data.success) {
        setDialog({
          visible: true,
          icon: '✅',
          title: 'Password Updated',
          message: 'Your new password has been set successfully.',
          confirmLabel: 'Great',
          confirmColor: Colors.success,
          onConfirm: async () => {
            if (user) {
              await login(token!, { ...user, must_change_password: false });
            }
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Profile');
            }
          },
        });
      } else {
        setError(response.data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Dialog cfg={dialog} onCancel={() => setDialog(HIDDEN_DLG)} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
      <View style={styles.card}>
        <Text style={styles.title}>Secure Your Account</Text>
        <Text style={styles.subtitle}>Since this is your first login, please set a new password.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor={Colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Repeat password"
            placeholderTextColor={Colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={styles.button}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.buttonText}>Set New Password</Text>
          )}
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: 30,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 32,
    lineHeight: 20,
  },
  error: {
    color: Colors.error,
    marginBottom: 20,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
});
