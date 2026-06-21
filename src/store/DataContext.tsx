import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Building, TestRecord, RankItem } from '../types';
import { storage, calculateScore, generateId } from '../utils/storage';

interface DataContextType {
  buildings: Building[];
  records: TestRecord[];
  currentBuildingId: string;
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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [records, setRecords] = useState<TestRecord[]>([]);
  const [currentBuildingId, setCurrentBuildingId] = useState<string>('');

  useEffect(() => {
    setBuildings(storage.getBuildings());
    setRecords(storage.getRecords());
    setCurrentBuildingId(storage.getCurrentBuildingId());
  }, []);

  useEffect(() => {
    storage.saveCurrentBuildingId(currentBuildingId);
  }, [currentBuildingId]);

  const addBuilding = (building: Omit<Building, 'id' | 'createTime'>) => {
    const newBuilding: Building = {
      ...building,
      id: generateId(),
      createTime: new Date().toISOString()
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
    const newRecord: TestRecord = {
      ...record,
      id: generateId(),
      totalScore,
      grade,
      testTime: new Date().toISOString()
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

    const floorMap = new Map<string, { scores: number[]; buildingName: string; floor: number }>();

    buildingRecords.forEach(record => {
      const key = `${record.buildingId}-${record.floor}`;
      if (!floorMap.has(key)) {
        floorMap.set(key, {
          scores: [],
          buildingName: record.buildingName,
          floor: record.floor
        });
      }
      floorMap.get(key)!.scores.push(record.totalScore);
    });

    const rankList: RankItem[] = Array.from(floorMap.entries()).map(([, data]) => {
      const averageScore = Math.round(
        data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      );
      let grade: 'excellent' | 'good' | 'poor' = 'poor';
      if (averageScore >= 80) {
        grade = 'excellent';
      } else if (averageScore >= 50) {
        grade = 'good';
      }
      return {
        rank: 0,
        floor: data.floor,
        buildingName: data.buildingName,
        averageScore,
        testCount: data.scores.length,
        grade
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

  return (
    <DataContext.Provider
      value={{
        buildings,
        records,
        currentBuildingId,
        setCurrentBuildingId,
        addBuilding,
        updateBuilding,
        deleteBuilding,
        addRecord,
        deleteRecord,
        getRankList,
        getCurrentBuilding,
        getRecordsByCurrentBuilding,
        getRecordsByBuilding
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
