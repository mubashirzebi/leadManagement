import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, Modal, ActivityIndicator, FlatList
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { Colors } from '../theme/colors';
import { Project, PaginationMeta } from '../types';

interface ConfigDraft {
  type: string;
  size: string;
  price: string;
}

const PAGE_SIZE = 20;

export const ProjectManagementScreen = ({ navigation }: any) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  // Search + pagination
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formBuilder, setFormBuilder] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formConfigs, setFormConfigs] = useState<ConfigDraft[]>([{ type: '', size: '', price: '' }]);

  const canManage = user?.role === 'admin' || user?.role === 'superadmin';

  const fetchProjects = useCallback(async (pageNum: number = 1, search: string = '', append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams();
      if (!showInactive) params.append('status', 'active');
      params.append('page', String(pageNum));
      params.append('limit', String(PAGE_SIZE));
      if (search.trim()) params.append('search', search.trim());

      const res = await client.get(`/projects?${params.toString()}`);

      if (res.data.success) {
        if (append) {
          setProjects(prev => [...prev, ...res.data.data]);
        } else {
          setProjects(res.data.data);
        }
        setPagination(res.data.pagination || null);
        setPage(pageNum);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load projects');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [showInactive]);

  // Initial fetch + on status toggle
  useEffect(() => {
    fetchProjects(1, searchText);
  }, [fetchProjects]);

  // Debounced search
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchProjects(1, text);
    }, 300);
  };

  // Clear search
  const clearSearch = () => {
    setSearchText('');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    fetchProjects(1, '');
  };

  // Load next page
  const handleLoadMore = () => {
    if (loadingMore || !pagination?.hasNext) return;
    fetchProjects(page + 1, searchText, true);
  };

  const openAddModal = () => {
    setEditingProject(null);
    setFormName('');
    setFormLocation('');
    setFormBuilder('');
    setFormDescription('');
    setFormConfigs([{ type: '', size: '', price: '' }]);
    setModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setFormName(project.name);
    setFormLocation(project.location || '');
    setFormBuilder(project.builder || '');
    setFormDescription(project.description || '');
    setFormConfigs(
      project.configurations && project.configurations.length > 0
        ? project.configurations.map(c => ({ type: c.type, size: c.size || '', price: c.price || '' }))
        : [{ type: '', size: '', price: '' }]
    );
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingProject(null);
  };

  const addConfigRow = () => {
    setFormConfigs(prev => [...prev, { type: '', size: '', price: '' }]);
  };

  const updateConfigRow = (index: number, field: keyof ConfigDraft, value: string) => {
    setFormConfigs(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const removeConfigRow = (index: number) => {
    setFormConfigs(prev => prev.filter((_, i) => i !== index));
  };

  const validateAndSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Validation', 'Project name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        location: formLocation.trim() || null,
        builder: formBuilder.trim() || null,
        description: formDescription.trim() || null,
        configurations: formConfigs.filter(c => c.type.trim()).map(c => ({
          type: c.type.trim(),
          size: c.size.trim() || null,
          price: c.price.trim() || null,
        })),
      };

      if (editingProject) {
        await client.put(`/projects/${editingProject._id}`, payload);
      } else {
        await client.post('/projects', payload);
      }

      closeModal();
      fetchProjects();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to save project';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (project: Project) => {
    const newStatus = project.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'inactive' ? 'deactivate' : 'reactivate';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Project`,
      `Are you sure you want to ${action} "${project.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: newStatus === 'inactive' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await client.put(`/projects/${project._id}`, { status: newStatus });
              fetchProjects();
            } catch (err) {
              Alert.alert('Error', 'Failed to update project status');
            }
          },
        },
      ]
    );
  };

  const renderProjectItem = ({ item }: { item: Project }) => (
    <TouchableOpacity
      style={[styles.projectCard, item.status === 'inactive' && styles.projectCardInactive]}
      onPress={() => openEditModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.projectHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.projectName}>{item.name}</Text>
            {item.status === 'inactive' && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Inactive</Text>
              </View>
            )}
          </View>
          {item.location ? <Text style={styles.projectSub}>{item.location}</Text> : null}
          {item.builder ? <Text style={styles.projectBuilder}>{item.builder}</Text> : null}
        </View>
        {canManage && (
          <TouchableOpacity onPress={() => toggleStatus(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: item.status === 'active' ? Colors.error : Colors.success, fontSize: 13, fontWeight: '700' }}>
              {item.status === 'active' ? 'Disable' : 'Enable'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {item.configurations && item.configurations.length > 0 && (
        <View style={styles.configRow}>
          {item.configurations.map((cfg, idx) => (
            <View key={idx} style={styles.configChip}>
              <Text style={styles.configChipType}>{cfg.type}</Text>
              {cfg.size ? <Text style={styles.configChipSize}>{cfg.size}</Text> : null}
              {cfg.price ? <Text style={styles.configChipPrice}>{cfg.price}</Text> : null}
            </View>
          ))}
        </View>
      )}
      {item.description ? <Text style={styles.projectDesc} numberOfLines={2}>{item.description}</Text> : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{canManage ? 'Projects' : 'Project Catalog'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Top Controls */}
      <View style={styles.topControls}>
        {canManage && (
          <TouchableOpacity
            style={[styles.toggleBtn, showInactive && styles.toggleBtnActive]}
            onPress={() => setShowInactive(prev => !prev)}
          >
            <Text style={[styles.toggleBtnText, showInactive && styles.toggleBtnTextActive]}>
              {showInactive ? 'Showing All' : 'Active Only'}
            </Text>
          </TouchableOpacity>
        )}
        {canManage && (
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Text style={styles.addBtnText}>+ Add Project</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects..."
          placeholderTextColor={Colors.textSecondary}
          value={searchText}
          onChangeText={handleSearchChange}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.searchClear}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Project List */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item._id}
          renderItem={renderProjectItem}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ paddingVertical: 16 }} />
            ) : pagination && pagination.totalRecords > PAGE_SIZE ? (
              <Text style={styles.paginationHint}>
                Showing {projects.length} of {pagination.totalRecords} projects
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {searchText ? 'No projects match your search.' : showInactive ? 'No projects found.' : 'No active projects. Tap "Showing All" to see inactive ones.'}
            </Text>
          }
        />
      )}

      {/* Add/Edit Modal (Read-only for staff) */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.dlgBackdrop}>
          <View style={styles.dlgCard}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 600 }}>
              <Text style={styles.dlgTitle}>
                {editingProject ? (canManage ? 'Edit Project' : 'Project Details') : 'Add Project'}
              </Text>

              <Text style={styles.fieldLabel}>Name *</Text>
              {canManage ? (
                <TextInput
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="e.g. Green Valley"
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.input}
                />
              ) : (
                <Text style={styles.readOnlyValue}>{formName || '—'}</Text>
              )}

              <Text style={styles.fieldLabel}>Location</Text>
              {canManage ? (
                <TextInput
                  value={formLocation}
                  onChangeText={setFormLocation}
                  placeholder="e.g. Whitefield, Bangalore"
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.input}
                />
              ) : (
                <Text style={styles.readOnlyValue}>{formLocation || '—'}</Text>
              )}

              <Text style={styles.fieldLabel}>Builder</Text>
              {canManage ? (
                <TextInput
                  value={formBuilder}
                  onChangeText={setFormBuilder}
                  placeholder="e.g. Prestige Group"
                  placeholderTextColor={Colors.textSecondary}
                  style={styles.input}
                />
              ) : (
                <Text style={styles.readOnlyValue}>{formBuilder || '—'}</Text>
              )}

              <Text style={styles.fieldLabel}>Description</Text>
              {canManage ? (
                <TextInput
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="Brief description of the project..."
                  placeholderTextColor={Colors.textSecondary}
                  style={[styles.input, { minHeight: 60 }]}
                  multiline
                />
              ) : (
                <Text style={styles.readOnlyValue}>{formDescription || '—'}</Text>
              )}

              <View style={styles.configSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.fieldLabel}>Configurations</Text>
                  {canManage && (
                    <TouchableOpacity onPress={addConfigRow} style={styles.addConfigBtn}>
                      <Text style={styles.addConfigBtnText}>+ Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {/* Column headers for staff read-only view */}
                {!canManage && formConfigs.length > 0 && formConfigs.some(c => c.type || c.size || c.price) && (
                  <View style={styles.configFormRow}>
                    <View style={{ flex: 2 }}><Text style={styles.configHeaderLabel}>Type</Text></View>
                    <View style={{ flex: 2 }}><Text style={styles.configHeaderLabel}>Size</Text></View>
                    <View style={{ flex: 2 }}><Text style={styles.configHeaderLabel}>Price</Text></View>
                    <View style={{ width: 24 }} />
                  </View>
                )}
                {formConfigs.map((cfg, idx) => (
                  <View key={idx} style={styles.configFormRow}>
                    <View style={{ flex: 2 }}>
                      {canManage ? (
                        <TextInput
                          value={cfg.type}
                          onChangeText={(t) => updateConfigRow(idx, 'type', t)}
                          placeholder="Type (2BHK)"
                          placeholderTextColor={Colors.textSecondary}
                          style={styles.configInput}
                        />
                      ) : (
                        <Text style={styles.readOnlyCfgValue}>{cfg.type || '—'}</Text>
                      )}
                    </View>
                    <View style={{ flex: 2 }}>
                      {canManage ? (
                        <TextInput
                          value={cfg.size}
                          onChangeText={(t) => updateConfigRow(idx, 'size', t)}
                          placeholder="Size (1200 sqft)"
                          placeholderTextColor={Colors.textSecondary}
                          style={styles.configInput}
                        />
                      ) : (
                        <Text style={styles.readOnlyCfgValue}>{cfg.size || '—'}</Text>
                      )}
                    </View>
                    <View style={{ flex: 2 }}>
                      {canManage ? (
                        <TextInput
                          value={cfg.price}
                          onChangeText={(t) => updateConfigRow(idx, 'price', t)}
                          placeholder="Price (80L)"
                          placeholderTextColor={Colors.textSecondary}
                          style={styles.configInput}
                        />
                      ) : (
                        <Text style={styles.readOnlyCfgValue}>{cfg.price || '—'}</Text>
                      )}
                    </View>
                    {canManage && (
                      <TouchableOpacity
                        onPress={() => removeConfigRow(idx)}
                        disabled={formConfigs.length === 1}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={{ color: formConfigs.length === 1 ? Colors.textSecondary : Colors.error, fontSize: 18, fontWeight: '700' }}>
                          ×
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.dlgRow}>
              <TouchableOpacity style={styles.dlgBtnGhost} onPress={closeModal} disabled={saving}>
                <Text style={styles.dlgBtnGhostTxt}>{canManage ? 'Cancel' : 'Close'}</Text>
              </TouchableOpacity>
              {canManage && (
                <TouchableOpacity
                  style={[styles.dlgBtnPrimary, saving && { opacity: 0.7 }]}
                  disabled={saving}
                  onPress={validateAndSave}
                >
                  <Text style={styles.dlgBtnPrimaryTxt}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { padding: 24, paddingTop: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { backgroundColor: Colors.surface, padding: 8, borderRadius: 8 },
  backText: { color: Colors.text, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '900', color: Colors.text },
  topControls: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12,
  },
  toggleBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtnActive: { backgroundColor: Colors.primary + '18', borderColor: Colors.primary },
  toggleBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  toggleBtnTextActive: { color: Colors.primary },
  addBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 16, backgroundColor: Colors.primary,
  },
  addBtnText: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  projectCard: {
    backgroundColor: Colors.surface, borderRadius: 14,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  projectCardInactive: { opacity: 0.55 },
  projectHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  projectName: { fontSize: 16, fontWeight: '800', color: Colors.text },
  inactiveBadge: {
    backgroundColor: Colors.textSecondary + '20',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  inactiveBadgeText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  projectSub: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  projectBuilder: { color: Colors.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  projectDesc: { color: Colors.textSecondary, fontSize: 13, marginTop: 8 },
  configRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  configChip: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  configChipType: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  configChipSize: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  configChipPrice: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: Colors.text,
  },
  searchClear: {
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchClearText: {
    color: Colors.textSecondary, fontSize: 14, fontWeight: '700',
  },
  paginationHint: {
    color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic',
    textAlign: 'center', paddingVertical: 12,
  },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 14 },

  // Modal styles
  dlgBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 20 },
  dlgCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, maxHeight: '85%' },
  dlgTitle: { fontSize: 18, fontWeight: '900', color: Colors.text, marginBottom: 16 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: Colors.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  configSection: { marginTop: 14 },
  addConfigBtn: {
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12, backgroundColor: Colors.primary + '18',
  },
  addConfigBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  configFormRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  configInput: {
    backgroundColor: Colors.background, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 8, fontSize: 13,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  dlgRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  dlgBtnGhost: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  dlgBtnGhostTxt: { color: Colors.textSecondary, fontWeight: '700', fontSize: 14 },
  dlgBtnPrimary: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  dlgBtnPrimaryTxt: { color: Colors.text, fontWeight: '800', fontSize: 14 },

  // Read-only display styles (staff view)
  readOnlyValue: {
    backgroundColor: Colors.background, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  readOnlyCfgValue: {
    backgroundColor: Colors.background, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 8, fontSize: 13,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },

  configHeaderLabel: {
    color: Colors.textSecondary, fontSize: 11, fontWeight: '700',
    marginBottom: 4,
  },
});