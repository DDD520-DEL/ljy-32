export type SensitivityLevel = 'whisper' | 'normal' | 'loud' | 'shout';

export interface TestRecord {
  id: string;
  buildingId: string;
  buildingName: string;
  floor: number;
  sensitivityLevel: SensitivityLevel;
  sensitivityScore: number;
  duration: number;
  hasBlindSpot: boolean;
  blindSpotDescription?: string;
  testTime: string;
  totalScore: number;
  grade: 'excellent' | 'good' | 'poor';
  testerId?: string;
  testerName?: string;
}

export interface Building {
  id: string;
  name: string;
  totalFloors: number;
  address: string;
  createTime: string;
}

export interface RankItem {
  rank: number;
  floor: number;
  buildingName: string;
  averageScore: number;
  testCount: number;
  grade: 'excellent' | 'good' | 'poor';
  contributors: ContributorInfo[];
}

export interface ContributorInfo {
  testerId: string;
  testerName: string;
  score: number;
  testTime: string;
  grade: 'excellent' | 'good' | 'poor';
}

export interface NeighborUser {
  id: string;
  name: string;
  avatar?: string;
  joinTime: string;
}

export interface InvitationCode {
  code: string;
  buildingId: string;
  buildingName: string;
  address: string;
  inviterName: string;
  createTime: string;
  expireTime: string;
}

export interface CollaborationSession {
  buildingId: string;
  buildingName: string;
  participants: NeighborUser[];
  createTime: string;
}

export const SENSITIVITY_CONFIG: Record<SensitivityLevel, { label: string; score: number; description: string }> = {
  whisper: { label: '轻声', score: 90, description: '轻声说话即可点亮' },
  normal: { label: '正常', score: 70, description: '正常说话声音可点亮' },
  loud: { label: '大声', score: 40, description: '需要大声喊叫才亮' },
  shout: { label: '喊叫', score: 10, description: '必须用力喊叫才亮' }
};

export const GRADE_CONFIG = {
  excellent: { label: '优秀', color: '#10B981', minScore: 80 },
  good: { label: '良好', color: '#F59E0B', minScore: 50 },
  poor: { label: '较差', color: '#EF4444', minScore: 0 }
};
