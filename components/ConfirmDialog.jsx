import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

// A simple confirmation popup built on Modal.
// (Alert.alert buttons do not work on web, so we use our own dialog.)
//
// Usage:
//   <ConfirmDialog
//     visible={open}
//     title="Log out?"
//     message="You will need to log in again."
//     confirmLabel="Log out"
//     destructive
//     onConfirm={...}
//     onCancel={() => setOpen(false)}
//   />
const ConfirmDialog = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View
          style={styles.card}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              activeOpacity={0.8}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, destructive ? styles.destructiveButton : styles.confirmButton]}
              activeOpacity={0.85}
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 22,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: { color: COLORS.text, fontSize: 19, fontWeight: '800', marginBottom: 8 },
  message: { color: COLORS.textMuted, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 22 },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cancelButton: { borderWidth: 1.5, borderColor: COLORS.border },
  cancelText: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  confirmButton: { backgroundColor: COLORS.primary },
  destructiveButton: { backgroundColor: COLORS.primary },
  confirmText: { color: COLORS.onPrimary, fontSize: 15, fontWeight: '700' },
});

export default ConfirmDialog;
