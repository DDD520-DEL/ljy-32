import Taro from '@tarojs/taro';
import type { InvitationCode, NeighborUser, CollaborationSession } from '../types';

const INVITATION_KEY = 'light_evaluator_invitations';
const CURRENT_USER_KEY = 'light_evaluator_current_user';
const COLLABORATION_KEY = 'light_evaluator_collaborations';

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export const invitation = {
  generateCode(buildingId: string, buildingName: string, address: string, inviterName: string): InvitationCode {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
    }

    const now = new Date();
    const expire = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const invitationData: InvitationCode = {
      code,
      buildingId,
      buildingName,
      address,
      inviterName,
      createTime: now.toISOString(),
      expireTime: expire.toISOString()
    };

    const invitations = this.getInvitations();
    invitations.push(invitationData);
    this.saveInvitations(invitations);

    return invitationData;
  },

  getInvitations(): InvitationCode[] {
    try {
      const data = Taro.getStorageSync(INVITATION_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Invitation] get error:', e);
      return [];
    }
  },

  saveInvitations(invitations: InvitationCode[]): void {
    try {
      Taro.setStorageSync(INVITATION_KEY, JSON.stringify(invitations));
    } catch (e) {
      console.error('[Invitation] save error:', e);
    }
  },

  parseCode(code: string): InvitationCode | null {
    const invitations = this.getInvitations();
    const found = invitations.find(inv => inv.code === code.toUpperCase());

    if (!found) return null;

    if (new Date(found.expireTime) < new Date()) {
      return null;
    }

    return found;
  },

  isCodeValid(code: string): { valid: boolean; reason?: string; invitation?: InvitationCode } {
    const upperCode = code.toUpperCase().trim();

    if (upperCode.length !== CODE_LENGTH) {
      return { valid: false, reason: '口令长度不正确' };
    }

    const inv = this.parseCode(upperCode);
    if (!inv) {
      return { valid: false, reason: '口令无效或已过期' };
    }

    return { valid: true, invitation: inv };
  }
};

export const neighborStorage = {
  getCurrentUser(): NeighborUser | null {
    try {
      const data = Taro.getStorageSync(CURRENT_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveCurrentUser(user: NeighborUser): void {
    try {
      Taro.setStorageSync(CURRENT_USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('[Neighbor] save user error:', e);
    }
  },

  ensureCurrentUser(name?: string): NeighborUser {
    let user = this.getCurrentUser();

    if (!user) {
      user = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        name: name || '邻居' + Math.floor(Math.random() * 9000 + 1000),
        joinTime: new Date().toISOString()
      };
      this.saveCurrentUser(user);
    }

    return user;
  },

  updateUserName(name: string): NeighborUser {
    const user = this.getCurrentUser();
    const updated: NeighborUser = user
      ? { ...user, name }
      : {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          name,
          joinTime: new Date().toISOString()
        };
    this.saveCurrentUser(updated);
    return updated;
  },

  getCollaborations(): CollaborationSession[] {
    try {
      const data = Taro.getStorageSync(COLLABORATION_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCollaborations(sessions: CollaborationSession[]): void {
    try {
      Taro.setStorageSync(COLLABORATION_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('[Neighbor] save collaborations error:', e);
    }
  },

  joinCollaboration(buildingId: string, buildingName: string, user: NeighborUser): CollaborationSession {
    const sessions = this.getCollaborations();
    let session = sessions.find(s => s.buildingId === buildingId);

    if (session) {
      const exists = session.participants.find(p => p.id === user.id);
      if (!exists) {
        session.participants.push(user);
      }
    } else {
      session = {
        buildingId,
        buildingName,
        participants: [user],
        createTime: new Date().toISOString()
      };
      sessions.push(session);
    }

    this.saveCollaborations(sessions);
    return session;
  },

  getCollaborationByBuilding(buildingId: string): CollaborationSession | null {
    const sessions = this.getCollaborations();
    return sessions.find(s => s.buildingId === buildingId) || null;
  },

  getParticipantsByBuilding(buildingId: string): NeighborUser[] {
    const session = this.getCollaborationByBuilding(buildingId);
    return session ? session.participants : [];
  }
};
