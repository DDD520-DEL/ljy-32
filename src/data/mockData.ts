import type { Building, TestRecord } from '../types';
import { generateId, calculateScore } from '../utils/storage';
import { SENSITIVITY_CONFIG } from '../types';

export const mockBuildings: Building[] = [
  {
    id: 'building_001',
    name: '1号楼',
    totalFloors: 18,
    address: '阳光小区',
    createTime: '2024-01-15T10:00:00.000Z'
  },
  {
    id: 'building_002',
    name: '2号楼',
    totalFloors: 24,
    address: '阳光小区',
    createTime: '2024-01-16T08:30:00.000Z'
  }
];

const sensitivityLevels: Array<'whisper' | 'normal' | 'loud' | 'shout'> = ['whisper', 'normal', 'loud', 'shout'];

export const generateMockRecords = (buildings: Building[]): TestRecord[] => {
  const records: TestRecord[] = [];

  buildings.forEach(building => {
    for (let floor = 1; floor <= Math.min(building.totalFloors, 10); floor++) {
      const testCount = Math.floor(Math.random() * 3) + 1;

      for (let i = 0; i < testCount; i++) {
        const levelIndex = Math.floor(Math.random() * sensitivityLevels.length);
        const sensitivityLevel = sensitivityLevels[levelIndex];
        const sensitivityScore = SENSITIVITY_CONFIG[sensitivityLevel].score;
        const duration = Math.floor(Math.random() * 90) + 10;
        const hasBlindSpot = Math.random() > 0.6;

        const { totalScore, grade } = calculateScore(sensitivityScore, duration, hasBlindSpot);

        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 7));
        date.setHours(Math.floor(Math.random() * 12) + 18);

        records.push({
          id: generateId(),
          buildingId: building.id,
          buildingName: building.name,
          floor,
          sensitivityLevel,
          sensitivityScore,
          duration,
          hasBlindSpot,
          blindSpotDescription: hasBlindSpot ? ['楼梯转角', '电梯口', '走廊尽头'][Math.floor(Math.random() * 3)] : undefined,
          testTime: date.toISOString(),
          totalScore,
          grade
        });
      }
    }
  });

  return records;
};
