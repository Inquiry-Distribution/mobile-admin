import { create } from 'zustand';
import { groupApi } from '@api/group.api';

const useGroupStore = create((set, get) => ({
  groups:          [],
  selectedGroup:   null,
  messages:        [],
  isLoading:       false,
  isLoadingMessages: false,
  isSending:       false,
  isMutating:      false,
  hasMoreMessages: true,
  activeGroupId:   null,
  error:           null,

  // ─── Fetch all groups ───────────────────────────────────────
  fetchGroups: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await groupApi.getGroups();
      set({ groups: res.data ?? [], isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // ─── Create group ───────────────────────────────────────────
  createGroup: async (payload) => {
    set({ isMutating: true });
    try {
      const res   = await groupApi.createGroup(payload);
      const group = res.data;
      set((state) => ({ groups: [group, ...state.groups], isMutating: false }));
      return { success: true, group };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Delete group ───────────────────────────────────────────
  deleteGroup: async (groupId) => {
    set({ isMutating: true });
    try {
      await groupApi.deleteGroup(groupId);
      set((state) => ({
        groups:      state.groups.filter((g) => g.id !== groupId),
        isMutating:  false,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Add members ────────────────────────────────────────────
  addMembers: async (groupId, userIds) => {
    set({ isMutating: true });
    try {
      const res     = await groupApi.addMembers(groupId, userIds);
      const updated = res.data;
      set((state) => ({
        groups:        state.groups.map((g) => g.id === groupId ? { ...g, ...updated } : g),
        selectedGroup: state.selectedGroup?.id === groupId ? updated : state.selectedGroup,
        isMutating:    false,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Remove member ──────────────────────────────────────────
  removeMember: async (groupId, userId) => {
    set({ isMutating: true });
    try {
      const res     = await groupApi.removeMember(groupId, userId);
      const updated = res.data;
      set((state) => ({
        groups:        state.groups.map((g) => g.id === groupId ? { ...g, ...updated } : g),
        selectedGroup: state.selectedGroup?.id === groupId ? updated : state.selectedGroup,
        isMutating:    false,
      }));
      return { success: true };
    } catch (err) {
      set({ isMutating: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Load messages ──────────────────────────────────────────
  fetchMessages: async (groupId, reset = true) => {
    if (!reset && !get().hasMoreMessages) return;
    set({ isLoadingMessages: true });
    try {
      const cursor  = reset ? undefined : get().messages[0]?.id;
      const res     = await groupApi.getMessages(groupId, cursor);
      const fetched = res.data ?? [];
      set((state) => ({
        messages:          reset ? fetched : [...fetched, ...state.messages],
        hasMoreMessages:   fetched.length >= 30,
        isLoadingMessages: false,
      }));
    } catch (err) {
      set({ isLoadingMessages: false });
    }
  },

  // ─── Send message (text and/or image) ──────────────────────
  // payload: { text?, isPrivate?, targetUserId?, file? }
  // file: { uri, type, name }  — from react-native-image-picker
  sendMessage: async (groupId, payload) => {
    set({ isSending: true });
    try {
      let res;
      if (payload.file) {
        const formData = new FormData();
        if (payload.text?.trim()) formData.append('text', payload.text.trim());
        if (payload.isPrivate)    formData.append('isPrivate', 'true');
        if (payload.targetUserId) formData.append('targetUserId', payload.targetUserId);
        formData.append('file', {
          uri:  payload.file.uri,
          type: payload.file.type,
          name: payload.file.name,
        });
        res = await groupApi.sendMessageWithFile(groupId, formData);
      } else {
        res = await groupApi.sendMessage(groupId, payload);
      }

      const msg = res.data;
      // Socket may have already added this message — dedup by id
      set((state) => {
        const exists = state.messages.some((m) => m.id === msg.id);
        return exists
          ? { isSending: false }
          : { messages: [...state.messages, msg], isSending: false };
      });
      // Bump lastMessage for inbox sort
      set((state) => ({
        groups: state.groups.map((g) =>
          g.id === groupId ? { ...g, lastMessage: msg } : g
        ),
      }));
      return { success: true };
    } catch (err) {
      set({ isSending: false });
      return { success: false, message: err.message };
    }
  },

  // ─── Edit message (superuser, own messages only) ────────────
  editMessage: async (groupId, messageId, text) => {
    try {
      const res = await groupApi.editMessage(groupId, messageId, text);
      const updated = res.data;
      set((state) => ({
        messages: state.messages.map((m) => m.id === updated.id ? updated : m),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // ─── Update message in list (from socket group:message:edited) ─
  updateMessage: (updated) => {
    set((state) => ({
      messages: state.messages.map((m) => m.id === updated.id ? updated : m),
    }));
  },

  // ─── Mark all read ──────────────────────────────────────────
  markAllRead: async (groupId) => {
    try {
      await groupApi.markAllRead(groupId);
      set((state) => ({
        groups: state.groups.map((g) =>
          g.id === groupId ? { ...g, unreadCount: 0 } : g
        ),
      }));
    } catch (_) {}
  },

  // ─── Append socket message ──────────────────────────────────
  appendMessage: (message) => {
    set((state) => {
      const alreadyExists = state.messages.some((m) => m.id === message.id);
      const isActiveGroup = state.activeGroupId === message.groupId;

      // Own sent messages are never unread
      const myUserId = require('@store/auth.store').default.getState()?.user?.id;
      const isOwnMsg = myUserId && message.senderId === myUserId;

      return {
        ...(alreadyExists ? {} : { messages: [...state.messages, message] }),
        groups: state.groups.map((g) =>
          g.id === message.groupId
            ? {
                ...g,
                lastMessage: message,
                unreadCount: (isActiveGroup || isOwnMsg)
                  ? (g.unreadCount ?? 0)
                  : (g.unreadCount ?? 0) + 1,
              }
            : g
        ),
      };
    });
  },

  setActiveGroupId: (groupId) => set({ activeGroupId: groupId }),
  setSelectedGroup: (group)   => set({ selectedGroup: group, messages: [], hasMoreMessages: true }),
  clearMessages:    ()        => set({ messages: [], hasMoreMessages: true }),
  clearError:       ()        => set({ error: null }),
}));

export default useGroupStore;
