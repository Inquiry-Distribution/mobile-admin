import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS }                         from '@constants/colors';
import { TYPOGRAPHY, FONTS }              from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW } from '@constants/config';
import useGroupStore from '@store/group.store';

export default function CreateGroupScreen({ navigation }) {
  const { createGroup, isMutating } = useGroupStore();
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Group name is required.');
      return;
    }
    const result = await createGroup({ name: name.trim(), description: description.trim() });
    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert('Error', result.message || 'Failed to create group.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Group Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Query Group, Report Group…"
          placeholderTextColor={COLORS.textMuted}
          value={name}
          onChangeText={setName}
          maxLength={60}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="What is this group for? (optional)"
          placeholderTextColor={COLORS.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={200}
        />

        <Text style={styles.hint}>
          After creating the group, go to Members to add salespersons.
        </Text>

        <TouchableOpacity
          style={[styles.btn, isMutating && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={isMutating}
          activeOpacity={0.85}
        >
          {isMutating
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.btnText}>Create Group</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, gap: SPACING.xs },

  label: {
    ...TYPOGRAPHY.bodyMedium,
    fontFamily:   FONTS.medium,
    color:        COLORS.textPrimary,
    marginTop:    SPACING.md,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor:  COLORS.surface,
    borderRadius:     BORDER_RADIUS.md,
    borderWidth:      1,
    borderColor:      COLORS.border,
    paddingHorizontal: SPACING.md,
    height:           46,
    ...TYPOGRAPHY.body,
    color:            COLORS.textPrimary,
    ...SHADOW.sm,
  },
  inputMulti: {
    height:      90,
    paddingTop:  SPACING.sm,
    textAlignVertical: 'top',
  },
  hint: {
    ...TYPOGRAPHY.caption,
    color:      COLORS.textMuted,
    marginTop:  SPACING.sm,
  },
  btn: {
    marginTop:       SPACING.xl,
    height:          50,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    ...TYPOGRAPHY.bodyMedium,
    color:      COLORS.white,
    fontFamily: FONTS.bold,
  },
});
