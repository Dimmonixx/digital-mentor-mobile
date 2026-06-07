import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/* Custom dark "space" UI замена системным Alert.alert для управления постом. */

export type DemoOverlayData = {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  confirmText?: string;
  onConfirm?: () => void;
} | null;

const SheetItem = ({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={onPress}>
    <View style={[styles.itemIcon, danger && styles.itemIconDanger]}>
      <Ionicons name={icon} size={20} color={danger ? '#ff6b6b' : '#f2ca50'} />
    </View>
    <Text style={[styles.itemLabel, danger && styles.itemLabelDanger]}>{label}</Text>
    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
  </TouchableOpacity>
);

export const PostActionsSheet = ({
  visible,
  onClose,
  onEditText,
  onDeletePhoto,
  onDeletePost,
}: {
  visible: boolean;
  onClose: () => void;
  onEditText: () => void;
  onDeletePhoto: () => void;
  onDeletePost: () => void;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={() => {}}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>Управление постом</Text>
        <Text style={styles.sheetSubtitle}>Выберите действие</Text>
        <SheetItem icon="create-outline" label="Редактировать текст" onPress={onEditText} />
        <SheetItem icon="image-outline" label="Удалить фото" onPress={onDeletePhoto} />
        <SheetItem icon="trash-outline" label="Удалить пост" danger onPress={onDeletePost} />
        <TouchableOpacity style={styles.cancel} activeOpacity={0.7} onPress={onClose}>
          <Text style={styles.cancelText}>Отмена</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);

export const DemoOverlay = ({ data, onClose }: { data: DemoOverlayData; onClose: () => void }) => (
  <Modal visible={!!data} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.overlayBackdrop} onPress={onClose}>
      <Pressable style={styles.overlayCard} onPress={() => {}}>
        <View style={[styles.overlayIcon, data?.danger && styles.overlayIconDanger]}>
          <Ionicons
            name={data?.icon ?? 'sparkles-outline'}
            size={30}
            color={data?.danger ? '#ff6b6b' : '#f2ca50'}
          />
        </View>
        <Text style={styles.overlayTitle}>{data?.title}</Text>
        <Text style={styles.overlayMessage}>{data?.message}</Text>

        {data?.onConfirm ? (
          <View style={styles.overlayButtonsRow}>
            <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnGhost]} activeOpacity={0.8} onPress={onClose}>
              <Text style={styles.overlayBtnGhostText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.overlayBtn, data.danger ? styles.overlayBtnDanger : styles.overlayBtnPrimary]}
              activeOpacity={0.85}
              onPress={data.onConfirm}
            >
              <Text style={[styles.overlayBtnText, data.danger && styles.overlayBtnTextDanger]}>
                {data.confirmText ?? 'Подтвердить'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.overlayBtn, styles.overlayBtnPrimary, styles.overlayBtnFull]} activeOpacity={0.85} onPress={onClose}>
            <Text style={styles.overlayBtnText}>Понятно</Text>
          </TouchableOpacity>
        )}
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  /* Bottom sheet */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 8, 20, 0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'rgba(16, 22, 38, 0.96)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.25)',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', letterSpacing: 0.3 },
  sheetSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2, marginBottom: 14 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(10, 15, 26, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 202, 80, 0.12)',
  },
  itemIconDanger: { backgroundColor: 'rgba(255, 107, 107, 0.12)' },
  itemLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#ffffff' },
  itemLabelDanger: { color: '#ff6b6b' },
  cancel: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },

  /* Demo overlay */
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 8, 20, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  overlayCard: {
    width: '100%',
    backgroundColor: 'rgba(16, 22, 38, 0.98)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.3)',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  overlayIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242, 202, 80, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.35)',
    marginBottom: 16,
  },
  overlayIconDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderColor: 'rgba(255, 107, 107, 0.4)',
  },
  overlayTitle: { fontSize: 19, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 8 },
  overlayMessage: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 22 },
  overlayButtonsRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  overlayBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBtnFull: { alignSelf: 'stretch' },
  overlayBtnPrimary: { backgroundColor: '#f2ca50' },
  overlayBtnDanger: { backgroundColor: '#ff6b6b' },
  overlayBtnGhost: { backgroundColor: 'rgba(255,255,255,0.08)' },
  overlayBtnText: { fontSize: 15, fontWeight: '800', color: '#0b0e14', letterSpacing: 0.3 },
  overlayBtnTextDanger: { color: '#ffffff' },
  overlayBtnGhostText: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
});
