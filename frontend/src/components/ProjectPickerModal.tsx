import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator
} from 'react-native';
import client from '../api/client';
import { Colors } from '../theme/colors';
import { Project } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (project: Project | null, customName?: string) => void;
  selectedProjectId?: string;
}

export const ProjectPickerModal = ({ visible, onClose, onSelect, selectedProjectId }: Props) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await client.get('/projects?status=active');
      if (res.data.success) setProjects(res.data.data);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (visible) {
      fetchProjects();
      setSearchText('');
      setShowCustomInput(false);
      setCustomName('');
    }
  }, [visible]);

  const filtered = searchText.trim()
    ? projects.filter(p => p.name.toLowerCase().includes(searchText.toLowerCase()))
    : projects;

  const handleSelect = (project: Project) => {
    onSelect(project);
    onClose();
  };

  const handleCustom = () => {
    if (customName.trim()) {
      onSelect(null, customName.trim());
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Select Project</Text>

          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search projects..."
            placeholderTextColor={Colors.textSecondary}
            style={styles.searchInput}
          />

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <>
                {filtered.map(proj => (
                  <TouchableOpacity
                    key={proj._id}
                    style={[styles.item, selectedProjectId === proj._id && styles.itemSelected]}
                    onPress={() => handleSelect(proj)}
                  >
                    <Text style={styles.itemName}>🏗️ {proj.name}</Text>
                    {proj.location ? <Text style={styles.itemSub}>{proj.location}</Text> : null}
                    {proj.builder ? <Text style={styles.itemBuilder}>{proj.builder}</Text> : null}
                  </TouchableOpacity>
                ))}

                {!loading && filtered.length === 0 && searchText.trim() && (
                  <TouchableOpacity style={styles.item} onPress={() => { setCustomName(searchText.trim()); setShowCustomInput(true); }}>
                    <Text style={[styles.itemName, { color: Colors.primary }]}>+ Add "{searchText.trim()}" as custom</Text>
                  </TouchableOpacity>
                )}

                {!showCustomInput && (
                  <TouchableOpacity style={styles.customItem} onPress={() => setShowCustomInput(true)}>
                    <Text style={styles.customItemText}>+ Other (custom project name)</Text>
                  </TouchableOpacity>
                )}

                {showCustomInput && (
                  <View style={styles.customSection}>
                    <TextInput
                      value={customName}
                      onChangeText={setCustomName}
                      placeholder="Type custom project name..."
                      placeholderTextColor={Colors.textSecondary}
                      style={styles.customInput}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[styles.customConfirm, !customName.trim() && { opacity: 0.4 }]}
                      onPress={handleCustom}
                      disabled={!customName.trim()}
                    >
                      <Text style={styles.customConfirmText}>Use Custom</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, maxHeight: '75%' },
  title: { fontSize: 18, fontWeight: '900', color: Colors.text, marginBottom: 12 },
  searchInput: {
    backgroundColor: Colors.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  list: { maxHeight: 350 },
  item: {
    padding: 12, borderRadius: 10, marginBottom: 4,
    backgroundColor: Colors.background,
  },
  itemSelected: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  itemName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  itemSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  itemBuilder: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 1 },
  customItem: {
    padding: 14, borderRadius: 10, marginTop: 4,
    borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed',
    alignItems: 'center',
  },
  customItemText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  customSection: { padding: 12, borderRadius: 10, backgroundColor: Colors.background, marginTop: 4 },
  customInput: {
    backgroundColor: Colors.surface, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  customConfirm: {
    backgroundColor: Colors.primary, borderRadius: 8,
    paddingVertical: 8, alignItems: 'center', marginTop: 8,
  },
  customConfirmText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  cancelBtn: {
    paddingVertical: 12, marginTop: 12,
    borderRadius: 10, backgroundColor: Colors.background,
    alignItems: 'center',
  },
  cancelText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
});