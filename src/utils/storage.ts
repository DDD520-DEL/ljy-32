import Taro from '@tarojs/taro';
import type { Building, TestRecord } from '../types';

const BUILDINGS_KEY = 'light_evaluator_buildings';
const RECORDS_KEY = 'light_evaluator_records';
const CURRENT_BUILDING_KEY = 'light_evaluator_current_building';

export const storage = {
  getBuildings(): Building[] {
    try {
      const data = Taro.getStorageSync(BUILDINGS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] getBuildings error:', e);
      return [];
    }
  },

  saveBuildings(buildings: Building[]): void {
    try {
      Taro.setStorageSync(BUILDINGS_KEY, JSON.stringify(buildings));
    } catch (e) {
      console.error('[Storage] saveBuildings error:', e);
    }
  },

  getRecords(): TestRecord[] {
    try {
      const data = Taro.getStorageSync(RECORDS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] getRecords error:', e);
      return [];
    }
  },

  saveRecords(records: TestRecord[]): void {
    try {
      Taro.setStorageSync(RECORDS_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('[Storage] saveRecords error:', e);
    }
  },

  getCurrentBuildingId(): string {
    try {
      return Taro.getStorageSync(CURRENT_BUILDING_KEY) || '';
    } catch (e) {
      console.error('[Storage] getCurrentBuildingId error:', e);
      return '';
    }
  },

  saveCurrentBuildingId(id: string): void {
    try {
      Taro.setStorageSync(CURRENT_BUILDING_KEY, id);
    } catch (e) {
      console.error('[Storage] saveCurrentBuildingId error:', e);
    }
  },

  addBuilding(building: Building): Building[] {
    const buildings = this.getBuildings();
    buildings.push(building);
    this.saveBuildings(buildings);
    return buildings;
  },

  addBuildingWithId(id: string, name: string, address: string, totalFloors: number): Building[] {
    const buildings = this.getBuildings();
    const exists = buildings.find(b => b.id === id);
    if (exists) return buildings;
    const newBuilding: Building = {
      id,
      name,
      address,
      totalFloors,
      createTime: new Date().toISOString()
    };
    buildings.push(newBuilding);
    this.saveBuildings(buildings);
    return buildings;
  },

  updateBuilding(building: Building): Building[] {
    const buildings = this.getBuildings();
    const index = buildings.findIndex(b => b.id === building.id);
    if (index > -1) {
      buildings[index] = building;
      this.saveBuildings(buildings);
    }
    return buildings;
  },

  deleteBuilding(id: string): Building[] {
    const buildings = this.getBuildings().filter(b => b.id !== id);
    this.saveBuildings(buildings);
    const records = this.getRecords().filter(r => r.buildingId !== id);
    this.saveRecords(records);
    return buildings;
  },

  addRecord(record: TestRecord): TestRecord[] {
    const records = this.getRecords();
    records.push(record);
    this.saveRecords(records);
    return records;
  },

  deleteRecord(id: string): TestRecord[] {
    const records = this.getRecords().filter(r => r.id !== id);
    this.saveRecords(records);
    return records;
  },

  getRecordsByBuilding(buildingId: string): TestRecord[] {
    return this.getRecords().filter(r => r.buildingId === buildingId);
  },

  getRecordsByFloor(buildingId: string, floor: number): TestRecord[] {
    return this.getRecords().filter(
      r => r.buildingId === buildingId && r.floor === floor
    );
  }
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const calculateScore = (
  sensitivityScore: number,
  duration: number,
  hasBlindSpot: boolean
): { totalScore: number; grade: 'excellent' | 'good' | 'poor' } => {
  let durationScore = 50;
  if (duration >= 30 && duration <= 60) {
    durationScore = 100;
  } else if (duration >= 15 && duration < 30) {
    durationScore = 80;
  } else if (duration > 60 && duration <= 120) {
    durationScore = 70;
  } else if (duration < 15) {
    durationScore = 40;
  } else {
    durationScore = 30;
  }

  const blindSpotPenalty = hasBlindSpot ? 20 : 0;
  const totalScore = Math.round((sensitivityScore * 0.5 + durationScore * 0.5) - blindSpotPenalty);
  const finalScore = Math.max(0, Math.min(100, totalScore));

  let grade: 'excellent' | 'good' | 'poor' = 'poor';
  if (finalScore >= 80) {
    grade = 'excellent';
  } else if (finalScore >= 50) {
    grade = 'good';
  }

  return { totalScore: finalScore, grade };
};

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};
