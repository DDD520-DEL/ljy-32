import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Building, TestRecord, RankItem, BrandRankItem, ContributorInfo, NeighborUser, InvitationCode, CollaborationSession, RepairRecord, RepairStatus, RetestReminder, RetestCycle, ReportType, ReportData, BuildingStats, ComplaintRecord, ComplaintStatus, PropertyFeedback, ScoreWeights } from '../types';
import { DEFAULT_SCORE_WEIGHTS, GRADE_CONFIG, UNKNOWN_BRAND } from '../types';
import { storage, calculateScore, generateId, getDaysSinceDate, isDataStale, isRetestOverdue, getDaysOverdue, getRetestDueDate } from '../utils/storage';
import { invitation, neighborStorage } from '../utils/invitation';
import { generateReport } from '../utils/reportUtils';

interface DataContextType {
  buildings: Building[];
  records: TestRecord[];
  repairRecords: RepairRecord[];
  complaintRecords: ComplaintRecord[];
  currentBuildingId: string;
  currentUser: NeighborUser | null;
  collaborations: CollaborationSession[];
  scoreWeights: ScoreWeights;
  setCurrentBuildingId: (id: string) => void;
  addBuilding: (building: Omit<Building, 'id' | 'createTime'>) => void;
  updateBuilding: (building: Building) => void;
  deleteBuilding: (id: string) => void;
  addRecord: (record: Omit<TestRecord, 'id' | 'totalScore' | 'grade' | 'testTime'>) => void;
  deleteRecord: (id: string) => void;
  updateScoreWeights: (weights: ScoreWeights) => void;
  calculateRecordScore: (record: TestRecord) => { totalScore: number; grade: 'excellent' | 'good' | 'poor' };
  getRankList: () => RankItem[];
  getBrandRankList: () => BrandRankItem[];
  getCurrentBuilding: () => Building | undefined;
  getRecordsByCurrentBuilding: () => TestRecord[];
  getRecordsByBuilding: (buildingId: string) => TestRecord[];
  generateInvitation: () => InvitationCode | null;
  joinByCode: (code: string) => { success: boolean; reason?: string; buildingId?: string };
  setCurrentUserName: (name: string) => void;
  getParticipants: (buildingId: string) => NeighborUser[];
  getRecordsByFloor: (buildingId: string, floor: number) => TestRecord[];
  getRepairRecordsByBuilding: (buildingId: string) => RepairRecord[];
  getRepairRecordByFloor: (buildingId: string, floor: number) => RepairRecord | undefined;
  createOrUpdateRepairRecord: (record: Omit<RepairRecord, 'id' | 'statusUpdateTime'>) => void;
  markFloorComplaint: (buildingId: string, floor: number, issues: string) => void;
  updateRepairStatus: (id: string, status: RepairStatus, note?: string) => void;
  updateBuildingRetestCycle: (buildingId: string, cycle: RetestCycle, customDays?: number) => void;
  getRetestReminders: () => RetestReminder[];
  getFloorLastTestTime: (buildingId: string, floor: number) => string | null;
  getReportData: (type: ReportType) => ReportData | null;
  getBuildingStats: (buildingId: string) => BuildingStats | null;
  getMultiBuildingStats: (buildingIds: string[]) => BuildingStats[];
  getComplaintRecordsByBuilding: (buildingId: string) => ComplaintRecord[];
  addComplaintRecord: (record: Omit<ComplaintRecord, 'id'>) => void;
  updateComplaintStatus: (id: string, status: ComplaintStatus) => void;
  updateComplaintFeedback: (id: string, feedback: PropertyFeedback) => void;
  deleteComplaintRecord: (id: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [repairRecords, setRepairRecords] = useState<RepairRecord[]>([]);
  const [complaintRecords, setComplaintRecords] = useState<ComplaintRecord[]>([]);
  const [currentBuildingId, setCurrentBuildingId] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<NeighborUser | null>(null);
  const [collaborations, setCollaborations] = useState<CollaborationSession[]>([]);
  const [scoreWeights, setScoreWeights] = useState<ScoreWeights>({ ...DEFAULT_SCORE_WEIGHTS });

  useEffect(() => {
    setBuildings(storage.getBuildings());
    setRecords(storage.getRecords());
    setRepairRecords(storage.getRepairRecords());
    setComplaintRecords(storage.getComplaintRecords());
    setCurrentBuildingId(storage.getCurrentBuildingId());
    setCurrentUser(neighborStorage.getCurrentUser());
    setCollaborations(neighborStorage.getCollaborations());
    setScoreWeights(storage.getScoreWeights());
  }, []);

  const calculateRecordScore = (record: TestRecord): { totalScore: number; grade: 'excellent' | 'good' | 'poor' } => {
    return calculateScore(record.sensitivityScore, record.duration, record.hasBlindSpot, scoreWeights);
  };

  const updateScoreWeights = (weights: ScoreWeights) => {
    const normalized = {
      sensitivityWeight: Math.max(0, Math.min(100, weights.sensitivityWeight)),
      durationWeight: Math.max(0, Math.min(100, weights.durationWeight))
    };
    const total = normalized.sensitivityWeight + normalized.durationWeight;
    if (total !== 100) {
      const ratio = 100 / total;
      normalized.sensitivityWeight = Math.round(normalized.sensitivityWeight * ratio);
      normalized.durationWeight = 100 - normalized.sensitivityWeight;
    }
    setScoreWeights(normalized);
    storage.saveScoreWeights(normalized);
  };

  useEffect(() => {
    storage.saveCurrentBuildingId(currentBuildingId);
  }, [currentBuildingId]);

  const addBuilding = (building: Omit<Building, 'id' | 'createTime'>) => {
    const newBuilding: Building = {
      ...building,
      id: generateId(),
      createTime: new Date().toISOString(),
      retestCycle: 'two_weeks'
    };
    const updated = storage.addBuilding(newBuilding);
    setBuildings(updated);
    if (!currentBuildingId) {
      setCurrentBuildingId(newBuilding.id);
    }
  };

  const updateBuilding = (building: Building) => {
    const updated = storage.updateBuilding(building);
    setBuildings(updated);
  };

  const deleteBuilding = (id: string) => {
    const updated = storage.deleteBuilding(id);
    setBuildings(updated);
    setRecords(storage.getRecords());
    if (currentBuildingId === id) {
      setCurrentBuildingId(updated[0]?.id || '');
    }
  };

  const addRecord = (record: Omit<TestRecord, 'id' | 'totalScore' | 'grade' | 'testTime'>) => {
    const { totalScore, grade } = calculateScore(
      record.sensitivityScore,
      record.duration,
      record.hasBlindSpot
    );

    const user = neighborStorage.ensureCurrentUser();

    const newRecord: TestRecord = {
      ...record,
      id: generateId(),
      totalScore,
      grade,
      testTime: new Date().toISOString(),
      testerId: record.testerId || user.id,
      testerName: record.testerName || user.name
    };
    const updated = storage.addRecord(newRecord);
    setRecords(updated);
  };

  const deleteRecord = (id: string) => {
    const updated = storage.deleteRecord(id);
    setRecords(updated);
  };

  const getRankList = (): RankItem[] => {
    const buildingRecords = currentBuildingId
      ? records.filter(r => r.buildingId === currentBuildingId)
      : records;

    if (buildingRecords.length === 0) return [];

    const floorMap = new Map<string, { records: TestRecord[]; buildingName: string; floor: number }>();

    buildingRecords.forEach(record => {
      const key = `${record.buildingId}-${record.floor}`;
      if (!floorMap.has(key)) {
        floorMap.set(key, {
          records: [],
          buildingName: record.buildingName,
          floor: record.floor
        });
      }
      floorMap.get(key)!.records.push(record);
    });

    const rankList: RankItem[] = Array.from(floorMap.entries()).map(([, data]) => {
      const scores = data.records.map(r => calculateRecordScore(r).totalScore);
      const averageScore = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      );

      let grade: 'excellent' | 'good' | 'poor' = 'poor';
      if (averageScore >= GRADE_CONFIG.excellent.minScore) {
        grade = 'excellent';
      } else if (averageScore >= GRADE_CONFIG.good.minScore) {
        grade = 'good';
      }

      const latestRecord = data.records.reduce((latest, record) => {
        return new Date(record.testTime) > new Date(latest.testTime) ? record : latest;
      });

      const lastTestTime = latestRecord.testTime;
      const daysSinceLastTest = getDaysSinceDate(lastTestTime);
      const isStale = isDataStale(lastTestTime, 30);

      const contributorMap = new Map<string, ContributorInfo>();
      data.records.forEach(r => {
        const testerKey = r.testerId || r.id;
        const recScore = calculateRecordScore(r);
        if (!contributorMap.has(testerKey)) {
          contributorMap.set(testerKey, {
            testerId: r.testerId || '',
            testerName: r.testerName || '匿名',
            score: recScore.totalScore,
            testTime: r.testTime,
            grade: recScore.grade
          });
        } else {
          const existing = contributorMap.get(testerKey)!;
          if (new Date(r.testTime) > new Date(existing.testTime)) {
            contributorMap.set(testerKey, {
              testerId: r.testerId || '',
              testerName: r.testerName || '匿名',
              score: recScore.totalScore,
              testTime: r.testTime,
              grade: recScore.grade
            });
          }
        }
      });

      return {
        rank: 0,
        floor: data.floor,
        buildingName: data.buildingName,
        averageScore,
        testCount: data.records.length,
        grade,
        contributors: Array.from(contributorMap.values()),
        lastTestTime,
        isStale,
        daysSinceLastTest
      };
    });

    rankList.sort((a, b) => b.averageScore - a.averageScore);
    rankList.forEach((item, index) => {
      item.rank = index + 1;
    });

    return rankList;
  };

  const getBrandRankList = (): BrandRankItem[] => {
    const buildingRecords = currentBuildingId
      ? records.filter(r => r.buildingId === currentBuildingId)
      : records;

    if (buildingRecords.length === 0) return [];

    const brandMap = new Map<string, {
      records: TestRecord[];
      models: Set<string>;
      floors: Set<string>;
    }>();

    buildingRecords.forEach(record => {
      const brand = record.lightBrand?.trim() || UNKNOWN_BRAND;
      if (!brandMap.has(brand)) {
        brandMap.set(brand, {
          records: [],
          models: new Set(),
          floors: new Set()
        });
      }
      const brandData = brandMap.get(brand)!;
      brandData.records.push(record);
      if (record.lightModel?.trim()) {
        brandData.models.add(record.lightModel.trim());
      }
      brandData.floors.add(`${record.buildingId}-${record.floor}`);
    });

    const brandList: BrandRankItem[] = Array.from(brandMap.entries()).map(([brand, data]) => {
      const scores = data.records.map(r => calculateRecordScore(r).totalScore);
      const avgScore = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      );

      let grade: 'excellent' | 'good' | 'poor' = 'poor';
      if (avgScore >= GRADE_CONFIG.excellent.minScore) {
        grade = 'excellent';
      } else if (avgScore >= GRADE_CONFIG.good.minScore) {
        grade = 'good';
      }

      let excellentCount = 0;
      let goodCount = 0;
      let poorCount = 0;
      let totalSensitivityScore = 0;

      data.records.forEach(r => {
        const recGrade = calculateRecordScore(r).grade;
        if (recGrade === 'excellent') excellentCount++;
        else if (recGrade === 'good') goodCount++;
        else poorCount++;
        totalSensitivityScore += r.sensitivityScore;
      });

      const testCount = data.records.length;
      const avgSensitivityScore = Math.round(totalSensitivityScore / testCount);

      return {
        rank: 0,
        brand,
        avgScore,
        testCount,
        floorCount: data.floors.size,
        excellentCount,
        goodCount,
        poorCount,
        excellentRatio: Math.round((excellentCount / testCount) * 100),
        poorRatio: Math.round((poorCount / testCount) * 100),
        avgSensitivityScore,
        models: Array.from(data.models),
        grade
      };
    });

    brandList.sort((a, b) => b.avgScore - a.avgScore);
    brandList.forEach((item, index) => {
      item.rank = index + 1;
    });

    return brandList;
  };

  const getCurrentBuilding = (): Building | undefined => {
    return buildings.find(b => b.id === currentBuildingId);
  };

  const getRecordsByCurrentBuilding = (): TestRecord[] => {
    return currentBuildingId
      ? records.filter(r => r.buildingId === currentBuildingId)
      : records;
  };

  const getRecordsByBuilding = (buildingId: string): TestRecord[] => {
    return records.filter(r => r.buildingId === buildingId);
  };

  const getRecordsByFloor = (buildingId: string, floor: number): TestRecord[] => {
    return records.filter(r => r.buildingId === buildingId && r.floor === floor);
  };

  const generateInvitation = (): InvitationCode | null => {
    const building = getCurrentBuilding();
    if (!building) return null;

    const user = neighborStorage.ensureCurrentUser();
    neighborStorage.joinCollaboration(building.id, building.name, user);

    const inv = invitation.generateCode(
      building.id,
      building.name,
      building.address,
      building.totalFloors,
      user.name
    );

    setCollaborations(neighborStorage.getCollaborations());
    return inv;
  };

  const joinByCode = (code: string): { success: boolean; reason?: string; buildingId?: string } => {
    const result = invitation.isCodeValid(code);
    if (!result.valid) {
      return { success: false, reason: result.reason };
    }

    const invData = result.invitation!;
    const user = neighborStorage.ensureCurrentUser();

    let building = buildings.find(b => b.id === invData.buildingId);
    if (!building) {
      const updated = storage.addBuildingWithId(
        invData.buildingId,
        invData.buildingName,
        invData.address,
        invData.totalFloors
      );
      setBuildings(updated);
      building = updated.find(b => b.id === invData.buildingId);
    }

    if (building) {
      neighborStorage.joinCollaboration(building.id, building.name, user);
      setCurrentBuildingId(building.id);
      setCollaborations(neighborStorage.getCollaborations());
    }

    return { success: true, buildingId: building?.id };
  };

  const setCurrentUserName = (name: string) => {
    const user = neighborStorage.updateUserName(name);
    setCurrentUser(user);
  };

  const getParticipants = (buildingId: string): NeighborUser[] => {
    return neighborStorage.getParticipantsByBuilding(buildingId);
  };

  const getRepairRecordsByBuilding = (buildingId: string): RepairRecord[] => {
    return storage.getRepairRecordsByBuilding(buildingId);
  };

  const getRepairRecordByFloor = (buildingId: string, floor: number): RepairRecord | undefined => {
    return storage.getRepairRecordByFloor(buildingId, floor);
  };

  const createOrUpdateRepairRecord = (record: Omit<RepairRecord, 'id' | 'statusUpdateTime'>) => {
    const updated = storage.upsertRepairRecord(record);
    setRepairRecords(updated);
  };

  const markFloorComplaint = (buildingId: string, floor: number, issues: string) => {
    const building = buildings.find(b => b.id === buildingId);
    const existing = storage.getRepairRecordByFloor(buildingId, floor);
    const now = new Date().toISOString();

    if (existing) {
      const updated = storage.markComplaint(buildingId, floor);
      setRepairRecords(updated);
    } else {
      const updated = storage.upsertRepairRecord({
        buildingId,
        buildingName: building?.name || '',
        floor,
        status: 'pending',
        complaintMarked: true,
        complaintTime: now,
        issues
      });
      setRepairRecords(updated);
    }
  };

  const updateRepairStatus = (id: string, status: RepairStatus, note?: string) => {
    const updated = storage.updateRepairStatus(id, status, note);
    setRepairRecords(updated);
  };

  const updateBuildingRetestCycle = (buildingId: string, cycle: RetestCycle, customDays?: number) => {
    const building = buildings.find(b => b.id === buildingId);
    if (building) {
      const updatedBuilding: Building = {
        ...building,
        retestCycle: cycle,
        customRetestDays: customDays
      };
      const updated = storage.updateBuilding(updatedBuilding);
      setBuildings(updated);
    }
  };

  const getFloorLastTestTime = (buildingId: string, floor: number): string | null => {
    const floorRecords = records.filter(
      r => r.buildingId === buildingId && r.floor === floor
    );
    if (floorRecords.length === 0) return null;
    
    const latestRecord = floorRecords.reduce((latest, record) => {
      return new Date(record.testTime) > new Date(latest.testTime) ? record : latest;
    });
    return latestRecord.testTime;
  };

  const getReportData = (type: ReportType): ReportData | null => {
    const building = getCurrentBuilding();
    if (!building) return null;
    const buildingRecords = getRecordsByCurrentBuilding();
    return generateReport(type, building, buildingRecords, scoreWeights);
  };

  const calculateBuildingStats = (building: Building, buildingRecords: TestRecord[]): BuildingStats => {
    const totalTests = buildingRecords.length;
    const totalFloors = building.totalFloors;

    const testedFloorSet = new Set(buildingRecords.map(r => r.floor));
    const testedFloors = testedFloorSet.size;
    const testedFloorsRatio = totalFloors > 0 ? Math.round((testedFloors / totalFloors) * 100) : 0;

    let avgSensitivityScore = 0;
    let avgTotalScore = 0;
    let excellentCount = 0;
    let goodCount = 0;
    let poorCount = 0;
    let whisperCount = 0;
    let normalCount = 0;
    let loudCount = 0;
    let shoutCount = 0;
    let needReplaceCount = 0;
    let blindSpotCount = 0;
    let lastTestTime: string | null = null;

    if (totalTests > 0) {
      const totalSensitivity = buildingRecords.reduce((sum, r) => sum + r.sensitivityScore, 0);
      const totalScoreSum = buildingRecords.reduce((sum, r) => sum + calculateRecordScore(r).totalScore, 0);
      avgSensitivityScore = Math.round(totalSensitivity / totalTests);
      avgTotalScore = Math.round(totalScoreSum / totalTests);

      excellentCount = buildingRecords.filter(r => calculateRecordScore(r).grade === 'excellent').length;
      goodCount = buildingRecords.filter(r => calculateRecordScore(r).grade === 'good').length;
      poorCount = buildingRecords.filter(r => calculateRecordScore(r).grade === 'poor').length;

      whisperCount = buildingRecords.filter(r => r.sensitivityLevel === 'whisper').length;
      normalCount = buildingRecords.filter(r => r.sensitivityLevel === 'normal').length;
      loudCount = buildingRecords.filter(r => r.sensitivityLevel === 'loud').length;
      shoutCount = buildingRecords.filter(r => r.sensitivityLevel === 'shout').length;

      needReplaceCount = buildingRecords.filter(r => calculateRecordScore(r).grade === 'poor' || r.sensitivityLevel === 'shout').length;
      blindSpotCount = buildingRecords.filter(r => r.hasBlindSpot).length;

      const latestRecord = buildingRecords.reduce((latest, record) => {
        return new Date(record.testTime) > new Date(latest.testTime) ? record : latest;
      });
      lastTestTime = latestRecord.testTime;
    }

    const excellentRatio = totalTests > 0 ? Math.round((excellentCount / totalTests) * 100) : 0;
    const goodRatio = totalTests > 0 ? Math.round((goodCount / totalTests) * 100) : 0;
    const poorRatio = totalTests > 0 ? Math.round((poorCount / totalTests) * 100) : 0;
    const needReplaceRatio = totalTests > 0 ? Math.round((needReplaceCount / totalTests) * 100) : 0;

    return {
      buildingId: building.id,
      buildingName: building.name,
      address: building.address,
      totalFloors,
      totalTests,
      testedFloors,
      testedFloorsRatio,
      avgSensitivityScore,
      avgTotalScore,
      excellentCount,
      excellentRatio,
      goodCount,
      goodRatio,
      poorCount,
      poorRatio,
      whisperCount,
      normalCount,
      loudCount,
      shoutCount,
      needReplaceCount,
      needReplaceRatio,
      blindSpotCount,
      lastTestTime
    };
  };

  const getBuildingStats = (buildingId: string): BuildingStats | null => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building) return null;
    const buildingRecords = records.filter(r => r.buildingId === buildingId);
    return calculateBuildingStats(building, buildingRecords);
  };

  const getMultiBuildingStats = (buildingIds: string[]): BuildingStats[] => {
    return buildingIds
      .map(id => getBuildingStats(id))
      .filter((s): s is BuildingStats => s !== null);
  };

  const getRetestReminders = (): RetestReminder[] => {
    const reminders: RetestReminder[] = [];
    
    buildings.forEach(building => {
      const buildingRecords = records.filter(r => r.buildingId === building.id);
      if (buildingRecords.length === 0) return;

      const floorMap = new Map<number, TestRecord[]>();
      buildingRecords.forEach(record => {
        if (!floorMap.has(record.floor)) {
          floorMap.set(record.floor, []);
        }
        floorMap.get(record.floor)!.push(record);
      });

      floorMap.forEach((floorRecords, floor) => {
        const latestRecord = floorRecords.reduce((latest, record) => {
          return new Date(record.testTime) > new Date(latest.testTime) ? record : latest;
        });

        if (isRetestOverdue(latestRecord.testTime, building.retestCycle, building.customRetestDays)) {
          const daysOverdue = getDaysOverdue(latestRecord.testTime, building.retestCycle, building.customRetestDays);
          reminders.push({
            id: `${building.id}-${floor}`,
            buildingId: building.id,
            buildingName: building.name,
            floor,
            lastTestTime: latestRecord.testTime,
            retestDueDate: getRetestDueDate(latestRecord.testTime, building.retestCycle, building.customRetestDays),
            daysOverdue,
            retestCycle: building.retestCycle
          });
        }
      });
    });

    reminders.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return reminders;
  };

  const getComplaintRecordsByBuilding = (buildingId: string): ComplaintRecord[] => {
    return storage.getComplaintRecordsByBuilding(buildingId);
  };

  const addComplaintRecord = (record: Omit<ComplaintRecord, 'id'>) => {
    const updated = storage.addComplaintRecord(record);
    setComplaintRecords(updated);
  };

  const updateComplaintStatus = (id: string, status: ComplaintStatus) => {
    const updated = storage.updateComplaintStatus(id, status);
    setComplaintRecords(updated);
  };

  const updateComplaintFeedback = (id: string, feedback: PropertyFeedback) => {
    const updated = storage.updateComplaintFeedback(id, feedback);
    setComplaintRecords(updated);
  };

  const deleteComplaintRecord = (id: string) => {
    const updated = storage.deleteComplaintRecord(id);
    setComplaintRecords(updated);
  };

  return (
    <DataContext.Provider
      value={{
        buildings,
        records,
        repairRecords,
        complaintRecords,
        currentBuildingId,
        currentUser,
        collaborations,
        scoreWeights,
        setCurrentBuildingId,
        addBuilding,
        updateBuilding,
        deleteBuilding,
        addRecord,
        deleteRecord,
        updateScoreWeights,
        calculateRecordScore,
        getRankList,
        getBrandRankList,
        getCurrentBuilding,
        getRecordsByCurrentBuilding,
        getRecordsByBuilding,
        generateInvitation,
        joinByCode,
        setCurrentUserName,
        getParticipants,
        getRecordsByFloor,
        getRepairRecordsByBuilding,
        getRepairRecordByFloor,
        createOrUpdateRepairRecord,
        markFloorComplaint,
        updateRepairStatus,
        updateBuildingRetestCycle,
        getRetestReminders,
        getFloorLastTestTime,
        getReportData,
        getBuildingStats,
        getMultiBuildingStats,
        getComplaintRecordsByBuilding,
        addComplaintRecord,
        updateComplaintStatus,
        updateComplaintFeedback,
        deleteComplaintRecord
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
