import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  RefreshControl,
  ScrollView 
} from 'react-native';
import { Colors } from '../theme/colors';
import client from '../api/client';
import { Lead } from '../types';

export const LeadListScreen = ({ navigation }: { navigation: any }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedTemp, setSelectedTemp] = useState('All');

  const statuses = ['All', 'New', 'Contacted', 'Qualified', 'Lost', 'Closed'];
  const temperatures = ['All', 'Hot', 'Warm', 'Cold'];

  const fetchLeads = async () => {
    try {
      const statusParam = selectedStatus === 'All' ? '' : selectedStatus;
      const tempParam = selectedTemp === 'All' ? '' : selectedTemp;
      const response = await client.get(`/leads?search=${search}&status=${statusParam}&temperature=${tempParam}`);
      if (response.data.success) {
        setLeads(response.data.data);
      }
    } catch (error) {
      console.error('Fetch leads failed', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [search, selectedStatus, selectedTemp]);

  const renderLeadItem = ({ item }: { item: Lead }) => (
    <TouchableOpacity 
      style={styles.leadCard}
      onPress={() => navigation.navigate('LeadDetail', { lead: item })}
    >
      <View style={styles.leadInfo}>
        <Text style={styles.leadName}>{item.name}</Text>
        <Text style={styles.leadMobile}>{item.mobile}</Text>
        {item.project ? <Text style={styles.leadProject}>{item.project}</Text> : null}
      </View>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Leads</Text>
        <TextInput
          style={styles.searchBar}
          placeholder="Search name or mobile..."
          placeholderTextColor={Colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterBar}
          contentContainerStyle={styles.filterContent}
        >
          {statuses.map((s) => (
            <TouchableOpacity 
              key={s} 
              onPress={() => setSelectedStatus(s)}
              style={[
                styles.filterChip,
                selectedStatus === s && styles.activeFilterChip
              ]}
            >
              <Text style={[
                styles.filterText,
                selectedStatus === s && styles.activeFilterText
              ]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={[styles.filterBar, { marginTop: 12 }]}
          contentContainerStyle={styles.filterContent}
        >
          {temperatures.map((t) => (
            <TouchableOpacity 
              key={t} 
              onPress={() => setSelectedTemp(t)}
              style={[
                styles.filterChip,
                selectedTemp === t && { backgroundColor: t === 'Hot' ? Colors.error : t === 'Warm' ? Colors.warning : Colors.primary, borderColor: 'transparent' }
              ]}
            >
              <Text style={[
                styles.filterText,
                selectedTemp === t && styles.activeFilterText
              ]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && leads.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item._id}
          renderItem={renderLeadItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchLeads} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No leads found.</Text>
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('AddLead')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 16,
  },
  searchBar: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBar: {
    marginTop: 16,
    marginHorizontal: -24,
  },
  filterContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterChip: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeFilterChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  activeFilterText: {
    color: Colors.text,
  },
  list: {
    padding: 16,
  },
  leadCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  leadMobile: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  leadProject: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    backgroundColor: Colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '400',
    marginTop: -4,
  },
});
