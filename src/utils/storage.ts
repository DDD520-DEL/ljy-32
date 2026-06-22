import Taro from '@tarojs/taro';
import type { Building, TestRecord, RepairRecord, RepairStatus, RetestCycle, ComplaintRecord, ComplaintStatus, PropertyFeedback } from '../types';
import { RETEST_CYCLE_CONFIG } from '../types';

const BUILDINGS_KEY = 'light_evaluator_buildings';
const RECORDS_KEY = 'light_evaluator_records';
const CURRENT_BUILDING_KEY = 'light_evaluator_current_building';
const REPAIR_RECORDS_KEY = 'light_evaluator_repair_records';
const COMPLAINT_RECORDS_KEY = 'light_evaluator_complaint_records';

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
      createTime: new Date().toISOString(),
      retestCycle: 'two_weeks'
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
    const allRecords = this.getRecords();
    const buildingRecords = allRecords.filter(r => r.buildingId === id);
    buildingRecords.forEach(r => {
      if (r.photos && r.photos.length > 0) {
        r.photos.forEach(p => deletePhotoFile(p));
      }
    });
    const records = allRecords.filter(r => r.buildingId !== id);
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
    const allRecords = this.getRecords();
    const target = allRecords.find(r => r.id === id);
    if (target?.photos && target.photos.length > 0) {
      target.photos.forEach(p => deletePhotoFile(p));
    }
    const records = allRecords.filter(r => r.id !== id);
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
  },

  getRepairRecords(): RepairRecord[] {
    try {
      const data = Taro.getStorageSync(REPAIR_RECORDS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] getRepairRecords error:', e);
      return [];
    }
  },

  saveRepairRecords(records: RepairRecord[]): void {
    try {
      Taro.setStorageSync(REPAIR_RECORDS_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('[Storage] saveRepairRecords error:', e);
    }
  },

  getRepairRecordsByBuilding(buildingId: string): RepairRecord[] {
    return this.getRepairRecords().filter(r => r.buildingId === buildingId);
  },

  getRepairRecordByFloor(buildingId: string, floor: number): RepairRecord | undefined {
    return this.getRepairRecords().find(
      r => r.buildingId === buildingId && r.floor === floor
    );
  },

  addRepairRecord(record: RepairRecord): RepairRecord[] {
    const records = this.getRepairRecords();
    records.push(record);
    this.saveRepairRecords(records);
    return records;
  },

  updateRepairStatus(id: string, status: RepairStatus, note?: string): RepairRecord[] {
    const records = this.getRepairRecords();
    const index = records.findIndex(r => r.id === id);
    if (index > -1) {
      records[index] = {
        ...records[index],
        status,
        statusUpdateTime: new Date().toISOString(),
        note: note || records[index].note
      };
      this.saveRepairRecords(records);
    }
    return records;
  },

  markComplaint(buildingId: string, floor: number): RepairRecord[] {
    const records = this.getRepairRecords();
    const index = records.findIndex(
      r => r.buildingId === buildingId && r.floor === floor
    );
    const now = new Date().toISOString();
    if (index > -1) {
      records[index] = {
        ...records[index],
        complaintMarked: true,
        complaintTime: now
      };
    }
    this.saveRepairRecords(records);
    return records;
  },

  upsertRepairRecord(record: Omit<RepairRecord, 'id' | 'statusUpdateTime'> & { statusUpdateTime?: string }): RepairRecord[] {
    const records = this.getRepairRecords();
    const existingIndex = records.findIndex(
      r => r.buildingId === record.buildingId && r.floor === record.floor
    );
    const now = new Date().toISOString();
    if (existingIndex > -1) {
      records[existingIndex] = {
        ...records[existingIndex],
        ...record,
        statusUpdateTime: record.statusUpdateTime || records[existingIndex].statusUpdateTime
      };
    } else {
      records.push({
        ...record,
        id: generateId(),
        statusUpdateTime: record.statusUpdateTime || now
      });
    }
    this.saveRepairRecords(records);
    return records;
  },

  getComplaintRecords(): ComplaintRecord[] {
    try {
      const data = Taro.getStorageSync(COMPLAINT_RECORDS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[Storage] getComplaintRecords error:', e);
      return [];
    }
  },

  saveComplaintRecords(records: ComplaintRecord[]): void {
    try {
      Taro.setStorageSync(COMPLAINT_RECORDS_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('[Storage] saveComplaintRecords error:', e);
    }
  },

  getComplaintRecordsByBuilding(buildingId: string): ComplaintRecord[] {
    return this.getComplaintRecords()
      .filter(r => r.buildingId === buildingId)
      .sort((a, b) => new Date(b.complaintTime).getTime() - new Date(a.complaintTime).getTime());
  },

  addComplaintRecord(record: Omit<ComplaintRecord, 'id'>): ComplaintRecord[] {
    const records = this.getComplaintRecords();
    const newRecord: ComplaintRecord = {
      ...record,
      id: generateId()
    };
    records.push(newRecord);
    this.saveComplaintRecords(records);
    return records;
  },

  updateComplaintStatus(id: string, status: ComplaintStatus): ComplaintRecord[] {
    const records = this.getComplaintRecords();
    const index = records.findIndex(r => r.id === id);
    if (index > -1) {
      records[index] = {
        ...records[index],
        status
      };
      this.saveComplaintRecords(records);
    }
    return records;
  },

  updateComplaintFeedback(id: string, feedback: PropertyFeedback): ComplaintRecord[] {
    const records = this.getComplaintRecords();
    const index = records.findIndex(r => r.id === id);
    if (index > -1) {
      records[index] = {
        ...records[index],
        feedback,
        status: 'replied'
      };
      this.saveComplaintRecords(records);
    }
    return records;
  },

  deleteComplaintRecord(id: string): ComplaintRecord[] {
    const records = this.getComplaintRecords().filter(r => r.id !== id);
    this.saveComplaintRecords(records);
    return records;
  }
};

const PHOTOS_DIR = '/light_evaluator_photos';

export const ensurePhotosDir = (): string | null => {
  try {
    const userDataPath = Taro.env.USER_DATA_PATH;
    if (!userDataPath) return null;
    const dirPath = `${userDataPath}${PHOTOS_DIR}`;
    const fs = Taro.getFileSystemManager();
    try {
      fs.accessSync(dirPath);
    } catch {
      fs.mkdirSync(dirPath, true);
    }
    return dirPath;
  } catch (e) {
    console.error('[Storage] ensurePhotosDir error:', e);
    return null;
  }
};

export const savePhotoPermanently = (tempFilePath: string): Promise<string> => {
  return new Promise((resolve) => {
    try {
      const dirPath = ensurePhotosDir();
      if (!dirPath) {
        resolve(tempFilePath);
        return;
      }
      const ext = tempFilePath.split('.').pop() || 'jpg';
      const fileName = `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
      const permanentPath = `${dirPath}/${fileName}`;
      const fs = Taro.getFileSystemManager();
      fs.saveFile({
        tempFilePath,
        filePath: permanentPath,
        success: () => {
          resolve(permanentPath);
        },
        fail: (err) => {
          console.error('[Storage] saveFile fail:', err);
          resolve(tempFilePath);
        }
      });
    } catch (e) {
      console.error('[Storage] savePhotoPermanently error:', e);
      resolve(tempFilePath);
    }
  });
};

export const deletePhotoFile = (filePath: string): void => {
  try {
    const userDataPath = Taro.env.USER_DATA_PATH;
    if (!userDataPath || !filePath.startsWith(userDataPath)) return;
    const fs = Taro.getFileSystemManager();
    fs.unlinkSync(filePath);
  } catch (e) {
    console.error('[Storage] deletePhotoFile error:', e);
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

export const getRetestCycleDays = (cycle: RetestCycle, customDays?: number): number => {
  if (cycle === 'custom' && customDays) {
    return customDays;
  }
  return RETEST_CYCLE_CONFIG[cycle]?.days || 30;
};

export const getDaysSinceDate = (dateStr: string): number => {
  const now = new Date();
  const testDate = new Date(dateStr);
  const diffTime = now.getTime() - testDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const isDataStale = (lastTestTime: string, staleDays: number = 30): boolean => {
  return getDaysSinceDate(lastTestTime) > staleDays;
};

export const getRetestDueDate = (lastTestTime: string, cycle: RetestCycle, customDays?: number): string => {
  const testDate = new Date(lastTestTime);
  const cycleDays = getRetestCycleDays(cycle, customDays);
  testDate.setDate(testDate.getDate() + cycleDays);
  return testDate.toISOString();
};

export const isRetestOverdue = (lastTestTime: string, cycle: RetestCycle, customDays?: number): boolean => {
  const dueDate = new Date(getRetestDueDate(lastTestTime, cycle, customDays));
  const now = new Date();
  return now > dueDate;
};

export const getDaysOverdue = (lastTestTime: string, cycle: RetestCycle, customDays?: number): number => {
  const dueDate = new Date(getRetestDueDate(lastTestTime, cycle, customDays));
  const now = new Date();
  const diffTime = now.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};
