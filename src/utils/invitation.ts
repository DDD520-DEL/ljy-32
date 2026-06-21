import Taro from '@tarojs/taro';
import type { InvitationCode, NeighborUser, CollaborationSession } from '../types';

const CURRENT_USER_KEY = 'light_evaluator_current_user';
const COLLABORATION_KEY = 'light_evaluator_collaborations';
const INVITATION_HISTORY_KEY = 'light_evaluator_invitation_history';

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64Encode(str: string): string {
  const utf8 = unescape(encodeURIComponent(str));
  let result = '';
  let i = 0;
  while (i < utf8.length) {
    const a = utf8.charCodeAt(i++);
    const b = i < utf8.length ? utf8.charCodeAt(i++) : 0;
    const c = i < utf8.length ? utf8.charCodeAt(i++) : 0;
    const bits = (a << 16) | (b << 8) | c;
    result += B64_CHARS[(bits >> 18) & 0x3F];
    result += B64_CHARS[(bits >> 12) & 0x3F];
    result += i > utf8.length + 1 ? '=' : B64_CHARS[(bits >> 6) & 0x3F];
    result += i > utf8.length ? '=' : B64_CHARS[bits & 0x3F];
  }
  return result;
}

function b64Decode(str: string): string {
  let result = '';
  let i = 0;
  const s = str.replace(/=+$/, '');
  while (i < s.length) {
    const a = B64_CHARS.indexOf(s[i++]);
    const b = B64_CHARS.indexOf(s[i++]);
    const c = i < s.length ? B64_CHARS.indexOf(s[i++]) : 0;
    const d = i < s.length ? B64_CHARS.indexOf(s[i++]) : 0;
    const bits = (a << 18) | (b << 12) | (c << 6) | d;
    result += String.fromCharCode((bits >> 16) & 0xFF);
    if (c >= 0 && s.length - (i - 2) > 2) result += String.fromCharCode((bits >> 8) & 0xFF);
    if (d >= 0 && s.length - (i - 2) > 3) result += String.fromCharCode(bits & 0xFF);
  }
  return decodeURIComponent(escape(result));
}

interface InvitationPayload {
  i: string;
  n: string;
  a: string;
  f: number;
  r: string;
  e: number;
}

export const invitation = {
  generateCode(
    buildingId: string,
    buildingName: string,
    address: string,
    totalFloors: number,
    inviterName: string
  ): InvitationCode {
    const now = new Date();
    const expire = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const payload: InvitationPayload = {
      i: buildingId,
      n: buildingName,
      a: address,
      f: totalFloors,
      r: inviterName,
      e: expire.getTime()
    };

    const code = b64Encode(JSON.stringify(payload));

    const invitationData: InvitationCode = {
      code,
      buildingId,
      buildingName,
      address,
      totalFloors,
      inviterName,
      createTime: now.toISOString(),
      expireTime: expire.toISOString()
    };

    this.saveToHistory(invitationData);

    return invitationData;
  },

  parseCode(code: string): InvitationCode | null {
    const trimmed = code.trim();
    if (!trimmed) return null;

    try {
      const json = b64Decode(trimmed);
      const payload: InvitationPayload = JSON.parse(json);

      if (!payload.i || !payload.n || !payload.a || !payload.f || !payload.e) {
        return null;
      }

      if (Date.now() > payload.e) {
        return null;
      }

      const createTime = new Date(payload.e - 7 * 24 * 60 * 60 * 1000);

      return {
        code: trimmed,
        buildingId: payload.i,
        buildingName: payload.n,
        address: payload.a,
        totalFloors: payload.f,
        inviterName: payload.r || '邻居',
        createTime: createTime.toISOString(),
        expireTime: new Date(payload.e).toISOString()
      };
    } catch {
      return null;
    }
  },

  isCodeValid(code: string): { valid: boolean; reason?: string; invitation?: InvitationCode } {
    const trimmed = code.trim();
    if (!trimmed) {
      return { valid: false, reason: '请输入口令' };
    }

    const invitation = this.parseCode(trimmed);
    if (!invitation) {
      return { valid: false, reason: '口令无效或已过期' };
    }

    return { valid: true, invitation };
  },

  saveToHistory(invitation: InvitationCode): void {
    try {
      const history = this.getHistory();
      history.unshift(invitation);
      if (history.length > 20) history.length = 20;
      Taro.setStorageSync(INVITATION_HISTORY_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }
  },

  getHistory(): InvitationCode[] {
    try {
      const data = Taro.getStorageSync(INVITATION_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
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
