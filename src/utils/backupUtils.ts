import Taro from '@tarojs/taro';
import type { Building, TestRecord, RepairRecord, ComplaintRecord, ScoreWeights, UserFeedbackRecord } from '../types';
import { SENSITIVITY_CONFIG, GRADE_CONFIG, REPAIR_STATUS_CONFIG, COMPLAINT_STATUS_CONFIG, RETEST_CYCLE_CONFIG, FEEDBACK_TYPE_CONFIG } from '../types';
import { formatDate } from './storage';

export interface BackupData {
  version: string;
  exportTime: string;
  buildings: Building[];
  records: TestRecord[];
  repairRecords: RepairRecord[];
  complaintRecords: ComplaintRecord[];
  feedbackRecords: UserFeedbackRecord[];
  scoreWeights: ScoreWeights;
}

const BACKUP_VERSION = '1.0';

const CSV_BOM = '\uFEFF';

function escapeCSVField(value: string): string {
  if (!value) return '';
  const needsQuoting = value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r');
  if (!needsQuoting) return value;
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export const backupUtils = {
  exportAllData(): BackupData {
    try {
      const buildings = Taro.getStorageSync('light_evaluator_buildings');
      const records = Taro.getStorageSync('light_evaluator_records');
      const repairRecords = Taro.getStorageSync('light_evaluator_repair_records');
      const complaintRecords = Taro.getStorageSync('light_evaluator_complaint_records');
      const feedbackRecords = Taro.getStorageSync('light_evaluator_feedback_records');
      const scoreWeights = Taro.getStorageSync('light_evaluator_score_weights');

      return {
        version: BACKUP_VERSION,
        exportTime: new Date().toISOString(),
        buildings: buildings ? JSON.parse(buildings) : [],
        records: records ? JSON.parse(records) : [],
        repairRecords: repairRecords ? JSON.parse(repairRecords) : [],
        complaintRecords: complaintRecords ? JSON.parse(complaintRecords) : [],
        feedbackRecords: feedbackRecords ? JSON.parse(feedbackRecords) : [],
        scoreWeights: scoreWeights ? JSON.parse(scoreWeights) : { sensitivityWeight: 50, durationWeight: 50 }
      };
    } catch (e) {
      console.error('[Backup] exportAllData error:', e);
      throw new Error('导出数据失败');
    }
  },

  importAllData(data: BackupData): { success: boolean; message: string } {
    try {
      if (!data || !data.version) {
        return { success: false, message: '无效的备份文件格式' };
      }

      if (data.buildings && Array.isArray(data.buildings)) {
        Taro.setStorageSync('light_evaluator_buildings', JSON.stringify(data.buildings));
      }
      if (data.records && Array.isArray(data.records)) {
        Taro.setStorageSync('light_evaluator_records', JSON.stringify(data.records));
      }
      if (data.repairRecords && Array.isArray(data.repairRecords)) {
        Taro.setStorageSync('light_evaluator_repair_records', JSON.stringify(data.repairRecords));
      }
      if (data.complaintRecords && Array.isArray(data.complaintRecords)) {
        Taro.setStorageSync('light_evaluator_complaint_records', JSON.stringify(data.complaintRecords));
      }
      if (data.feedbackRecords && Array.isArray(data.feedbackRecords)) {
        Taro.setStorageSync('light_evaluator_feedback_records', JSON.stringify(data.feedbackRecords));
      }
      if (data.scoreWeights) {
        Taro.setStorageSync('light_evaluator_score_weights', JSON.stringify(data.scoreWeights));
      }

      return { success: true, message: '数据恢复成功' };
    } catch (e) {
      console.error('[Backup] importAllData error:', e);
      return { success: false, message: '数据恢复失败：' + (e as Error).message };
    }
  },

  generateReadableText(data: BackupData): string {
    const { buildings, records, repairRecords, complaintRecords, feedbackRecords } = data;
    let text = '';

    text += '========================================\n';
    text += '  楼道声控灯评测 - 数据备份报告\n';
    text += '========================================\n\n';
    text += `导出时间：${formatDate(data.exportTime)}\n`;
    text += `数据版本：v${data.version}\n\n`;

    text += '【楼栋信息】\n';
    text += `共 ${buildings.length} 栋楼\n\n`;
    buildings.forEach((b, idx) => {
      text += `${idx + 1}. ${b.name}\n`;
      text += `   地址：${b.address}\n`;
      text += `   楼层数：${b.totalFloors}层\n`;
      text += `   复测周期：${RETEST_CYCLE_CONFIG[b.retestCycle]?.label || '未设置'}`;
      if (b.retestCycle === 'custom' && b.customRetestDays) {
        text += `（${b.customRetestDays}天）`;
      }
      text += '\n';
      text += `   创建时间：${formatDate(b.createTime)}\n\n`;
    });

    text += '【测试记录】\n';
    text += `共 ${records.length} 条记录\n\n`;
    const sortedRecords = [...records].sort((a, b) => new Date(b.testTime).getTime() - new Date(a.testTime).getTime());
    sortedRecords.forEach((r, idx) => {
      const sensConfig = SENSITIVITY_CONFIG[r.sensitivityLevel];
      const gradeConfig = GRADE_CONFIG[r.grade];
      text += `${idx + 1}. ${r.buildingName} - ${r.floor}楼\n`;
      text += `   测试时间：${formatDate(r.testTime)}\n`;
      text += `   灵敏度：${sensConfig?.label || r.sensitivityLevel}（${sensConfig?.score || 0}分）\n`;
      text += `   亮灯时长：${r.duration}秒\n`;
      text += `   综合评分：${r.totalScore}分（${gradeConfig?.label || r.grade}）\n`;
      text += `   是否有盲区：${r.hasBlindSpot ? '是' : '否'}\n`;
      if (r.hasBlindSpot && r.blindSpotDescription) {
        text += `   盲区描述：${r.blindSpotDescription}\n`;
      }
      if (r.lightBrand) {
        text += `   灯具品牌：${r.lightBrand}\n`;
      }
      if (r.lightModel) {
        text += `   灯具型号：${r.lightModel}\n`;
      }
      if (r.testerName) {
        text += `   测试人员：${r.testerName}\n`;
      }
      text += '\n';
    });

    text += '【维修记录】\n';
    text += `共 ${repairRecords.length} 条记录\n\n`;
    const sortedRepairs = [...repairRecords].sort((a, b) => new Date(b.statusUpdateTime).getTime() - new Date(a.statusUpdateTime).getTime());
    sortedRepairs.forEach((r, idx) => {
      const statusConfig = REPAIR_STATUS_CONFIG[r.status];
      text += `${idx + 1}. ${r.buildingName} - ${r.floor}楼\n`;
      text += `   状态：${statusConfig?.label || r.status}\n`;
      text += `   问题：${r.issues}\n`;
      text += `   是否投诉：${r.complaintMarked ? '是' : '否'}\n`;
      if (r.complaintTime) {
        text += `   投诉时间：${formatDate(r.complaintTime)}\n`;
      }
      text += `   更新时间：${formatDate(r.statusUpdateTime)}\n`;
      if (r.note) {
        text += `   备注：${r.note}\n`;
      }
      text += '\n';
    });

    text += '【投诉记录】\n';
    text += `共 ${complaintRecords.length} 条记录\n\n`;
    const sortedComplaints = [...complaintRecords].sort((a, b) => new Date(b.complaintTime).getTime() - new Date(a.complaintTime).getTime());
    sortedComplaints.forEach((c, idx) => {
      const statusConfig = COMPLAINT_STATUS_CONFIG[c.status];
      text += `${idx + 1}. ${c.buildingName}\n`;
      text += `   投诉时间：${formatDate(c.complaintTime)}\n`;
      text += `   状态：${statusConfig?.label || c.status}\n`;
      text += `   问题楼层：${c.poorFloors.join('、')}楼\n`;
      text += `   照片数量：${c.photoCount}张\n`;
      if (c.feedback) {
        text += `   物业回复：${c.feedback.replyContent}\n`;
        text += `   回复时间：${formatDate(c.feedback.replyTime)}\n`;
        text += `   服务评分：态度${c.feedback.attitudeScore}分 / 速度${c.feedback.speedScore}分 / 综合${c.feedback.overallScore}分\n`;
      }
      text += '\n';
    });

    text += '【意见反馈】\n';
    text += `共 ${feedbackRecords.length} 条记录\n\n`;
    const sortedFeedbacks = [...feedbackRecords].sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    sortedFeedbacks.forEach((f, idx) => {
      const typeConfig = FEEDBACK_TYPE_CONFIG[f.type];
      text += `${idx + 1}. ${typeConfig?.label || f.type}\n`;
      text += `   提交时间：${formatDate(f.createTime)}\n`;
      text += `   反馈内容：${f.content}\n`;
      if (f.contact) {
        text += `   联系方式：${f.contact}\n`;
      }
      if (f.buildingName) {
        text += `   关联楼栋：${f.buildingName}${f.buildingAddress ? ' (' + f.buildingAddress + ')' : ''}\n`;
      }
      text += `   手机型号：${f.phoneModel}\n`;
      text += `   系统信息：${f.osInfo}\n`;
      text += `   应用版本：${f.appVersion}\n`;
      text += '\n';
    });

    text += '========================================\n';
    text += '  报告结束\n';
    text += '========================================\n';

    return text;
  },

  generateCSV(data: BackupData): { buildings: string; records: string; repairRecords: string; complaintRecords: string; feedbackRecords: string } {
    const { buildings, records, repairRecords, complaintRecords, feedbackRecords } = data;

    const buildingsCSV = [
      ['楼栋ID', '楼栋名称', '地址', '总楼层', '创建时间', '复测周期', '自定义天数'].map(escapeCSVField).join(','),
      ...buildings.map(b => [
        b.id,
        b.name,
        b.address,
        String(b.totalFloors),
        b.createTime,
        b.retestCycle,
        b.customRetestDays ? String(b.customRetestDays) : ''
      ].map(escapeCSVField).join(','))
    ].join('\r\n');

    const recordsCSV = [
      ['记录ID', '楼栋ID', '楼栋名称', '楼层', '灵敏度等级', '灵敏度分数', '亮灯时长(秒)', '是否有盲区', '盲区描述', '综合评分', '评级', '测试时间', '测试人ID', '测试人姓名', '灯具品牌', '灯具型号', '照片数量'].map(escapeCSVField).join(','),
      ...records.map(r => [
        r.id,
        r.buildingId,
        r.buildingName,
        String(r.floor),
        r.sensitivityLevel,
        String(r.sensitivityScore),
        String(r.duration),
        r.hasBlindSpot ? '是' : '否',
        r.blindSpotDescription || '',
        String(r.totalScore),
        r.grade,
        r.testTime,
        r.testerId || '',
        r.testerName || '',
        r.lightBrand || '',
        r.lightModel || '',
        String(r.photos?.length || 0)
      ].map(escapeCSVField).join(','))
    ].join('\r\n');

    const repairRecordsCSV = [
      ['记录ID', '楼栋ID', '楼栋名称', '楼层', '状态', '是否已投诉', '投诉时间', '状态更新时间', '问题描述', '备注'].map(escapeCSVField).join(','),
      ...repairRecords.map(r => [
        r.id,
        r.buildingId,
        r.buildingName,
        String(r.floor),
        r.status,
        r.complaintMarked ? '是' : '否',
        r.complaintTime || '',
        r.statusUpdateTime,
        r.issues,
        r.note || ''
      ].map(escapeCSVField).join(','))
    ].join('\r\n');

    const complaintRecordsCSV = [
      ['记录ID', '楼栋ID', '楼栋名称', '投诉内容', '投诉时间', '问题楼层', '照片数量', '状态', '物业回复', '回复时间', '态度评分', '速度评分', '综合评分', '反馈备注'].map(escapeCSVField).join(','),
      ...complaintRecords.map(c => [
        c.id,
        c.buildingId,
        c.buildingName,
        c.complaintText,
        c.complaintTime,
        c.poorFloors.join('、'),
        String(c.photoCount),
        c.status,
        c.feedback?.replyContent || '',
        c.feedback?.replyTime || '',
        c.feedback?.attitudeScore ? String(c.feedback.attitudeScore) : '',
        c.feedback?.speedScore ? String(c.feedback.speedScore) : '',
        c.feedback?.overallScore ? String(c.feedback.overallScore) : '',
        c.feedback?.note || ''
      ].map(escapeCSVField).join(','))
    ].join('\r\n');

    const feedbackRecordsCSV = [
      ['记录ID', '反馈类型', '反馈内容', '联系方式', '楼栋ID', '楼栋名称', '楼栋地址', '手机型号', '系统信息', '应用版本', '提交时间'].map(escapeCSVField).join(','),
      ...feedbackRecords.map(f => [
        f.id,
        f.type,
        f.content,
        f.contact || '',
        f.buildingId || '',
        f.buildingName || '',
        f.buildingAddress || '',
        f.phoneModel,
        f.osInfo,
        f.appVersion,
        f.createTime
      ].map(escapeCSVField).join(','))
    ].join('\r\n');

    return {
      buildings: buildingsCSV,
      records: recordsCSV,
      repairRecords: repairRecordsCSV,
      complaintRecords: complaintRecordsCSV,
      feedbackRecords: feedbackRecordsCSV
    };
  },

  generateFullCSV(data: BackupData): string {
    const csv = this.generateCSV(data);
    let full = '';
    full += csv.buildings + '\r\n\r\n';
    full += csv.records + '\r\n\r\n';
    full += csv.repairRecords + '\r\n\r\n';
    full += csv.complaintRecords + '\r\n\r\n';
    full += csv.feedbackRecords + '\r\n';
    return full;
  },

  getBackupStats(data: BackupData): {
    buildingCount: number;
    recordCount: number;
    repairCount: number;
    complaintCount: number;
    feedbackCount: number;
    exportTime: string;
  } {
    return {
      buildingCount: data.buildings.length,
      recordCount: data.records.length,
      repairCount: data.repairRecords.length,
      complaintCount: data.complaintRecords.length,
      feedbackCount: data.feedbackRecords?.length || 0,
      exportTime: formatDate(data.exportTime)
    };
  },

  validateBackupData(data: any): data is BackupData {
    if (!data || typeof data !== 'object') return false;
    if (!data.version || typeof data.version !== 'string') return false;
    if (!Array.isArray(data.buildings)) return false;
    if (!Array.isArray(data.records)) return false;
    if (!Array.isArray(data.repairRecords)) return false;
    if (!Array.isArray(data.complaintRecords)) return false;
    return true;
  }
};

export const saveFileToDevice = async (content: string, fileName: string, fileType: string = 'text', silent: boolean = false): Promise<boolean> => {
  try {
    const fs = Taro.getFileSystemManager();
    const userDataPath = Taro.env.USER_DATA_PATH;
    if (!userDataPath) {
      if (!silent) Taro.showToast({ title: '无法获取存储路径', icon: 'none' });
      return false;
    }

    const filePath = `${userDataPath}/${fileName}`;

    fs.writeFileSync(filePath, content, 'utf8');

    if (!silent) {
      Taro.showModal({
        title: '文件已保存',
        content: `文件已保存到：\n${filePath}\n\n您可以在"文件管理"中找到该文件。`,
        showCancel: false,
        confirmText: '知道了'
      });
    }

    return true;
  } catch (e) {
    console.error('[Backup] saveFileToDevice error:', e);
    if (!silent) Taro.showToast({ title: '保存文件失败', icon: 'none' });
    return false;
  }
};

export const saveCSVFilesToDevice = async (data: BackupData): Promise<boolean> => {
  try {
    const fs = Taro.getFileSystemManager();
    const userDataPath = Taro.env.USER_DATA_PATH;
    if (!userDataPath) {
      Taro.showToast({ title: '无法获取存储路径', icon: 'none' });
      return false;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const csvData = backupUtils.generateCSV(data);

    const files = [
      { name: `声控灯_楼栋信息_${dateStr}.csv`, content: CSV_BOM + csvData.buildings },
      { name: `声控灯_测试记录_${dateStr}.csv`, content: CSV_BOM + csvData.records },
      { name: `声控灯_维修记录_${dateStr}.csv`, content: CSV_BOM + csvData.repairRecords },
      { name: `声控灯_投诉记录_${dateStr}.csv`, content: CSV_BOM + csvData.complaintRecords },
      { name: `声控灯_意见反馈_${dateStr}.csv`, content: CSV_BOM + csvData.feedbackRecords }
    ];

    for (const file of files) {
      const filePath = `${userDataPath}/${file.name}`;
      fs.writeFileSync(filePath, file.content, 'utf8');
    }

    Taro.showModal({
      title: 'CSV 文件已保存',
      content: `已导出 ${files.length} 个 CSV 表格文件：\n\n${files.map((f, i) => `${i + 1}. ${f.name}`).join('\n')}\n\n保存位置：${userDataPath}\n\n可用 Excel 分别打开查看。`,
      showCancel: false,
      confirmText: '知道了'
    });

    return true;
  } catch (e) {
    console.error('[Backup] saveCSVFilesToDevice error:', e);
    Taro.showToast({ title: '保存文件失败', icon: 'none' });
    return false;
  }
};

export const readFileFromDevice = async (): Promise<string | null> => {
  try {
    return new Promise((resolve) => {
      Taro.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['json', 'txt', 'csv'],
        success: (res) => {
          if (res.tempFiles && res.tempFiles.length > 0) {
            const tempFilePath = res.tempFiles[0].path;
            const fs = Taro.getFileSystemManager();
            fs.readFile({
              filePath: tempFilePath,
              encoding: 'utf8',
              success: (fileRes) => {
                resolve(fileRes.data as string);
              },
              fail: (err) => {
                console.error('[Backup] readFile error:', err);
                Taro.showToast({ title: '读取文件失败', icon: 'none' });
                resolve(null);
              }
            });
          } else {
            resolve(null);
          }
        },
        fail: (err) => {
          console.error('[Backup] chooseMessageFile error:', err);
          resolve(null);
        }
      });
    });
  } catch (e) {
    console.error('[Backup] readFileFromDevice error:', e);
    return null;
  }
};
