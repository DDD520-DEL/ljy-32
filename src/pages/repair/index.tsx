import React, { useState, useMemo } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import { REPAIR_STATUS_CONFIG, RepairStatus, RepairRecord } from '../../types';
import { formatDate } from '../../utils/storage';

const RepairPage: React.FC = () => {
  const {
    currentBuildingId,
    getCurrentBuilding,
    getRepairRecordsByBuilding,
    getRankList,
    updateRepairStatus,
    markFloorComplaint
  } = useData();

  const currentBuilding = getCurrentBuilding();
  const rankList = getRankList();
  const repairRecords = currentBuildingId ? getRepairRecordsByBuilding(currentBuildingId) : [];

  const [filterStatus, setFilterStatus] = useState<RepairStatus | 'all'>('all');
  const [, forceUpdate] = useState(0);

  useDidShow(() => {
    console.log('[RepairPage] did show');
    forceUpdate(prev => prev + 1);
  });

  const stats = useMemo(() => {
    const total = repairRecords.length;
    const pending = repairRecords.filter(r => r.status === 'pending').length;
    const dispatched = repairRecords.filter(r => r.status === 'dispatched').length;
    const repairing = repairRecords.filter(r => r.status === 'repairing').length;
    const fixed = repairRecords.filter(r => r.status === 'fixed').length;
    const complained = repairRecords.filter(r => r.complaintMarked).length;
    return { total, pending, dispatched, repairing, fixed, complained };
  }, [repairRecords]);

  const filteredRecords = useMemo(() => {
    let records = [...repairRecords];
    if (filterStatus !== 'all') {
      records = records.filter(r => r.status === filterStatus);
    }
    return records.sort((a, b) => {
      const stepA = REPAIR_STATUS_CONFIG[a.status].step;
      const stepB = REPAIR_STATUS_CONFIG[b.status].step;
      if (stepA !== stepB) return stepA - stepB;
      return new Date(b.statusUpdateTime).getTime() - new Date(a.statusUpdateTime).getTime();
    });
  }, [repairRecords, filterStatus]);

  const handleChangeStatus = (record: RepairRecord) => {
    const statusList: RepairStatus[] = ['pending', 'dispatched', 'repairing', 'fixed'];
    const statusLabels = statusList.map(s => `${REPAIR_STATUS_CONFIG[s].icon} ${REPAIR_STATUS_CONFIG[s].label}`);

    Taro.showActionSheet({
      itemList: statusLabels,
      success: (res) => {
        const newStatus = statusList[res.tapIndex];
        updateRepairStatus(record.id, newStatus);
        forceUpdate(prev => prev + 1);
        Taro.showToast({ title: '状态已更新', icon: 'success' });
      }
    });
  };

  const handleMarkComplaint = (record: RepairRecord) => {
    Taro.showModal({
      title: '确认标记',
      content: `确认已向物业投诉${record.floor}楼的声控灯问题？`,
      success: (res) => {
        if (res.confirm && currentBuildingId) {
          markFloorComplaint(currentBuildingId, record.floor, record.issues);
          forceUpdate(prev => prev + 1);
          Taro.showToast({ title: '已标记投诉', icon: 'success' });
        }
      }
    });
  };

  const getProgressWidth = (status: RepairStatus): number => {
    const step = REPAIR_STATUS_CONFIG[status].step;
    return ((step - 1) / 3) * 100;
  };

  const renderStep = (status: RepairStatus) => {
    const steps: RepairStatus[] = ['pending', 'dispatched', 'repairing', 'fixed'];
    const currentStep = REPAIR_STATUS_CONFIG[status].step;

    return (
      <View className={styles.progressSteps}>
        <View className={styles.progressLine}>
          <View
            className={styles.progressLineActive}
            style={{ width: `${getProgressWidth(status)}%` }}
          />
        </View>
        {steps.map((step) => {
          const config = REPAIR_STATUS_CONFIG[step];
          const isCompleted = config.step < currentStep;
          const isActive = config.step === currentStep;
          const dotClass = isCompleted ? 'completed' : isActive ? 'active' : '';

          return (
            <View key={step} className={styles.stepItem}>
              <View className={classNames(styles.stepDot, styles[dotClass])}>
                {isCompleted ? '✓' : config.step}
              </View>
              <Text className={classNames(styles.stepLabel, styles[dotClass])}>
                {config.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <Text className={styles.title}>🔧 维修看板</Text>
        <Text className={styles.subtitle}>
          {currentBuilding ? `${currentBuilding.name} · 跟踪物业维修进度` : '请先选择楼栋'}
        </Text>
      </View>

      {repairRecords.length > 0 ? (
        <>
          <View className={styles.statsCard}>
            <View className={styles.statsRow}>
              <View className={styles.statItem}>
                <Text className={styles.value}>{stats.total}</Text>
                <Text className={styles.label}>问题总数</Text>
              </View>
              <View className={styles.statItem}>
                <Text className={styles.value}>{stats.complained}</Text>
                <Text className={styles.label}>已投诉</Text>
              </View>
              <View className={styles.statItem}>
                <Text className={styles.value}>{stats.fixed}</Text>
                <Text className={styles.label}>已修复</Text>
              </View>
            </View>
          </View>

          <View className={styles.filterBar}>
            <Button
              className={classNames(styles.filterBtn, { [styles.active]: filterStatus === 'all' })}
              onClick={() => setFilterStatus('all')}
            >
              全部 ({stats.total})
            </Button>
            <Button
              className={classNames(styles.filterBtn, { [styles.active]: filterStatus === 'pending' })}
              onClick={() => setFilterStatus('pending')}
            >
              待处理 ({stats.pending})
            </Button>
            <Button
              className={classNames(styles.filterBtn, { [styles.active]: filterStatus === 'dispatched' })}
              onClick={() => setFilterStatus('dispatched')}
            >
              已派单 ({stats.dispatched})
            </Button>
            <Button
              className={classNames(styles.filterBtn, { [styles.active]: filterStatus === 'repairing' })}
              onClick={() => setFilterStatus('repairing')}
            >
              维修中 ({stats.repairing})
            </Button>
            <Button
              className={classNames(styles.filterBtn, { [styles.active]: filterStatus === 'fixed' })}
              onClick={() => setFilterStatus('fixed')}
            >
              已修复 ({stats.fixed})
            </Button>
          </View>

          <Text className={styles.sectionTitle}>📋 维修进度详情</Text>
          <View className={styles.repairList}>
            {filteredRecords.map(record => {
              const statusConfig = REPAIR_STATUS_CONFIG[record.status];
              return (
                <View key={record.id} className={styles.repairCard}>
                  <View className={styles.cardHeader}>
                    <View className={styles.floorInfo}>
                      <Text className={styles.floorNumber}>{record.floor}楼</Text>
                      <Text className={styles.buildingName}>{record.buildingName}</Text>
                    </View>
                    <View
                      className={classNames(styles.statusBadge, styles[`status-${record.status}`])}
                    >
                      <Text>{statusConfig.icon} {statusConfig.label}</Text>
                    </View>
                  </View>

                  <View className={styles.issuesSection}>
                    <Text className={styles.issuesLabel}>问题描述</Text>
                    <Text className={styles.issuesText}>{record.issues || '暂无详细描述'}</Text>
                  </View>

                  <View className={styles.progressSection}>
                    {renderStep(record.status)}
                  </View>

                  <View className={styles.metaSection}>
                    <View className={styles.metaInfo}>
                      <Text className={classNames(styles.metaItem, { [styles.complained]: record.complaintMarked })}>
                        {record.complaintMarked ? '✓ 已投诉' : '未投诉'}
                      </Text>
                      <Text className={styles.metaItem}>
                        更新：{formatDate(record.statusUpdateTime)}
                      </Text>
                    </View>
                    {!record.complaintMarked ? (
                      <Button
                        className={styles.actionBtn}
                        onClick={() => handleMarkComplaint(record)}
                      >
                        标记已投诉
                      </Button>
                    ) : (
                      <Button
                        className={styles.actionBtn}
                        onClick={() => handleChangeStatus(record)}
                      >
                        更新状态
                      </Button>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>🔧</Text>
          <Text className={styles.emptyText}>暂无维修记录</Text>
          <Text className={styles.emptyHint}>
            {rankList.filter(r => r.grade === 'poor').length > 0
              ? '请到"投诉分享"页面标记已投诉的楼层，开始追踪维修进度'
              : '暂无需要维修的楼层，快去测试吧！'}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

export default RepairPage;
