import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import client from '../api/client';
import { Colors } from '../theme/colors';
import { Staff } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (assigneeIds: string[], assigneeNames: string[]) => void;
  selectedAssigneeIds: string[];
}

export const MultiStaffPickerModal = ({ visible, onClose, onConfirm, selectedAssigneeIds }: Props) => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await client.get('/users');
      if (res.data.success) setStaff(res.data.data);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchStaff();
      setSearchText('');
      setSelectedIds(new Set(selectedAssigneeIds));
    }
  }, [visible]);

  const filtered = useMemo(() => {
    if (!searchText.trim()) return staff;
    return staff.filter(s => s.name.toLowerCase().includes(searchText.toLowerCase()));
  }, [staff, searchText]);

  const toggleStaff = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const areAllFilteredSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s._id));

  const toggleSelectAll = () => {
    if (areAllFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(s => next.delete(s._id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(s => next.add(s._id));
        return next;
      });
    }
  };

  const handleConfirm = () => {
    const selectedStaff = staff.filter(s => selectedIds.has(s._id));
    onConfirm(
      selectedStaff.map(s => s._id),
      selectedStaff.map(s => s.name),
    );
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>Select Staff</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search staff..."
            placeholderTextColor={Colors.textSecondary}
            style={styles.searchInput}
          />

          {/* Select All / Deselect All */}
          <TouchableOpacity
            style={[styles.selectAllRow, areAllFilteredSelected && styles.selectAllRowActive]}
            onPress={toggleSelectAll}
          >
            <View style={[styles.checkbox, areAllFilteredSelected && styles.checkboxChecked]}>
              {areAllFilteredSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.selectAllText}>
              {areAllFilteredSelected ? 'Deselect All' : 'Select All'}
            </Text>
            <Text style={styles.selectAllCount}>({selectedIds.size} selected)</Text>
          </TouchableOpacity>

          {/* Staff List */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 20 }} />
            ) : filtered.length === 0 ? (
              <Text style={styles.emptyText}>No staff found</Text>
            ) : (
              filtered.map(s => {
                const isSelected = selectedIds.has(s._id);
                return (
                  <TouchableOpacity
                    key={s._id}
                    style={[styles.item, isSelected && styles.itemSelected]}
                    onPress={() => toggleStaff(s._id)}
                  >
                    <View style={styles.itemContent}>
                      <Text style={styles.itemName}>👤 {s.name}</Text>
                      {s.mobile ? <Text style={styles.itemSub}>{s.mobile}</Text> : null}
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Bottom Buttons */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>
                Confirm{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.text,
  },
  closeBtn: {
    fontSize: 20,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  searchInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectAllRowActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '12',
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    marginLeft: 10,
  },
  selectAllCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  list: {
    maxHeight: 350,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 4,
    backgroundColor: Colors.background,
  },
  itemSelected: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    backgroundColor: Colors.primary + '0A',
  },
  itemContent: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  itemSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  buttonsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  confirmText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});