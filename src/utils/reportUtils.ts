import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { Building, TestRecord, ReportData, ReportType, SensitivityLevel, SensitivityTrendItem, FloorIssueChange } from '../types';
import { SENSITIVITY_CONFIG, GRADE_CONFIG } from '../types';

dayjs.extend(isoWeek);

export const getWeekRange = (date: Date = new Date()) => {
  const start = dayjs(date).startOf('isoWeek').toDate();
  const end = dayjs(date).endOf('isoWeek').toDate();
  return { start, end };
};

export const getMonthRange = (date: Date = new Date()) => {
  const start = dayjs(date).startOf('month').toDate();
  const end = dayjs(date).endOf('month').toDate();
  return { start, end };
};

export const getPrevWeekRange = (date: Date = new Date()) => {
  const prevWeek = dayjs(date).subtract(1, 'week').toDate();
  return getWeekRange(prevWeek);
};

export const getPrevMonthRange = (date: Date = new Date()) => {
  const prevMonth = dayjs(date).subtract(1, 'month').toDate();
  return getMonthRange(prevMonth);
};

export const getPeriodRange = (type: ReportType, date: Date = new Date()) => {
  if (type === 'weekly') {
    return getWeekRange(date);
  }
  return getMonthRange(date);
};

export const getPrevPeriodRange = (type: ReportType, date: Date = new Date()) => {
  if (type === 'weekly') {
    return getPrevWeekRange(date);
  }
  return getPrevMonthRange(date);
};

const filterRecordsByDateRange = (
  records: TestRecord[],
  start: Date,
  end: Date
): TestRecord[] => {
  return records.filter(r => {
    const t = new Date(r.testTime).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
};

const formatPeriodLabel = (type: ReportType, start: Date, end: Date): string => {
  const s = dayjs(start);
  const e = dayjs(end);
  if (type === 'weekly') {
    const weekNum = s.isoWeek();
    if (s.year() === e.year()) {
      return `${s.year()}年第${weekNum}周 (${s.format('MM.DD')}-${e.format('MM.DD')})`;
    }
    return `${s.format('YYYY.MM.DD')}-${e.format('YYYY.MM.DD')} 第${weekNum}周`;
  }
  return s.format('YYYY年M月');
};

const calculateSensitivityDist = (records: TestRecord[]): Record<SensitivityLevel, number> => {
  const dist: Record<SensitivityLevel, number> = { whisper: 0, normal: 0, loud: 0, shout: 0 };
  records.forEach(r => {
    dist[r.sensitivityLevel]++;
  });
  return dist;
};

const calculateGradeFromScore = (score: number): 'excellent' | 'good' | 'poor' => {
  if (score >= GRADE_CONFIG.excellent.minScore) return 'excellent';
  if (score >= GRADE_CONFIG.good.minScore) return 'good';
  return 'poor';
};

const getFloorAvgScoreMap = (records: TestRecord[]): Map<number, { score: number; count: number; grade: 'excellent' | 'good' | 'poor' }> => {
  const map = new Map<number, { total: number; count: number }>();
  records.forEach(r => {
    const existing = map.get(r.floor) || { total: 0, count: 0 };
    map.set(r.floor, { total: existing.total + r.totalScore, count: existing.count + 1 });
  });
  const result = new Map<number, { score: number; count: number; grade: 'excellent' | 'good' | 'poor' }>();
  map.forEach((v, floor) => {
    const score = Math.round(v.total / v.count);
    result.set(floor, { score, count: v.count, grade: calculateGradeFromScore(score) });
  });
  return result;
};

const generateSensitivityTrend = (
  type: ReportType,
  records: TestRecord[],
  start: Date,
  end: Date
): SensitivityTrendItem[] => {
  const trend: SensitivityTrendItem[] = [];
  if (type === 'weekly') {
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    for (let i = 0; i < 7; i++) {
      const dayStart = dayjs(start).add(i, 'day').startOf('day').toDate();
      const dayEnd = dayjs(start).add(i, 'day').endOf('day').toDate();
      const dayRecords = filterRecordsByDateRange(records, dayStart, dayEnd);
      const avgScore = dayRecords.length > 0
        ? Math.round(dayRecords.reduce((sum, r) => sum + r.totalScore, 0) / dayRecords.length)
        : 0;
      trend.push({
        date: dayjs(dayStart).format('YYYY-MM-DD'),
        label: dayNames[i],
        avgScore,
        count: dayRecords.length
      });
    }
  } else {
    const daysInMonth = dayjs(end).date();
    const step = Math.max(1, Math.floor(daysInMonth / 10));
    for (let d = 1; d <= daysInMonth; d += step) {
      const segStart = dayjs(start).date(d).startOf('day').toDate();
      const segEndDate = Math.min(d + step - 1, daysInMonth);
      const segEnd = dayjs(start).date(segEndDate).endOf('day').toDate();
      const segRecords = filterRecordsByDateRange(records, segStart, segEnd);
      const avgScore = segRecords.length > 0
        ? Math.round(segRecords.reduce((sum, r) => sum + r.totalScore, 0) / segRecords.length)
        : 0;
      const label = step === 1 ? `${d}日` : `${d}-${segEndDate}日`;
      trend.push({
        date: dayjs(segStart).format('YYYY-MM-DD'),
        label,
        avgScore,
        count: segRecords.length
      });
    }
  }
  return trend;
};

const calculateFloorChanges = (
  currRecords: TestRecord[],
  prevRecords: TestRecord[]
): { improved: FloorIssueChange[]; declined: FloorIssueChange[]; unchanged: FloorIssueChange[]; new: FloorIssueChange[] } => {
  const currMap = getFloorAvgScoreMap(currRecords);
  const prevMap = getFloorAvgScoreMap(prevRecords);

  const improved: FloorIssueChange[] = [];
  const declined: FloorIssueChange[] = [];
  const unchanged: FloorIssueChange[] = [];
  const newFloors: FloorIssueChange[] = [];

  currMap.forEach((curr, floor) => {
    const prev = prevMap.get(floor);
    if (!prev) {
      newFloors.push({
        floor,
        prevGrade: 'none',
        currGrade: curr.grade,
        change: 'new',
        scoreChange: curr.score
      });
    } else {
      const scoreChange = curr.score - prev.score;
      let change: FloorIssueChange['change'] = 'unchanged';
      if (scoreChange >= 10) change = 'improved';
      else if (scoreChange <= -10) change = 'declined';
      const item: FloorIssueChange = {
        floor,
        prevGrade: prev.grade,
        currGrade: curr.grade,
        change,
        scoreChange
      };
      if (change === 'improved') improved.push(item);
      else if (change === 'declined') declined.push(item);
      else unchanged.push(item);
    }
  });

  improved.sort((a, b) => b.scoreChange - a.scoreChange);
  declined.sort((a, b) => a.scoreChange - b.scoreChange);
  newFloors.sort((a, b) => b.scoreChange - a.scoreChange);

  return { improved, declined, unchanged, new: newFloors };
};

const getContributors = (records: TestRecord[]): Array<{ testerName: string; testCount: number }> => {
  const map = new Map<string, number>();
  records.forEach(r => {
    const name = r.testerName || '匿名';
    map.set(name, (map.get(name) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([testerName, testCount]) => ({ testerName, testCount }))
    .sort((a, b) => b.testCount - a.testCount)
    .slice(0, 5);
};

export const generateReport = (
  type: ReportType,
  building: Building,
  buildingRecords: TestRecord[]
): ReportData | null => {
  if (!building || buildingRecords.length === 0) return null;

  const now = new Date();
  const { start: currStart, end: currEnd } = getPeriodRange(type, now);
  const { start: prevStart, end: prevEnd } = getPrevPeriodRange(type, now);

  const currRecords = filterRecordsByDateRange(buildingRecords, currStart, currEnd);
  const prevRecords = filterRecordsByDateRange(buildingRecords, prevStart, prevEnd);

  if (currRecords.length === 0) {
    return null;
  }

  const newTestCount = currRecords.length;
  const prevPeriodTestCount = prevRecords.length;

  const testedFloorSet = new Set(currRecords.map(r => r.floor));
  const testedFloorsPrevSet = new Set(prevRecords.map(r => r.floor));

  const avgScore = currRecords.length > 0
    ? Math.round(currRecords.reduce((sum, r) => sum + r.totalScore, 0) / currRecords.length)
    : 0;
  const avgScorePrev = prevRecords.length > 0
    ? Math.round(prevRecords.reduce((sum, r) => sum + r.totalScore, 0) / prevRecords.length)
    : 0;

  const sensitivityLevelDist = calculateSensitivityDist(currRecords);
  const sensitivityLevelDistPrev = calculateSensitivityDist(prevRecords);

  const sensitivityTrend = generateSensitivityTrend(type, buildingRecords, currStart, currEnd);

  const excellentCount = currRecords.filter(r => r.grade === 'excellent').length;
  const goodCount = currRecords.filter(r => r.grade === 'good').length;
  const poorCount = currRecords.filter(r => r.grade === 'poor').length;
  const excellentCountPrev = prevRecords.filter(r => r.grade === 'excellent').length;
  const goodCountPrev = prevRecords.filter(r => r.grade === 'good').length;
  const poorCountPrev = prevRecords.filter(r => r.grade === 'poor').length;

  const floorChanges = calculateFloorChanges(currRecords, prevRecords);

  const floorAvgMap = getFloorAvgScoreMap(currRecords);
  const floorList = Array.from(floorAvgMap.entries()).map(([floor, data]) => ({
    floor,
    avgScore: data.score,
    testCount: data.count,
    grade: data.grade
  }));
  const topFloors = [...floorList].sort((a, b) => b.avgScore - a.avgScore).slice(0, 3);
  const bottomFloors = [...floorList].sort((a, b) => a.avgScore - b.avgScore).slice(0, 3);

  const blindSpotRecords = currRecords.filter(r => r.hasBlindSpot);
  const blindSpotCount = blindSpotRecords.length;
  const blindSpotFloors = Array.from(new Set(blindSpotRecords.map(r => r.floor))).sort((a, b) => a - b);

  const contributors = getContributors(currRecords);

  return {
    type,
    buildingId: building.id,
    buildingName: building.name,
    address: building.address,
    totalFloors: building.totalFloors,
    periodStart: currStart.toISOString(),
    periodEnd: currEnd.toISOString(),
    periodLabel: formatPeriodLabel(type, currStart, currEnd),
    generateTime: now.toISOString(),
    newTestCount,
    prevPeriodTestCount,
    testCountChange: newTestCount - prevPeriodTestCount,
    testedFloors: testedFloorSet.size,
    testedFloorsPrev: testedFloorsPrevSet.size,
    avgScore,
    avgScorePrev,
    avgScoreChange: avgScore - avgScorePrev,
    sensitivityLevelDist,
    sensitivityLevelDistPrev,
    sensitivityTrend,
    excellentCount,
    goodCount,
    poorCount,
    excellentCountPrev,
    goodCountPrev,
    poorCountPrev,
    improvedFloors: floorChanges.improved,
    declinedFloors: floorChanges.declined,
    unchangedFloors: floorChanges.unchanged,
    newFloors: floorChanges.new,
    topFloors,
    bottomFloors,
    blindSpotCount,
    blindSpotFloors,
    contributors
  };
};

export const formatReportDate = (iso: string): string => {
  return dayjs(iso).format('YYYY年M月D日');
};

export const formatReportDateTime = (iso: string): string => {
  return dayjs(iso).format('YYYY.MM.DD HH:mm');
};
