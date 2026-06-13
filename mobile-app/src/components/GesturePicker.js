import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { GESTURES } from '../config/arm';

export default function GesturePicker({ sequences = {}, selectedGesture = null, onSelect, onDelete }) {
  return (
    <ScrollView scrollEnabled={false}>
      {GESTURES.map((gesture) => {
        const isProgrammed = !!sequences[gesture.key];
        const isSelected = selectedGesture === gesture.key;

        return (
          <TouchableOpacity
            key={gesture.key}
            style={[styles.card, isProgrammed && styles.cardProgrammed, isSelected && styles.cardSelected]}
            onPress={() => onSelect(gesture)}
            activeOpacity={0.78}
          >
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{gesture.shortLabel}</Text>
            </View>

            <View style={styles.info}>
              <Text style={styles.name}>{gesture.label}</Text>
              <Text style={styles.desc}>{gesture.description}</Text>
              {isProgrammed && <Text style={styles.programmedBadge}>{sequences[gesture.key].length} steps recorded</Text>}
            </View>

            {isProgrammed && onDelete && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={(event) => {
                  event.stopPropagation();
                  onDelete(gesture.key);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardProgrammed: { borderLeftWidth: 4, borderLeftColor: '#00b894' },
  cardSelected: { borderColor: '#0984e3', backgroundColor: '#f0f7ff' },
  codeBadge: {
    width: 58,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#edf3f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  codeText: { fontSize: 11, color: '#2d3436', fontWeight: '800' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#2d3436', marginBottom: 2 },
  desc: { fontSize: 12, color: '#636e72', marginBottom: 4 },
  programmedBadge: { fontSize: 12, color: '#00a383', fontWeight: '700' },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff5f5', borderRadius: 8, marginLeft: 8 },
  deleteBtnText: { color: '#d63031', fontSize: 12, fontWeight: '700' },
});
