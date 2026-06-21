import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Building, TestRecord, RankItem, ContributorInfo, NeighborUser, InvitationCode, CollaborationSession, RepairRecord, RepairStatus, RetestReminder, RetestCycle } from '../types';
import { storage, calculateScore, generateId, getDaysSinceDate, isDataStale, isRetestOverdue, getDaysOverdue, getRetestDueDate } from '../utils/storage';
import { invitation, neighborStorage } from '../utils/invitation';

interface DataContextType {
  buildings: Building[];
  records: TestRecord[];
  repairRecords: RepairRecord[];
  currentBuildingId: string;
  currentUser: NeighborUser | null;
  collaborations: CollaborationSession[];
  setCurrentBuildingId: (id: string) => void;
  addBuilding: (building: Omit<Building, 'id' | 'createTime'>) => void;
  updateBuilding: (building: Building) => void;
  deleteBuilding: (id: string) => void;
  addRecord: (record: Omit<TestRecord, 'id' | 'totalScore' | 'grade' | 'testTime'>) => void;
  deleteRecord: (id: string) => void;
  getRankList: () => RankItem[];
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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [repairRecords, setRepairRecords] = useState<RepairRecord[]>([]);
  const [currentBuildingId, setCurrentBuildingId] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<NeighborUser | null>(null);
  const [collaborations, setCollaborations] = useState<CollaborationSession[]>([]);

  useEffect(() => {
    setBuildings(storage.getBuildings());
    setRecords(storage.getRecords());
    setRepairRecords(storage.getRepairRecords());
    setCurrentBuildingId(storage.getCurrentBuildingId());
    setCurrentUser(neighborStorage.getCurrentUser());
    setCollaborations(neighborStorage.getCollaborations());
  }, []);

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
      const scores = data.records.map(r => r.totalScore);
      const averageScore = Math.round(
        scores.reduce((a, b) => a + b, 0) / scores.length
      );

      let grade: 'excellent' | 'good' | 'poor' = 'poor';
      if (averageScore >= 80) {
        grade = 'excellent';
      } else if (averageScore >= 50) {
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
        if (!contributorMap.has(testerKey)) {
          contributorMap.set(testerKey, {
            testerId: r.testerId || '',
            testerName: r.testerName || '匿名',
            score: r.totalScore,
            testTime: r.testTime,
            grade: r.grade
          });
        } else {
          const existing = contributorMap.get(testerKey)!;
          if (new Date(r.testTime) > new Date(existing.testTime)) {
            contributorMap.set(testerKey, {
              testerId: r.testerId || '',
              testerName: r.testerName || '匿名',
              score: r.totalScore,
              testTime: r.testTime,
              grade: r.grade
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

  return (
    <DataContext.Provider
      value={{
        buildings,
        records,
        repairRecords,
        currentBuildingId,
        currentUser,
        collaborations,
        setCurrentBuildingId,
        addBuilding,
        updateBuilding,
        deleteBuilding,
        addRecord,
        deleteRecord,
        getRankList,
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
        getFloorLastTestTime
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
