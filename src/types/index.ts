export type SensitivityLevel = 'whisper' | 'normal' | 'loud' | 'shout';

export type RetestCycle = 'one_week' | 'two_weeks' | 'one_month' | 'three_months' | 'custom';

export const RETEST_CYCLE_CONFIG: Record<RetestCycle, { label: string; days: number }> = {
  one_week: { label: '每周', days: 7 },
  two_weeks: { label: '每两周', days: 14 },
  one_month: { label: '每月', days: 30 },
  three_months: { label: '每季度', days: 90 },
  custom: { label: '自定义', days: -1 }
};

export type RepairStatus = 'pending' | 'dispatched' | 'repairing' | 'fixed';

export interface RepairRecord {
  id: string;
  buildingId: string;
  buildingName: string;
  floor: number;
  status: RepairStatus;
  complaintMarked: boolean;
  complaintTime?: string;
  statusUpdateTime: string;
  issues: string;
  note?: string;
}

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
  photos?: string[];
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
  retestCycle: RetestCycle;
  customRetestDays?: number;
}

export interface RankItem {
  rank: number;
  floor: number;
  buildingName: string;
  averageScore: number;
  testCount: number;
  grade: 'excellent' | 'good' | 'poor';
  contributors: ContributorInfo[];
  lastTestTime: string;
  isStale: boolean;
  daysSinceLastTest: number;
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
  totalFloors: number;
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

export interface RetestReminder {
  id: string;
  buildingId: string;
  buildingName: string;
  floor: number;
  lastTestTime: string;
  retestDueDate: string;
  daysOverdue: number;
  retestCycle: RetestCycle;
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

export const REPAIR_STATUS_CONFIG: Record<RepairStatus, { label: string; color: string; bgColor: string; icon: string; step: number }> = {
  pending: { label: '待处理', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)', icon: '⏳', step: 1 },
  dispatched: { label: '已派单', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)', icon: '📋', step: 2 },
  repairing: { label: '维修中', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)', icon: '🔧', step: 3 },
  fixed: { label: '已修复', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)', icon: '✅', step: 4 }
};

export type ReportType = 'weekly' | 'monthly';

export interface SensitivityTrendItem {
  date: string;
  label: string;
  avgScore: number;
  count: number;
}

export interface FloorIssueChange {
  floor: number;
  prevGrade: 'excellent' | 'good' | 'poor' | 'none';
  currGrade: 'excellent' | 'good' | 'poor';
  change: 'improved' | 'declined' | 'unchanged' | 'new';
  scoreChange: number;
}

export interface ReportData {
  type: ReportType;
  buildingId: string;
  buildingName: string;
  address: string;
  totalFloors: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  generateTime: string;
  newTestCount: number;
  prevPeriodTestCount: number;
  testCountChange: number;
  testedFloors: number;
  testedFloorsPrev: number;
  avgScore: number;
  avgScorePrev: number;
  avgScoreChange: number;
  sensitivityLevelDist: Record<SensitivityLevel, number>;
  sensitivityLevelDistPrev: Record<SensitivityLevel, number>;
  sensitivityTrend: SensitivityTrendItem[];
  excellentCount: number;
  goodCount: number;
  poorCount: number;
  excellentCountPrev: number;
  goodCountPrev: number;
  poorCountPrev: number;
  improvedFloors: FloorIssueChange[];
  declinedFloors: FloorIssueChange[];
  unchangedFloors: FloorIssueChange[];
  newFloors: FloorIssueChange[];
  topFloors: Array<{ floor: number; avgScore: number; testCount: number; grade: 'excellent' | 'good' | 'poor' }>;
  bottomFloors: Array<{ floor: number; avgScore: number; testCount: number; grade: 'excellent' | 'good' | 'poor' }>;
  blindSpotCount: number;
  blindSpotFloors: number[];
  contributors: Array<{ testerName: string; testCount: number }>;
}

export interface BuildingStats {
  buildingId: string;
  buildingName: string;
  address: string;
  totalFloors: number;
  totalTests: number;
  testedFloors: number;
  testedFloorsRatio: number;
  avgSensitivityScore: number;
  avgTotalScore: number;
  excellentCount: number;
  excellentRatio: number;
  goodCount: number;
  goodRatio: number;
  poorCount: number;
  poorRatio: number;
  whisperCount: number;
  normalCount: number;
  loudCount: number;
  shoutCount: number;
  needReplaceCount: number;
  needReplaceRatio: number;
  blindSpotCount: number;
  lastTestTime: string | null;
}

export type CompareMetricKey =
  | 'avgTotalScore'
  | 'avgSensitivityScore'
  | 'excellentRatio'
  | 'poorRatio'
  | 'needReplaceRatio'
  | 'testedFloorsRatio';

export interface CompareMetricConfig {
  key: CompareMetricKey;
  label: string;
  unit: string;
  isPercentage: boolean;
  higherIsBetter: boolean;
  color: string;
}

export const COMPARE_METRICS: CompareMetricConfig[] = [
  {
    key: 'avgTotalScore',
    label: '平均综合得分',
    unit: '分',
    isPercentage: false,
    higherIsBetter: true,
    color: '#FF6B35'
  },
  {
    key: 'avgSensitivityScore',
    label: '平均灵敏度',
    unit: '分',
    isPercentage: false,
    higherIsBetter: true,
    color: '#8B5CF6'
  },
  {
    key: 'excellentRatio',
    label: '优秀率',
    unit: '%',
    isPercentage: true,
    higherIsBetter: true,
    color: '#10B981'
  },
  {
    key: 'poorRatio',
    label: '较差率',
    unit: '%',
    isPercentage: true,
    higherIsBetter: false,
    color: '#F59E0B'
  },
  {
    key: 'needReplaceRatio',
    label: '待更换比例',
    unit: '%',
    isPercentage: true,
    higherIsBetter: false,
    color: '#EF4444'
  },
  {
    key: 'testedFloorsRatio',
    label: '已测覆盖率',
    unit: '%',
    isPercentage: true,
    higherIsBetter: true,
    color: '#0EA5E9'
  }
];

export type ComplaintStatus = 'pending' | 'replied' | 'processing' | 'resolved';

export interface PropertyFeedback {
  replyContent: string;
  replyTime: string;
  attitudeScore: number;
  speedScore: number;
  overallScore: number;
  note?: string;
}

export interface ComplaintRecord {
  id: string;
  buildingId: string;
  buildingName: string;
  complaintText: string;
  complaintTime: string;
  poorFloors: number[];
  photoCount: number;
  status: ComplaintStatus;
  feedback?: PropertyFeedback;
}

export const COMPLAINT_STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  pending: { label: '待回复', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)', icon: '⏳' },
  replied: { label: '已回复', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)', icon: '📨' },
  processing: { label: '处理中', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)', icon: '🔧' },
  resolved: { label: '已解决', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)', icon: '✅' }
};
