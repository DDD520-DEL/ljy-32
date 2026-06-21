import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Button, ScrollView, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import RankCard from '../../components/RankCard';
import type { RetestReminder, RetestCycle } from '../../types';
import { RETEST_CYCLE_CONFIG } from '../../types';
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
    getRetestReminders
  } = useData();

  const currentBuilding = getCurrentBuilding();
  const records = getRecordsByCurrentBuilding();
  const rankList = getRankList().slice(0, 3);
  const retestReminders = getRetestReminders();

  const [, forceUpdate] = useState(0);
  const [showRetestModal, setShowRetestModal] = useState(false);
  const [showCycleSettingModal, setShowCycleSettingModal] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<RetestCycle>('two_weeks');
  const [customDays, setCustomDays] = useState('');
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());

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

  const stats = {
    totalTests: records.length,
    poorCount: records.filter(r => r.grade === 'poor').length,
    excellentCount: records.filter(r => r.grade === 'excellent').length
  };

  const handleStartTest = useCallback(() => {
    if (!currentBuildingId) {
      Taro.showToast({ title: '请先添加楼栋', icon: 'none' });
      return;
    }
    Taro.switchTab({ url: '/pages/record/index' });
  }, [currentBuildingId]);

  const handleManageBuilding = useCallback(() => {
    Taro.showActionSheet({
      itemList: ['添加楼栋', '切换楼栋', '编辑楼栋信息', '设置复测周期'],
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
          showCycleSettingModal();
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

  const showCycleSettingModal = () => {
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
          <Button className={styles.actionBtn + ' ' + styles.secondary} onClick={handleManageBuilding}>
            管理楼栋信息
          </Button>
          <Button className={styles.actionBtn + ' ' + styles.collabBtn} onClick={() => Taro.switchTab({ url: '/pages/collaborate/index' })}>
            邀请邻居协作
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
    </ScrollView>
  );
};

export default HomePage;
