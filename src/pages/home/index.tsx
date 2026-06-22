import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button, ScrollView, Input, Slider } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import RankCard from '../../components/RankCard';
import type { RetestReminder, RetestCycle, ScoreWeights } from '../../types';
import { RETEST_CYCLE_CONFIG, DEFAULT_SCORE_WEIGHTS } from '../../types';
import { formatDate } from '../../utils/storage';
import { setPendingRetest, markReminderHandled, getAllHandledReminderIds } from '../../utils/retestNavigate';

const HomePage: React.FC = () => {
  const {
    buildings,
    currentBuildingId,
    getCurrentBuilding,
    getRecordsByCurrentBuilding,
    getRankList,
    setCurrentBuildingId,
    addBuilding,
    updateBuilding,
    updateBuildingRetestCycle,
    getRetestReminders,
    scoreWeights,
    updateScoreWeights,
    calculateRecordScore,
    exportToJSON,
    exportToText,
    exportToCSV,
    importData,
    getBackupStats
  } = useData();

  const currentBuilding = getCurrentBuilding();
  const records = getRecordsByCurrentBuilding();
  const rankList = getRankList().slice(0, 3);
  const retestReminders = getRetestReminders();

  const [, forceUpdate] = useState(0);
  const [showRetestModal, setShowRetestModal] = useState(false);
  const [showCycleSettingModal, setShowCycleSettingModal] = useState(false);
  const [showWeightSettingModal, setShowWeightSettingModal] = useState(false);
  const [showDataManageModal, setShowDataManageModal] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<RetestCycle>('two_weeks');
  const [customDays, setCustomDays] = useState('');
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());
  const [tempSensitivityWeight, setTempSensitivityWeight] = useState(scoreWeights.sensitivityWeight);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const activeReminders = useMemo(() => {
    const handledIds = getAllHandledReminderIds();
    return retestReminders.filter(
      r => !handledIds.has(r.id) && !dismissedReminders.has(r.id)
    );
  }, [retestReminders, dismissedReminders]);

  useDidShow(() => {
    console.log('[HomePage] did show');
    forceUpdate(prev => prev + 1);
    if (activeReminders.length > 0) {
      setShowRetestModal(true);
    }
  });

  const stats = useMemo(() => {
    let poorCount = 0;
    let excellentCount = 0;
    records.forEach(r => {
      const { grade } = calculateRecordScore(r);
      if (grade === 'poor') poorCount++;
      if (grade === 'excellent') excellentCount++;
    });
    return {
      totalTests: records.length,
      poorCount,
      excellentCount
    };
  }, [records, calculateRecordScore]);

  const handleStartTest = useCallback(() => {
    if (!currentBuildingId) {
      Taro.showToast({ title: '请先添加楼栋', icon: 'none' });
      return;
    }
    Taro.switchTab({ url: '/pages/record/index' });
  }, [currentBuildingId]);

  const handleManageBuilding = useCallback(() => {
    Taro.showActionSheet({
      itemList: ['添加楼栋', '切换楼栋', '编辑楼栋信息', '设置复测周期', '设置评分权重'],
      success: (res) => {
        if (res.tapIndex === 0) {
          showAddBuildingModal();
        } else if (res.tapIndex === 1) {
          showBuildingSelector();
        } else if (res.tapIndex === 2) {
          if (!currentBuildingId) {
            Taro.showToast({ title: '请先选择楼栋', icon: 'none' });
            return;
          }
          showEditBuildingModal();
        } else if (res.tapIndex === 3) {
          if (!currentBuildingId) {
            Taro.showToast({ title: '请先选择楼栋', icon: 'none' });
            return;
          }
          openCycleSettingModal();
        } else if (res.tapIndex === 4) {
          openWeightSettingModal();
        }
      }
    });
  }, [currentBuildingId]);

  const showAddBuildingModal = () => {
    Taro.showModal({
      title: '添加楼栋',
      editable: true,
      placeholderText: '请输入楼栋名称（如：1号楼）',
      success: (nameRes) => {
        if (nameRes.confirm && nameRes.content) {
          const name = nameRes.content.trim();
          Taro.showModal({
            title: '输入地址',
            editable: true,
            placeholderText: '请输入小区/地址',
            success: (addrRes) => {
              if (addrRes.confirm && addrRes.content) {
                Taro.showModal({
                  title: '输入楼层数',
                  editable: true,
                  placeholderText: '请输入总楼层数',
                  success: (floorRes) => {
                    if (floorRes.confirm && floorRes.content) {
                      const totalFloors = parseInt(floorRes.content, 10);
                      if (totalFloors > 0 && totalFloors <= 100) {
                        addBuilding({
                          name,
                          address: addrRes.content.trim(),
                          totalFloors
                        });
                        Taro.showToast({ title: '添加成功', icon: 'success' });
                        forceUpdate(prev => prev + 1);
                      } else {
                        Taro.showToast({ title: '请输入有效的楼层数', icon: 'none' });
                      }
                    }
                  }
                });
              }
            }
          });
        }
      }
    });
  };

  const showBuildingSelector = () => {
    if (buildings.length === 0) {
      Taro.showToast({ title: '暂无楼栋，请先添加', icon: 'none' });
      return;
    }
    Taro.showActionSheet({
      itemList: buildings.map(b => `${b.name} - ${b.address}`),
      success: (res) => {
        setCurrentBuildingId(buildings[res.tapIndex].id);
        forceUpdate(prev => prev + 1);
      }
    });
  };

  const showEditBuildingModal = () => {
    const building = getCurrentBuilding();
    if (!building) return;

    Taro.showModal({
      title: '编辑楼栋名称',
      editable: true,
      content: building.name,
      success: (nameRes) => {
        if (nameRes.confirm && nameRes.content) {
          const name = nameRes.content.trim();
          Taro.showModal({
            title: '编辑地址',
            editable: true,
            content: building.address,
            success: (addrRes) => {
              if (addrRes.confirm && addrRes.content) {
                Taro.showModal({
                  title: '编辑楼层数',
                  editable: true,
                  content: String(building.totalFloors),
                  success: (floorRes) => {
                    if (floorRes.confirm && floorRes.content) {
                      const totalFloors = parseInt(floorRes.content, 10);
                      if (totalFloors > 0 && totalFloors <= 100) {
                        updateBuilding({
                          ...building,
                          name,
                          address: addrRes.content.trim(),
                          totalFloors
                        });
                        Taro.showToast({ title: '更新成功', icon: 'success' });
                        forceUpdate(prev => prev + 1);
                      } else {
                        Taro.showToast({ title: '请输入有效的楼层数', icon: 'none' });
                      }
                    }
                  }
                });
              }
            }
          });
        }
      }
    });
  };

  const openCycleSettingModal = () => {
    const building = getCurrentBuilding();
    if (!building) return;
    setSelectedCycle(building.retestCycle);
    setCustomDays(building.customRetestDays ? String(building.customRetestDays) : '');
    setShowCycleSettingModal(true);
  };

  const handleCycleSelect = (cycle: RetestCycle) => {
    setSelectedCycle(cycle);
    if (cycle !== 'custom') {
      setCustomDays('');
    }
  };

  const handleSaveCycle = () => {
    if (!currentBuildingId) return;
    
    if (selectedCycle === 'custom') {
      const days = parseInt(customDays, 10);
      if (isNaN(days) || days < 1 || days > 365) {
        Taro.showToast({ title: '请输入有效的天数（1-365）', icon: 'none' });
        return;
      }
      updateBuildingRetestCycle(currentBuildingId, selectedCycle, days);
    } else {
      updateBuildingRetestCycle(currentBuildingId, selectedCycle);
    }
    Taro.showToast({ title: '设置成功', icon: 'success' });
    setShowCycleSettingModal(false);
    forceUpdate(prev => prev + 1);
  };

  const openWeightSettingModal = () => {
    setTempSensitivityWeight(scoreWeights.sensitivityWeight);
    setShowWeightSettingModal(true);
  };

  const handleSensitivityWeightChange = (value: number) => {
    setTempSensitivityWeight(value);
  };

  const handleResetWeights = () => {
    setTempSensitivityWeight(DEFAULT_SCORE_WEIGHTS.sensitivityWeight);
  };

  const handleSaveWeights = () => {
    const newWeights: ScoreWeights = {
      sensitivityWeight: tempSensitivityWeight,
      durationWeight: 100 - tempSensitivityWeight
    };
    updateScoreWeights(newWeights);
    Taro.showToast({ title: '权重已更新', icon: 'success' });
    setShowWeightSettingModal(false);
    forceUpdate(prev => prev + 1);
  };

  const handleReminderClick = (reminder: RetestReminder) => {
    setShowRetestModal(false);
    markReminderHandled(reminder.id);
    setCurrentBuildingId(reminder.buildingId);
    setPendingRetest({ buildingId: reminder.buildingId, floor: reminder.floor });
    Taro.switchTab({ url: '/pages/record/index' });
  };

  const handleDismissReminder = (reminderId: string) => {
    const newDismissed = new Set(dismissedReminders);
    newDismissed.add(reminderId);
    setDismissedReminders(newDismissed);
    const remaining = activeReminders.filter(r => !newDismissed.has(r.id));
    if (remaining.length === 0) {
      setShowRetestModal(false);
    }
  };

  const handleCloseAllReminders = () => {
    const allIds = new Set(activeReminders.map(r => r.id));
    setDismissedReminders(allIds);
    setShowRetestModal(false);
  };

  const handleViewAllRank = () => {
    Taro.switchTab({ url: '/pages/rank/index' });
  };

  const handleViewDetail = (floor: number) => {
    Taro.navigateTo({
      url: `/pages/detail/index?floor=${floor}&buildingId=${currentBuildingId}`
    });
  };

  const handleExportJSON = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const success = await exportToJSON();
      if (success) {
        Taro.showToast({ title: '导出成功', icon: 'success' });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportText = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const success = await exportToText();
      if (success) {
        Taro.showToast({ title: '导出成功', icon: 'success' });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const success = await exportToCSV();
      if (success) {
        Taro.showToast({ title: '导出成功', icon: 'success' });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (isImporting) return;

    Taro.showModal({
      title: '确认恢复数据',
      content: '恢复数据将覆盖当前所有数据，确定要继续吗？',
      confirmText: '确定恢复',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          setIsImporting(true);
          try {
            const result = await importData();
            if (result.success) {
              setShowDataManageModal(false);
              forceUpdate(prev => prev + 1);
              if (result.buildingInvalid) {
                Taro.showModal({
                  title: '楼栋需重新选择',
                  content: '数据已恢复成功，但之前选中的楼栋不在备份数据中。请选择一个楼栋继续使用。',
                  showCancel: false,
                  confirmText: '去选择',
                  success: () => {
                    handleManageBuilding();
                  }
                });
              } else {
                Taro.showToast({ title: result.message, icon: 'success' });
              }
            } else {
              Taro.showToast({ title: result.message, icon: 'none' });
            }
          } finally {
            setIsImporting(false);
          }
        }
      }
    });
  };

  const backupStats = getBackupStats();

  return (
    <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <Text className={styles.title}>楼道声控灯评测</Text>
        <Text className={styles.subtitle}>记录灵敏度，推动更换老旧声控灯</Text>
      </View>

      <View className={styles.currentBuilding} onClick={handleManageBuilding}>
        <Text className={styles.label}>当前楼栋（点击切换）</Text>
        {currentBuilding ? (
          <>
            <Text className={styles.buildingName}>{currentBuilding.name}</Text>
            <Text className={styles.buildingInfo}>
              {currentBuilding.address} · 共{currentBuilding.totalFloors}层
            </Text>
            <Text className={styles.cycleInfo}>
              复测周期：{RETEST_CYCLE_CONFIG[currentBuilding.retestCycle].label}
              {currentBuilding.retestCycle === 'custom' && currentBuilding.customRetestDays && `（${currentBuilding.customRetestDays}天）`}
            </Text>
          </>
        ) : (
          <>
            <Text className={styles.buildingName}>请添加楼栋</Text>
            <Text className={styles.buildingInfo}>点击添加您所住的楼栋信息</Text>
          </>
        )}
      </View>

      <View className={styles.statsRow}>
        <View className={styles.statCard}>
          <Text className={styles.statValue}>{stats.totalTests}</Text>
          <Text className={styles.statLabel}>总测试</Text>
        </View>
        <View className={styles.statCard + ' ' + styles.excellent}>
          <Text className={styles.statValue}>{stats.excellentCount}</Text>
          <Text className={styles.statLabel}>优秀</Text>
        </View>
        <View className={styles.statCard + ' ' + styles.poor}>
          <Text className={styles.statValue}>{stats.poorCount}</Text>
          <Text className={styles.statLabel}>待更换</Text>
        </View>
      </View>

      <View className={styles.actionSection}>
        <Text className={styles.sectionTitle}>快捷操作</Text>
        <View className={styles.actionButtons}>
          <Button className={styles.actionBtn} onClick={handleStartTest}>
            开始测试记录
          </Button>
          <View className={styles.actionRow}>
            <Button className={styles.actionBtn + ' ' + styles.rowBtn + ' ' + styles.reportBtn} onClick={() => Taro.navigateTo({ url: '/pages/report/index?type=weekly' })}>
              📊 生成周报
            </Button>
            <Button className={styles.actionBtn + ' ' + styles.rowBtn + ' ' + styles.reportBtn2} onClick={() => Taro.navigateTo({ url: '/pages/report/index?type=monthly' })}>
              📈 生成月报
            </Button>
          </View>
          <Button className={styles.actionBtn + ' ' + styles.compareBtn} onClick={() => Taro.navigateTo({ url: '/pages/compare/index' })}>
            🏢 楼栋对比
          </Button>
          <Button className={styles.actionBtn + ' ' + styles.secondary} onClick={handleManageBuilding}>
            管理楼栋信息
          </Button>
          <View className={styles.actionRow}>
            <Button className={styles.actionBtn + ' ' + styles.rowBtn + ' ' + styles.weightBtn} onClick={openWeightSettingModal}>
              ⚖️ 评分权重设置
            </Button>
            <Button className={styles.actionBtn + ' ' + styles.rowBtn + ' ' + styles.collabBtn} onClick={() => Taro.switchTab({ url: '/pages/collaborate/index' })}>
              邀请邻居协作
            </Button>
          </View>
          <Button className={styles.actionBtn + ' ' + styles.dataManageBtn} onClick={() => setShowDataManageModal(true)}>
            💾 数据管理（导出/备份恢复）
          </Button>
        </View>
      </View>

      <View className={styles.rankPreview}>
        <View className={styles.rankHeader}>
          <Text className={styles.sectionTitle}>楼层排行榜 TOP3</Text>
          <Text className={styles.viewAll} onClick={handleViewAllRank}>查看全部</Text>
        </View>
        {rankList.length > 0 ? (
          rankList.map(item => (
            <View key={`${item.buildingName}-${item.floor}`} onClick={() => handleViewDetail(item.floor)}>
              <RankCard item={item} />
            </View>
          ))
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyText}>暂无测试数据，快去测试吧！</Text>
          </View>
        )}
      </View>

      {showRetestModal && (
        <View className={styles.modalOverlay}>
          <View className={styles.retestModal}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>🔔 复测提醒</Text>
              <Text className={styles.closeBtn} onClick={handleCloseAllReminders}>×</Text>
            </View>
            <ScrollView className={styles.reminderList} scrollY>
              {activeReminders.map(reminder => (
                <View key={reminder.id} className={styles.reminderItem}>
                  <View className={styles.reminderContent} onClick={() => handleReminderClick(reminder)}>
                    <View className={styles.reminderHeader}>
                      <Text className={styles.reminderBuilding}>{reminder.buildingName} {reminder.floor}楼</Text>
                      {reminder.daysOverdue > 0 && (
                        <View className={styles.overdueBadge}>
                          <Text className={styles.overdueText}>逾期{reminder.daysOverdue}天</Text>
                        </View>
                      )}
                    </View>
                    <Text className={styles.reminderInfo}>上次测试：{formatDate(reminder.lastTestTime)}</Text>
                    <Text className={styles.reminderAction}>点击前往测试 →</Text>
                  </View>
                  <Text className={styles.dismissBtn} onClick={() => handleDismissReminder(reminder.id)}>忽略</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {showCycleSettingModal && (
        <View className={styles.modalOverlay} onClick={() => setShowCycleSettingModal(false)}>
          <View className={styles.cycleModal} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>设置复测周期</Text>
              <Text className={styles.closeBtn} onClick={() => setShowCycleSettingModal(false)}>×</Text>
            </View>
            <View className={styles.cycleOptions}>
              {(Object.keys(RETEST_CYCLE_CONFIG) as RetestCycle[]).map(cycle => (
                <View
                  key={cycle}
                  className={`${styles.cycleOption} ${selectedCycle === cycle ? styles.active : ''}`}
                  onClick={() => handleCycleSelect(cycle)}
                >
                  <Text className={styles.cycleLabel}>{RETEST_CYCLE_CONFIG[cycle].label}</Text>
                  {cycle !== 'custom' && (
                    <Text className={styles.cycleDesc}>{RETEST_CYCLE_CONFIG[cycle].days}天</Text>
                  )}
                </View>
              ))}
            </View>
            {selectedCycle === 'custom' && (
              <View className={styles.customInput}>
                <Text className={styles.customLabel}>自定义天数：</Text>
                <Input
                  className={styles.customInputField}
                  type="number"
                  placeholder="请输入天数"
                  value={customDays}
                  onInput={e => setCustomDays(e.detail.value)}
                />
                <Text className={styles.customUnit}>天</Text>
              </View>
            )}
            <View className={styles.modalFooter}>
              <Button className={styles.cancelBtn} onClick={() => setShowCycleSettingModal(false)}>
                取消
              </Button>
              <Button className={styles.confirmBtn} onClick={handleSaveCycle}>
                确定
              </Button>
            </View>
          </View>
        </View>
      )}

      {showWeightSettingModal && (
        <View className={styles.modalOverlay} onClick={() => setShowWeightSettingModal(false)}>
          <View className={styles.weightModal} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>⚖️ 评分权重设置</Text>
              <Text className={styles.closeBtn} onClick={() => setShowWeightSettingModal(false)}>×</Text>
            </View>

            <View className={styles.weightHint}>
              <Text className={styles.weightHintText}>
                调整灵敏度和亮灯时长在综合评分中的占比，两者之和为100%。
                当前设置将影响排行榜、详情页和投诉文案中的所有评分。
              </Text>
            </View>

            <View className={styles.weightSection}>
              <View className={styles.weightRow}>
                <Text className={styles.weightLabel}>灵敏度权重</Text>
                <Text className={styles.weightValue + ' ' + styles.sensitivityValue}>{tempSensitivityWeight}%</Text>
              </View>
              <Slider
                className={styles.weightSlider}
                min={0}
                max={100}
                step={5}
                value={tempSensitivityWeight}
                activeColor="#FF6B35"
                backgroundColor="#E2E8F0"
                blockColor="#FF6B35"
                blockSize={28}
                onChanging={(e) => handleSensitivityWeightChange(e.detail.value)}
              />
              <View className={styles.weightScale}>
                <Text className={styles.scaleText}>0%</Text>
                <Text className={styles.scaleText}>50%</Text>
                <Text className={styles.scaleText}>100%</Text>
              </View>
            </View>

            <View className={styles.weightSection}>
              <View className={styles.weightRow}>
                <Text className={styles.weightLabel}>亮灯时长权重</Text>
                <Text className={styles.weightValue + ' ' + styles.durationValue}>{100 - tempSensitivityWeight}%</Text>
              </View>
              <Slider
                className={styles.weightSlider}
                min={0}
                max={100}
                step={5}
                value={100 - tempSensitivityWeight}
                activeColor="#0EA5E9"
                backgroundColor="#E2E8F0"
                blockColor="#0EA5E9"
                blockSize={28}
                onChanging={(e) => handleSensitivityWeightChange(100 - e.detail.value)}
              />
              <View className={styles.weightScale}>
                <Text className={styles.scaleText}>0%</Text>
                <Text className={styles.scaleText}>50%</Text>
                <Text className={styles.scaleText}>100%</Text>
              </View>
            </View>

            <View className={styles.weightPresetRow}>
              <Button className={styles.presetBtn} onClick={handleResetWeights}>
                恢复默认 (50:50)
              </Button>
            </View>

            <View className={styles.weightSummary}>
              <View className={styles.summaryBar}>
                <View
                  className={styles.summarySensitivity}
                  style={{ width: `${tempSensitivityWeight}%` }}
                />
                <View
                  className={styles.summaryDuration}
                  style={{ width: `${100 - tempSensitivityWeight}%` }}
                />
              </View>
              <View className={styles.summaryLegend}>
                <View className={styles.legendItem}>
                  <View className={styles.legendDot + ' ' + styles.legendSensitivity} />
                  <Text className={styles.legendText}>灵敏度 {tempSensitivityWeight}%</Text>
                </View>
                <View className={styles.legendItem}>
                  <View className={styles.legendDot + ' ' + styles.legendDuration} />
                  <Text className={styles.legendText}>亮灯时长 {100 - tempSensitivityWeight}%</Text>
                </View>
              </View>
            </View>

            <View className={styles.modalFooter}>
              <Button className={styles.cancelBtn} onClick={() => setShowWeightSettingModal(false)}>
                取消
              </Button>
              <Button className={styles.confirmBtn} onClick={handleSaveWeights}>
                保存设置
              </Button>
            </View>
          </View>
        </View>
      )}

      {showDataManageModal && (
        <View className={styles.modalOverlay} onClick={() => setShowDataManageModal(false)}>
          <View className={styles.dataManageModal} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>💾 数据管理</Text>
              <Text className={styles.closeBtn} onClick={() => setShowDataManageModal(false)}>×</Text>
            </View>

            <View className={styles.dataStats}>
              <Text className={styles.dataStatsTitle}>当前数据概览</Text>
              <View className={styles.dataStatsGrid}>
                <View className={styles.dataStatItem}>
                  <Text className={styles.dataStatValue}>{backupStats.buildingCount}</Text>
                  <Text className={styles.dataStatLabel}>楼栋</Text>
                </View>
                <View className={styles.dataStatItem}>
                  <Text className={styles.dataStatValue}>{backupStats.recordCount}</Text>
                  <Text className={styles.dataStatLabel}>测试记录</Text>
                </View>
                <View className={styles.dataStatItem}>
                  <Text className={styles.dataStatValue}>{backupStats.repairCount}</Text>
                  <Text className={styles.dataStatLabel}>维修记录</Text>
                </View>
                <View className={styles.dataStatItem}>
                  <Text className={styles.dataStatValue}>{backupStats.complaintCount}</Text>
                  <Text className={styles.dataStatLabel}>投诉记录</Text>
                </View>
              </View>
            </View>

            <View className={styles.dataSection}>
              <Text className={styles.dataSectionTitle}>📤 导出数据</Text>
              <Text className={styles.dataSectionDesc}>
                导出全部数据保存到手机，换手机或误删数据时可快速恢复。
              </Text>
              <View className={styles.exportButtons}>
                <Button
                  className={styles.exportBtn + ' ' + styles.exportJsonBtn}
                  onClick={handleExportJSON}
                  disabled={isExporting}
                >
                  JSON 备份文件
                </Button>
                <Button
                  className={styles.exportBtn + ' ' + styles.exportTextBtn}
                  onClick={handleExportText}
                  disabled={isExporting}
                >
                  可读文本报告
                </Button>
                <Button
                  className={styles.exportBtn + ' ' + styles.exportCsvBtn}
                  onClick={handleExportCSV}
                  disabled={isExporting}
                >
                  CSV 表格数据
                </Button>
              </View>
              <View className={styles.exportTips}>
                <Text className={styles.tipText}>💡 JSON：用于数据备份恢复</Text>
                <Text className={styles.tipText}>💡 文本：直接可读，便于查看</Text>
                <Text className={styles.tipText}>💡 CSV：可用 Excel 打开分析</Text>
              </View>
            </View>

            <View className={styles.dataSection}>
              <Text className={styles.dataSectionTitle}>📥 恢复数据</Text>
              <Text className={styles.dataSectionDesc}>
                从备份文件恢复数据，将覆盖当前所有数据。
              </Text>
              <Button
                className={styles.importBtn}
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting ? '恢复中...' : '选择备份文件恢复'}
              </Button>
              <Text className={styles.importWarning}>
                ⚠️ 恢复数据会覆盖当前所有数据，请谨慎操作！
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default HomePage;
