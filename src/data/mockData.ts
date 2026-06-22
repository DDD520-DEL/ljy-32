import type { Building, TestRecord } from '../types';
import { generateId, calculateScore } from '../utils/storage';
import { SENSITIVITY_CONFIG, COMMON_LIGHT_BRANDS } from '../types';

export const mockBuildings: Building[] = [
  {
    id: 'building_001',
    name: '1号楼',
    totalFloors: 18,
    address: '阳光小区',
    createTime: '2024-01-15T10:00:00.000Z',
    retestCycle: 'two_weeks'
  },
  {
    id: 'building_002',
    name: '2号楼',
    totalFloors: 24,
    address: '阳光小区',
    createTime: '2024-01-16T08:30:00.000Z',
    retestCycle: 'one_month'
  }
];

const mockTesters = [
  { id: 'tester_001', name: '邻居小明' },
  { id: 'tester_002', name: '邻居阿姨' },
  { id: 'tester_003', name: '邻居老王' }
];

const sensitivityLevels: Array<'whisper' | 'normal' | 'loud' | 'shout'> = ['whisper', 'normal', 'loud', 'shout'];

const mockLightModels: Record<string, string[]> = {
  '飞利浦 (Philips)': ['LED-SD-005W', '智能感应灯 E27', '楼道感应灯 SL-200'],
  '欧普照明 (OPPLE)': ['声光控灯泡 5W', 'MX-SD001 感应灯', '走廊吸顶灯'],
  '雷士照明 (NVC)': ['ESD-05 声控灯', '楼道感应灯 7W', 'LED 感应球泡'],
  '三雄极光 (Pak)': ['PAK-SD01 感应灯', '声控吸顶灯', '节能感应灯泡'],
  '佛山照明 (FSL)': ['FSL-SD 5W', '声光控感应灯', '楼道 LED 灯'],
  '阳光照明 (Yankon)': ['YANKON-SD03', '人体感应灯', '智能声控灯']
};

export const generateMockRecords = (buildings: Building[]): TestRecord[] => {
  const records: TestRecord[] = [];
  const useBrandList = COMMON_LIGHT_BRANDS.filter(b => b !== '其他品牌').slice(0, 6);

  buildings.forEach(building => {
    for (let floor = 1; floor <= Math.min(building.totalFloors, 10); floor++) {
      const testerCount = Math.random() > 0.5 ? 2 : 1;
      const selectedTesters = mockTesters.slice(0, testerCount);

      const floorHasBrand = Math.random() > 0.25;
      let floorBrand = '';
      let floorModel = '';
      if (floorHasBrand) {
        floorBrand = useBrandList[Math.floor(Math.random() * useBrandList.length)];
        const brandModels = mockLightModels[floorBrand] || ['LED 声控灯'];
        floorModel = brandModels[Math.floor(Math.random() * brandModels.length)];
      }

      selectedTesters.forEach(tester => {
        const testCount = Math.floor(Math.random() * 2) + 1;

        for (let i = 0; i < testCount; i++) {
          const levelIndex = Math.floor(Math.random() * sensitivityLevels.length);
          const sensitivityLevel = sensitivityLevels[levelIndex];
          const sensitivityScore = SENSITIVITY_CONFIG[sensitivityLevel].score;
          const duration = Math.floor(Math.random() * 90) + 10;
          const hasBlindSpot = Math.random() > 0.6;

          const { totalScore, grade } = calculateScore(sensitivityScore, duration, hasBlindSpot);

          const date = new Date();
          const daysAgo = Math.random() > 0.3 
            ? Math.floor(Math.random() * 7) 
            : Math.floor(Math.random() * 30) + 35;
          date.setDate(date.getDate() - daysAgo);
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
            grade,
            testerId: tester.id,
            testerName: tester.name,
            lightBrand: floorHasBrand ? floorBrand : undefined,
            lightModel: floorHasBrand ? floorModel : undefined
          });
        }
      });
    }
  });

  return records;
};
