import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Modal, Alert, Image, ScrollView,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from 'react-native-document-picker';
import dayjs from 'dayjs';

import { COLORS }                         from '@constants/colors';
import { TYPOGRAPHY }                     from '@constants/typography';
import { SPACING, BORDER_RADIUS, SHADOW, CONFIG } from '@constants/config';
import useGroupStore from '@store/group.store';
import useAuthStore  from '@store/auth.store';
import socketService from '@services/socket.service';

export default function GroupChatScreen({ route, navigation }) {
  const { groupId } = route.params;
  const userId       = useAuthStore((s) => s.user?.id);
  const isSuperuser  = useAuthStore((s) => s.isSuperuser?.() ?? false);

  const {
    groups, messages, isLoadingMessages, isSending, hasMoreMessages,
    fetchMessages, sendMessage, markAllRead, appendMessage, deleteGroup,
    editMessage, updateMessage, setActiveGroupId,
  } = useGroupStore();

  const group   = groups.find((g) => g.id === groupId);
  const members = group?.members?.filter((m) => m.userId !== userId) ?? [];

  const [text,           setText]           = useState('');
  const [isPrivate,      setIsPrivate]      = useState(false);
  const [targetUser,     setTargetUser]     = useState(null);
  const [pickerOpen,     setPickerOpen]     = useState(false);
  const [attachOpen,      setAttachOpen]      = useState(false);
  const [attachedFiles,   setAttachedFiles]   = useState([]); // [{ uri, type, name, localUri }]
  const [isMultiSending,  setIsMultiSending]  = useState(false);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText,       setEditText]       = useState('');
  const [isSavingEdit,   setIsSavingEdit]   = useState(false);
  const [showFab,        setShowFab]        = useState(false);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const flatRef            = useRef(null);
  const editRef            = useRef(null);
  const initialScrollDone  = useRef(false);
  const pendingScroll      = useRef(null); // 'instant' | 'animated' | null
  const isNearBottom       = useRef(true);

  // ── Header right: three-dot menu (superuser only) ─────────────
  useLayoutEffect(() => {
    if (!isSuperuser) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerDotBtn}
          onPress={() => setMenuOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="dots-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [isSuperuser, groupId]);

  useEffect(() => {
    initialScrollDone.current = false;
    isNearBottom.current = true;
    setShowFab(false);
    setUnreadCount(0);
    setActiveGroupId(groupId);
    fetchMessages(groupId, true);
    markAllRead(groupId);
    socketService.joinGroup(groupId);

    const unsub     = socketService.onGroupMessage((msg) => {
      if (msg.groupId === groupId) appendMessage(msg);
    });
    const unsubEdit = socketService.onGroupMessageEdited((msg) => {
      if (msg.groupId === groupId) updateMessage(msg);
    });

    return () => {
      setActiveGroupId(null);
      socketService.leaveGroup(groupId);
      unsub?.();
      unsubEdit?.();
    };
  }, [groupId]);

  const lastMsgId = messages[messages.length - 1]?.id;

  // useLayoutEffect fires before onContentSizeChange — pendingScroll is set in time
  useLayoutEffect(() => {
    if (!lastMsgId) return;
    if (!initialScrollDone.current) {
      pendingScroll.current     = 'instant';
      initialScrollDone.current = true;
    } else if (isNearBottom.current) {
      pendingScroll.current = 'animated';
    }
  }, [lastMsgId]);

  // Unread counter for messages that arrive while scrolled up
  useEffect(() => {
    if (!lastMsgId || !initialScrollDone.current || isNearBottom.current) return;
    setUnreadCount((c) => c + 1);
  }, [lastMsgId]);

  const handleContentSizeChange = () => {
    if (!pendingScroll.current) return;
    const animated = pendingScroll.current === 'animated';
    pendingScroll.current = null;
    flatRef.current?.scrollToEnd({ animated });
  };

  const handleScroll = ({ nativeEvent }) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const dist = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const near = dist < 100;
    isNearBottom.current = near;
    setShowFab(!near);
    if (near && unreadCount > 0) setUnreadCount(0);
  };

  const scrollToBottom = () => {
    flatRef.current?.scrollToEnd({ animated: true });
    setUnreadCount(0);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && attachedFiles.length === 0) || isSending || isMultiSending) return;

    const filesToSend = [...attachedFiles];
    setText('');
    setAttachedFiles([]);

    setIsMultiSending(true);
    try {
      if (filesToSend.length === 0) {
        // Text-only message
        await sendMessage(groupId, {
          text:         trimmed || undefined,
          isPrivate,
          targetUserId: isPrivate && targetUser ? targetUser.id : null,
        });
      } else {
        // Send one message per file; text goes with the first only
        for (let i = 0; i < filesToSend.length; i++) {
          await sendMessage(groupId, {
            text:         i === 0 ? (trimmed || undefined) : undefined,
            isPrivate,
            targetUserId: isPrivate && targetUser ? targetUser.id : null,
            file:         filesToSend[i],
          });
        }
      }
    } finally {
      setIsMultiSending(false);
    }
  };

  // ── File picker (all types, multiple) ───────────────────────
  const pickFile = async () => {
    setAttachOpen(false);
    try {
      const results = await DocumentPicker.pick({
        type:               [DocumentPicker.types.allFiles],
        allowMultiSelection: true,
        copyTo:             'cachesDirectory',
      });
      const newFiles = results.map((r) => ({
        uri:      r.fileCopyUri ?? r.uri,
        type:     r.type ?? 'application/octet-stream',
        name:     r.name ?? `file_${Date.now()}`,
        localUri: r.fileCopyUri ?? r.uri,
      }));
      setAttachedFiles((prev) => [...prev, ...newFiles].slice(0, 10));
    } catch (e) {
      if (!DocumentPicker.isCancel(e)) {
        Alert.alert('Error', 'Could not open file picker.');
        console.warn('Document picker error:', e);
      }
    }
  };

  // ── Request camera permission (Android only) ─────────────────
  const ensureCameraPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const already = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (already) return true;
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title:         'Camera Permission',
          message:       'Allow the app to use your camera to take photos.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  // ── Image picker (v7 Promise API) ────────────────────────────
  const pickImage = async (source) => {
    setAttachOpen(false);

    if (source === 'camera') {
      const granted = await ensureCameraPermission();
      if (!granted) {
        Alert.alert(
          'Permission Denied',
          'Camera permission is required to take photos. Please enable it in your device settings.',
        );
        return;
      }
    }

    const options = {
      mediaType:      'photo',
      quality:        0.8,
      maxWidth:       1200,
      maxHeight:      1200,
      saveToPhotos:   false,
      includeBase64:  false,
      selectionLimit: source === 'camera' ? 1 : 10,
    };
    try {
      const response = source === 'camera'
        ? await launchCamera(options)
        : await launchImageLibrary(options);

      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert('Error', response.errorMessage ?? 'Could not open image picker.');
        return;
      }
      const assets = response.assets ?? [];
      if (!assets.length) return;
      const newFiles = assets.map((asset) => ({
        uri:      asset.uri,
        type:     asset.type     ?? 'image/jpeg',
        name:     asset.fileName ?? `photo_${Date.now()}.jpg`,
        localUri: asset.uri,
      }));
      setAttachedFiles((prev) => [...prev, ...newFiles].slice(0, 10));
    } catch (e) {
      Alert.alert('Error', 'Could not open image picker.');
      console.warn('Image picker error:', e);
    }
  };

  const handleLoadMore = () => {
    if (!isLoadingMessages && hasMoreMessages) fetchMessages(groupId, false);
  };

  const selectTarget = (member) => {
    setTargetUser({ id: member.userId, name: member.user.name });
    setIsPrivate(true);
    setPickerOpen(false);
  };

  const clearTarget = () => {
    setTargetUser(null);
    setIsPrivate(false);
  };

  // ── Edit message ──────────────────────────────────────────────
  const startEdit = (message) => {
    setEditingMessage(message);
    setEditText(message.text);
    setTimeout(() => editRef.current?.focus(), 100);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const saveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || isSavingEdit) return;
    if (trimmed === editingMessage.text) { cancelEdit(); return; }

    setIsSavingEdit(true);
    const result = await editMessage(groupId, editingMessage.id, trimmed);
    setIsSavingEdit(false);
    if (result.success) cancelEdit();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >

        {/* ── Messages + FAB ────────────────────────────── */}
        <View style={styles.flex}>
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item, index }) => (
              <MessageBubble
                message={item}
                userId={userId}
                isSuperuser={isSuperuser}
                prevMessage={messages[index - 1]}
                isEditing={editingMessage?.id === item.id}
                onLongPress={isSuperuser && item.senderId === userId ? () => startEdit(item) : null}
                onImagePress={(imgData) => navigation.navigate('ImageViewer', {
                  images:       [{ url: imgData.url, time: imgData.time, fileName: imgData.fileName }],
                  initialIndex: 0,
                  sender:       imgData.sender,
                })}
              />
            )}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.1}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={
              isLoadingMessages && hasMoreMessages ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={{ margin: SPACING.md }}
                />
              ) : null
            }
            ListEmptyComponent={
              !isLoadingMessages ? (
                <View style={styles.emptyWrap}>
                  <Icon name="chat-outline" size={48} color={COLORS.border} />
                  <Text style={styles.emptyText}>No messages yet</Text>
                </View>
              ) : null
            }
            onContentSizeChange={handleContentSizeChange}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {showFab && (
            <TouchableOpacity style={styles.fab} onPress={scrollToBottom} activeOpacity={0.85}>
              <Icon name="chevron-down" size={22} color={COLORS.white} />
              {unreadCount > 0 && (
                <View style={styles.fabBadge}>
                  <Text style={styles.fabBadgeText}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Send target bar (superuser only) ──────────── */}
        {isSuperuser && (
          <View style={styles.targetBar}>
            <TouchableOpacity
              style={[styles.targetBtn, !isPrivate && styles.targetBtnActive]}
              onPress={clearTarget}
              activeOpacity={0.8}
            >
              <Icon name="account-group-outline" size={13} color={!isPrivate ? COLORS.white : COLORS.textSecondary} />
              <Text style={[styles.targetBtnText, !isPrivate && styles.targetBtnTextActive]}>All</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.targetBtn, isPrivate && styles.targetBtnActive]}
              onPress={() => setPickerOpen(true)}
              activeOpacity={0.8}
            >
              <Icon name="account-outline" size={13} color={isPrivate ? COLORS.white : COLORS.textSecondary} />
              <Text style={[styles.targetBtnText, isPrivate && styles.targetBtnTextActive]} numberOfLines={1}>
                {targetUser ? targetUser.name.split(' ')[0] : 'Private'}
              </Text>
              {isPrivate && targetUser && (
                <TouchableOpacity onPress={clearTarget} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Icon name="close-circle" size={13} color={COLORS.white} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Edit bar (replaces input bar when editing) ─ */}
        {editingMessage ? (
          <View style={styles.inputBar}>
            <View style={styles.editBanner}>
              <Icon name="pencil-outline" size={13} color={COLORS.primary} />
              <Text style={styles.editBannerText} numberOfLines={1}>
                Editing: {editingMessage.text.slice(0, 50)}{editingMessage.text.length > 50 ? '…' : ''}
              </Text>
              <TouchableOpacity onPress={cancelEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Icon name="close" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                ref={editRef}
                style={styles.input}
                value={editText}
                onChangeText={setEditText}
                multiline
                maxLength={1000}
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!editText.trim() || isSavingEdit) && styles.sendBtnDisabled]}
                onPress={saveEdit}
                disabled={!editText.trim() || isSavingEdit}
                activeOpacity={0.8}
              >
                {isSavingEdit
                  ? <ActivityIndicator size={18} color={COLORS.white} />
                  : <Icon name="check" size={20} color={COLORS.white} />
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ── Normal input bar ─────────────────────────── */
          <View style={styles.inputBar}>
            {isPrivate && targetUser && (
              <View style={styles.privateIndicator}>
                <Icon name="lock-outline" size={11} color={COLORS.primary} />
                <Text style={styles.privateIndicatorText}>Private → {targetUser.name.split(' ')[0]}</Text>
              </View>
            )}

            {/* Attached files preview strip */}
            {attachedFiles.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.attachStrip}
                contentContainerStyle={styles.attachStripContent}
              >
                {attachedFiles.map((file, index) => {
                  const fi = getFileInfo(file.type);
                  return (
                    <View key={index} style={styles.attachStripItem}>
                      {fi.isImage ? (
                        <Image source={{ uri: file.localUri }} style={styles.attachStripThumb} />
                      ) : (
                        <View style={[styles.attachStripIcon, { backgroundColor: fi.color + '18' }]}>
                          <Icon name={fi.icon} size={26} color={fi.color} />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.attachStripRemove}
                        onPress={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== index))}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Icon name="close-circle" size={18} color="#fff" />
                      </TouchableOpacity>
                      {!fi.isImage && (
                        <Text style={styles.attachStripName} numberOfLines={1}>{file.name}</Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.inputRow}>
              {/* Attach button */}
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={() => setAttachOpen(true)}
                activeOpacity={0.7}
              >
                <Icon name="paperclip" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder={isPrivate ? `Private to ${targetUser?.name?.split(' ')[0] ?? '…'}` : 'Send to all members…'}
                placeholderTextColor={COLORS.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendBtn, ((!text.trim() && attachedFiles.length === 0) || isSending || isMultiSending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={(!text.trim() && attachedFiles.length === 0) || isSending || isMultiSending}
                activeOpacity={0.8}
              >
                {(isSending || isMultiSending)
                  ? <ActivityIndicator size={18} color={COLORS.white} />
                  : <Icon name="send" size={18} color={COLORS.white} />
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

      </KeyboardAvoidingView>

      {/* ── Member picker modal ───────────────────────── */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setPickerOpen(false)}
        />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Send privately to…</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Icon name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={members}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => {
              const initials = item.user.name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
              const isActive = targetUser?.id === item.userId;
              return (
                <TouchableOpacity
                  style={[styles.pickerRow, isActive && styles.pickerRowActive]}
                  onPress={() => selectTarget(item)}
                >
                  <View style={[styles.pickerAvatar, isActive && styles.pickerAvatarActive]}>
                    <Text style={[styles.pickerAvatarText, isActive && { color: COLORS.white }]}>
                      {initials}
                    </Text>
                  </View>
                  <View style={styles.pickerInfo}>
                    <Text style={[styles.pickerName, isActive && { color: COLORS.primary }]}>
                      {item.user.name}
                    </Text>
                    <Text style={styles.pickerEmail}>{item.user.email}</Text>
                  </View>
                  {isActive && <Icon name="check-circle" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No members in this group.</Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </Modal>

      {/* ── Attachment picker sheet ──────────────────── */}
      <Modal
        visible={attachOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setAttachOpen(false)}
        />
        <View style={styles.attachSheet}>
          <View style={styles.attachSheetHandle} />
          <Text style={styles.attachSheetTitle}>Send Image</Text>
          <View style={styles.attachOptions}>
            <TouchableOpacity style={styles.attachOption} onPress={() => pickImage('camera')}>
              <View style={[styles.attachOptionIcon, { backgroundColor: COLORS.primary + '18' }]}>
                <Icon name="camera-outline" size={26} color={COLORS.primary} />
              </View>
              <Text style={styles.attachOptionLabel}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={() => pickImage('library')}>
              <View style={[styles.attachOptionIcon, { backgroundColor: COLORS.secondary + '18' }]}>
                <Icon name="image-multiple-outline" size={26} color={COLORS.secondary} />
              </View>
              <Text style={styles.attachOptionLabel}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={pickFile}>
              <View style={[styles.attachOptionIcon, { backgroundColor: '#7c3aed18' }]}>
                <Icon name="file-outline" size={26} color="#7c3aed" />
              </View>
              <Text style={styles.attachOptionLabel}>File</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.attachCancel} onPress={() => setAttachOpen(false)}>
            <Text style={styles.attachCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Three-dot dropdown menu ───────────────────── */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        />
        <View style={styles.menuDropdown}>

          {/* Members */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              navigation.navigate('GroupMembers', {
                groupId,
                groupName: route.params?.groupName,
              });
            }}
          >
            <Icon name="account-multiple-outline" size={20} color={COLORS.textPrimary} />
            <Text style={styles.menuItemText}>Members</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Delete Group */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              Alert.alert(
                'Delete Group',
                `Delete "${route.params?.groupName}"? All messages will be lost.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text:    'Delete',
                    style:   'destructive',
                    onPress: async () => {
                      const result = await deleteGroup(groupId);
                      if (result.success) navigation.goBack();
                    },
                  },
                ]
              );
            }}
          >
            <Icon name="trash-can-outline" size={20} color={COLORS.error} />
            <Text style={[styles.menuItemText, { color: COLORS.error }]}>Delete Group</Text>
          </TouchableOpacity>

        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Message bubble ───────────────────────────────────────────
function MessageBubble({ message, userId, isSuperuser, prevMessage, isEditing, onLongPress, onImagePress }) {
  const isMe        = message.senderId === userId;
  const isPrivate   = message.isPrivate;
  const senderName  = isMe
    ? 'You'
    : isSuperuser
    ? message.sender?.name ?? 'Member'
    : 'Support Team';

  const hasImage  = message.fileUrl && message.fileType?.startsWith('image/');
  const hasFile   = message.fileUrl && !hasImage;   // any non-image attachment
  const fileUrl   = message.fileUrl
    ? (message.fileUrl.startsWith('http') ? message.fileUrl : `${CONFIG.SOCKET_URL}${message.fileUrl}`)
    : null;
  const fi = hasFile ? getFileInfo(message.fileType) : null;

  const showDateSep = !prevMessage ||
    !dayjs(message.createdAt).isSame(dayjs(prevMessage.createdAt), 'day');

  return (
    <>
      {showDateSep && (
        <View style={styles.dateSep}>
          <Text style={styles.dateSepText}>
            {dayjs(message.createdAt).format('DD MMM YYYY')}
          </Text>
        </View>
      )}

      <View style={[styles.bubbleWrap, isMe && styles.bubbleWrapMe]}>
        {!isMe && <Text style={styles.bubbleSender}>{senderName}</Text>}

        <TouchableOpacity
          activeOpacity={onLongPress ? 0.75 : 1}
          onLongPress={onLongPress ?? undefined}
          delayLongPress={400}
          style={[
            styles.bubble,
            isMe      ? styles.bubbleMe    : styles.bubbleThem,
            isPrivate && styles.bubblePrivate,
            isEditing && styles.bubbleEditing,
            (hasImage || hasFile) && styles.bubbleFile,
          ]}
        >
          {isPrivate && (
            <View style={styles.privateTag}>
              <Icon name="lock-outline" size={10} color={isMe ? 'rgba(255,255,255,0.8)' : COLORS.primary} />
              <Text style={[styles.privateTagText, isMe && { color: 'rgba(255,255,255,0.8)' }]}>
                {isMe
                  ? `Private → ${message.targetUser?.name ?? 'Member'}`
                  : 'Private'}
              </Text>
            </View>
          )}

          {/* Image — tap to full-screen */}
          {hasImage && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onImagePress?.({
                url:      fileUrl,
                sender:   senderName,
                time:     message.createdAt,
                fileName: message.fileName ?? null,
              })}
            >
              <Image source={{ uri: fileUrl }} style={styles.msgImage} resizeMode="cover" />
            </TouchableOpacity>
          )}

          {/* Generic file card (PDF, Word, Excel, etc.) */}
          {hasFile && fi && (
            <View style={[styles.fileCard, isMe && styles.fileCardMe]}>
              <View style={[styles.fileIconWrap, { backgroundColor: fi.color + '22' }]}>
                <Icon name={fi.icon} size={30} color={fi.color} />
              </View>
              <View style={styles.fileInfo}>
                <Text style={[styles.fileName, isMe && styles.fileNameMe]} numberOfLines={2}>
                  {message.fileName ?? 'File'}
                </Text>
                <Text style={[styles.fileLabel, isMe && styles.fileLabelMe]}>{fi.label}</Text>
              </View>
            </View>
          )}

          {/* Text / caption */}
          {message.text ? (
            <Text style={[
              styles.bubbleText,
              isMe && styles.bubbleTextMe,
              (hasImage || hasFile) && styles.bubbleCaption,
            ]}>
              {message.text}
            </Text>
          ) : null}

          <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
            {dayjs(message.createdAt).format('hh:mm A')}
            {isPrivate && !isMe && (
              <Text> · {message.reads?.length ?? 0} read</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── File type → icon / label / color ────────────────────────
function getFileInfo(mimeType) {
  if (!mimeType) return { icon: 'file-outline', color: '#6b7280', label: 'File', isImage: false };
  if (mimeType.startsWith('image/'))                                          return { icon: 'image-outline',              color: '#2563eb', label: 'Image',       isImage: true  };
  if (mimeType === 'application/pdf')                                         return { icon: 'file-pdf-box',               color: '#dc2626', label: 'PDF',         isImage: false };
  if (mimeType === 'application/msword' ||
      mimeType.includes('wordprocessingml'))                                  return { icon: 'file-word-outline',          color: '#1d4ed8', label: 'Word',        isImage: false };
  if (mimeType === 'application/vnd.ms-excel' ||
      mimeType.includes('spreadsheetml'))                                     return { icon: 'file-excel-outline',         color: '#16a34a', label: 'Excel',       isImage: false };
  if (mimeType === 'application/vnd.ms-powerpoint' ||
      mimeType.includes('presentationml'))                                    return { icon: 'file-powerpoint-outline',    color: '#ea580c', label: 'PowerPoint',  isImage: false };
  if (mimeType === 'text/plain')                                              return { icon: 'file-document-outline',     color: '#6b7280', label: 'Text',        isImage: false };
  if (mimeType === 'text/csv')                                                return { icon: 'file-delimited-outline',    color: '#16a34a', label: 'CSV',         isImage: false };
  if (mimeType.includes('zip') || mimeType.includes('rar'))                  return { icon: 'folder-zip-outline',        color: '#ca8a04', label: 'Archive',     isImage: false };
  return                                                                             { icon: 'file-outline',              color: '#6b7280', label: 'File',        isImage: false };
}

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: COLORS.background },
  flex:  { flex: 1 },

  // Header three-dot button
  headerDotBtn: {
    marginRight: 8,
    padding:     4,
  },

  // Dropdown menu
  menuOverlay: {
    flex: 1,
  },
  menuDropdown: {
    position:        'absolute',
    top:             52,
    right:           12,
    backgroundColor: COLORS.surface,
    borderRadius:    BORDER_RADIUS.md,
    minWidth:        180,
    ...SHADOW.sm,
    shadowOpacity:   0.18,
    shadowRadius:    8,
    elevation:       8,
    overflow:        'hidden',
  },
  menuItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: SPACING.md,
    paddingVertical:   14,
  },
  menuItemText: {
    ...TYPOGRAPHY.body,
    fontWeight: '500',
    color:      COLORS.textPrimary,
  },
  menuDivider: {
    height:          1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
  },
  listContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.lg },

  fab: {
    position:        'absolute',
    bottom:          SPACING.md,
    right:           SPACING.md,
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: COLORS.primary,
    alignItems:      'center',
    justifyContent:  'center',
    ...SHADOW.sm,
    elevation:       6,
  },
  fabBadge: {
    position:        'absolute',
    top:             -4,
    right:           -4,
    minWidth:        18,
    height:          18,
    borderRadius:    9,
    backgroundColor: COLORS.error,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
  },
  fabBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },

  dateSep: { alignItems: 'center', marginVertical: SPACING.md },
  dateSepText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    backgroundColor: COLORS.background,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border,
  },

  // Bubbles
  bubbleWrap:    { marginBottom: SPACING.xs, alignItems: 'flex-start', maxWidth: '82%' },
  bubbleWrapMe:  { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleSender:  { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '700', marginBottom: 2, marginLeft: SPACING.xs },
  bubble:        { borderRadius: BORDER_RADIUS.lg, padding: SPACING.sm, paddingHorizontal: SPACING.md, ...SHADOW.sm },
  bubbleMe:      { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleThem:    { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4 },
  bubblePrivate: { borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed' },
  privateTag:    { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
  privateTagText:{ fontSize: 10, fontWeight: '700', color: COLORS.primary },
  bubbleEditing: { opacity: 0.6, borderWidth: 2, borderColor: COLORS.primary },
  bubbleText:    { ...TYPOGRAPHY.body, color: COLORS.textPrimary, lineHeight: 20 },
  bubbleTextMe:  { color: COLORS.white },
  bubbleTime:    { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 4, alignSelf: 'flex-end', fontSize: 10 },
  bubbleTimeMe:  { color: 'rgba(255,255,255,0.7)' },

  // Edit banner
  editBanner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    backgroundColor: COLORS.primaryLight,
    borderRadius:   BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   5,
    marginBottom:   6,
  },
  editBannerText: {
    flex: 1,
    ...TYPOGRAPHY.caption,
    color:      COLORS.primary,
    fontWeight: '600',
  },

  // Target bar
  targetBar: {
    flexDirection:    'row',
    gap:              SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop:       SPACING.sm,
    backgroundColor:  COLORS.surface,
    borderTopWidth:   1,
    borderTopColor:   COLORS.border,
  },
  targetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: SPACING.sm, paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  targetBtnActive:     { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  targetBtnText:       { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  targetBtnTextActive: { color: COLORS.white },

  // Input
  inputBar: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
    backgroundColor:  COLORS.surface,
  },
  privateIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 4,
  },
  privateIndicatorText: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
  attachBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.body, color: COLORS.textPrimary,
  },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: COLORS.border },

  // Attached files strip (horizontal, multi-file)
  attachStrip: {
    marginBottom: SPACING.xs,
  },
  attachStripContent: {
    gap:             SPACING.sm,
    paddingHorizontal: 2,
    paddingVertical:   4,
  },
  attachStripItem: {
    width:      72,
    alignItems: 'center',
    position:   'relative',
  },
  attachStripThumb: {
    width:           64,
    height:          64,
    borderRadius:    BORDER_RADIUS.md,
    backgroundColor: COLORS.border,
  },
  attachStripIcon: {
    width:          64,
    height:         64,
    borderRadius:   BORDER_RADIUS.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  attachStripRemove: {
    position:        'absolute',
    top:             -6,
    right:           2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius:    10,
  },
  attachStripName: {
    ...TYPOGRAPHY.caption,
    fontSize:  9,
    color:     COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 3,
    width:     68,
  },

  // Attach picker sheet
  attachSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius:  20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  attachSheetHandle: {
    width:           40,
    height:          4,
    backgroundColor: COLORS.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginTop:       10,
    marginBottom:    8,
  },
  attachSheetTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight:   '700',
    color:        COLORS.textPrimary,
    textAlign:    'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  attachOptions: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            SPACING.xl,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  attachOption: {
    alignItems: 'center',
    gap:        SPACING.sm,
  },
  attachOptionIcon: {
    width:          72,
    height:         72,
    borderRadius:   20,
    alignItems:     'center',
    justifyContent: 'center',
  },
  attachOptionLabel: {
    ...TYPOGRAPHY.small,
    fontWeight: '600',
    color:      COLORS.textPrimary,
  },
  attachCancel: {
    marginHorizontal: SPACING.lg,
    paddingVertical:  14,
    backgroundColor:  COLORS.background,
    borderRadius:     BORDER_RADIUS.lg,
    alignItems:       'center',
    borderWidth:      1,
    borderColor:      COLORS.border,
  },
  attachCancelText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color:      COLORS.textSecondary,
  },

  // File bubble (image or PDF)
  bubbleFile: { padding: 4 },
  msgImage: {
    width:        220,
    height:       180,
    borderRadius: BORDER_RADIUS.md,
  },
  bubbleCaption: {
    marginTop:        6,
    marginHorizontal: 4,
  },

  // Generic file card inside bubble
  fileCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius:    BORDER_RADIUS.md,
    padding:         SPACING.sm,
    minWidth:        190,
    maxWidth:        240,
  },
  fileCardMe:  { backgroundColor: 'rgba(255,255,255,0.18)' },
  fileIconWrap: {
    width:           44,
    height:          44,
    borderRadius:    BORDER_RADIUS.sm,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  fileInfo:    { flex: 1 },
  fileName:    { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.textPrimary },
  fileNameMe:  { color: COLORS.white },
  fileLabel:   { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  fileLabelMe: { color: 'rgba(255,255,255,0.65)' },


  // Picker modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '60%', paddingTop: 4,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pickerTitle:       { ...TYPOGRAPHY.bodyMedium, fontWeight: '700', color: COLORS.textPrimary },
  pickerRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  pickerRowActive:   { backgroundColor: COLORS.primaryLight },
  pickerAvatar:      { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  pickerAvatarActive:{ backgroundColor: COLORS.primary },
  pickerAvatarText:  { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  pickerInfo:        { flex: 1 },
  pickerName:        { ...TYPOGRAPHY.body, fontWeight: '600', color: COLORS.textPrimary },
  pickerEmail:       { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: 1 },
});
