import React, { useState, useCallback } from 'react';
import { View, Text, Button, ScrollView, Input, Switch } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import FloorCard from '../../components/FloorCard';
import type { SensitivityLevel } from '../../types';
import { SENSITIVITY_CONFIG } from '../../types';

const RecordPage: React.FC = () => {
  const {
    currentBuildingId,
    getCurrentBuilding,
    getRecordsByCurrentBuilding,
    addRecord,
    deleteRecord
  } = useData();

  const currentBuilding = getCurrentBuilding();
  const allRecords = getRecordsByCurrentBuilding();

  const [filter, setFilter] = useState<'all' | 'excellent' | 'good' | 'poor'>('all');
  const [showModal, setShowModal] = useState(false);
  const [, forceUpdate] = useState(0);

  const [formData, setFormData] = useState({
    floor: '',
    sensitivityLevel: 'normal' as SensitivityLevel,
    duration: '',
    hasBlindSpot: false,
    blindSpotDescription: ''
  });

  useDidShow(() => {
    console.log('[RecordPage] did show');
    forceUpdate(prev => prev + 1);
  });

  const filteredRecords = allRecords.filter(record => {
    if (filter === 'all') return true;
    return record.grade === filter;
  });

  const sortedRecords = [...filteredRecords].sort(
    (a, b) => new Date(b.testTime).getTime() - new Date(a.testTime).getTime()
  );

  const handleOpenModal = () => {
    if (!currentBuildingId) {
      Taro.showToast({ title: '请先添加楼栋', icon: 'none' });
      return;
    }
    setFormData({
      floor: '',
      sensitivityLevel: 'normal',
      duration: '',
      hasBlindSpot: false,
      blindSpotDescription: ''
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = useCallback(() => {
    if (!currentBuilding || !currentBuildingId) {
      Taro.showToast({ title: '请先选择楼栋', icon: 'none' });
      return;
    }

    const floor = parseInt(formData.floor, 10);
    const duration = parseInt(formData.duration, 10);

    if (!formData.floor || isNaN(floor) || floor < 1 || floor > currentBuilding.totalFloors) {
      Taro.showToast({ title: `请输入有效的楼层（1-${currentBuilding.totalFloors}）`, icon: 'none' });
      return;
    }

    if (!formData.duration || isNaN(duration) || duration < 1 || duration > 300) {
      Taro.showToast({ title: '请输入有效的亮灯时长（1-300秒）', icon: 'none' });
      return;
    }

    if (formData.hasBlindSpot && !formData.blindSpotDescription.trim()) {
      Taro.showToast({ title: '请描述盲区位置', icon: 'none' });
      return;
    }

    const sensitivityConfig = SENSITIVITY_CONFIG[formData.sensitivityLevel];

    addRecord({
      buildingId: currentBuildingId,
      buildingName: currentBuilding.name,
      floor,
      sensitivityLevel: formData.sensitivityLevel,
      sensitivityScore: sensitivityConfig.score,
      duration,
      hasBlindSpot: formData.hasBlindSpot,
      blindSpotDescription: formData.hasBlindSpot ? formData.blindSpotDescription.trim() : undefined
    });

    Taro.showToast({ title: '记录成功', icon: 'success' });
    setShowModal(false);
    forceUpdate(prev => prev + 1);
  }, [currentBuilding, currentBuildingId, formData, addRecord]);

  const handleViewDetail = (floor: number) => {
    Taro.navigateTo({
      url: `/pages/detail/index?floor=${floor}&buildingId=${currentBuildingId}`
    });
  };

  const handleDeleteRecord = (id: string) => {
    deleteRecord(id);
    forceUpdate(prev => prev + 1);
    Taro.showToast({ title: '删除成功', icon: 'success' });
  };

  const filterOptions = [
    { key: 'all', label: '全部' },
    { key: 'excellent', label: '优秀' },
    { key: 'good', label: '良好' },
    { key: 'poor', label: '待更换' }
  ];

  const sensitivityLevels: Array<{ key: SensitivityLevel; label: string; description: string }> = [
    { key: 'whisper', label: '轻声', description: '轻声说话即可点亮' },
    { key: 'normal', label: '正常', description: '正常说话声音可点亮' },
    { key: 'loud', label: '大声', description: '需要大声喊叫才亮' },
    { key: 'shout', label: '喊叫', description: '必须用力喊叫才亮' }
  ];

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <Text className={styles.currentBuilding}>
          {currentBuilding ? `${currentBuilding.name} · ${currentBuilding.address}` : '请先添加楼栋'}
        </Text>
        <Text className={styles.title}>测试记录</Text>
      </View>

      <View className={styles.filterBar}>
        {filterOptions.map(option => (
          <Button
            key={option.key}
            className={classNames(styles.filterBtn, { [styles.active]: filter === option.key })}
            onClick={() => setFilter(option.key as any)}
          >
            {option.label}
          </Button>
        ))}
      </View>

      <ScrollView scrollY style={{ height: 'calc(100vh - 400rpx)' }}>
        {sortedRecords.length > 0 ? (
          sortedRecords.map(record => (
            <FloorCard
              key={record.id}
              record={record}
              onDelete={() => handleDeleteRecord(record.id)}
              onClick={() => handleViewDetail(record.floor)}
            />
          ))
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📋</Text>
            <Text className={styles.emptyText}>暂无测试记录</Text>
            <Text className={styles.emptyHint}>点击右下角按钮开始测试</Text>
          </View>
        )}
      </ScrollView>

      <View className={styles.fab} onClick={handleOpenModal}>
        <Text className={styles.fabText}>+</Text>
      </View>

      {showModal && (
        <View className={styles.modalOverlay} onClick={handleCloseModal}>
          <View className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <Text className={styles.modalTitle}>新增测试记录</Text>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>楼层</Text>
              <Input
                className={styles.formInput}
                type="number"
                placeholder={`请输入楼层（1-${currentBuilding?.totalFloors || 30}）`}
                value={formData.floor}
                onInput={e => setFormData({ ...formData, floor: e.detail.value })}
              />
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>灵敏度（多大声响才亮）</Text>
              <View className={styles.sensitivityOptions}>
                {sensitivityLevels.map(level => (
                  <Button
                    key={level.key}
                    className={classNames(styles.sensitivityOption, {
                      [styles.active]: formData.sensitivityLevel === level.key
                    })}
                    onClick={() => setFormData({ ...formData, sensitivityLevel: level.key })}
                  >
                    <Text className={styles.optionLabel}>{level.label}</Text>
                    <Text className={styles.optionDesc}>{level.description}</Text>
                  </Button>
                ))}
              </View>
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>亮灯时长</Text>
              <View className={styles.durationInput}>
                <Input
                  className={styles.formInput}
                  type="number"
                  placeholder="请输入秒数"
                  value={formData.duration}
                  onInput={e => setFormData({ ...formData, duration: e.detail.value })}
                />
                <Text className={styles.unit}>秒</Text>
              </View>
            </View>

            <View className={styles.formGroup}>
              <View className={styles.switchRow}>
                <Text className={styles.switchLabel}>是否有感应盲区</Text>
                <Switch
                  checked={formData.hasBlindSpot}
                  onChange={e => setFormData({ ...formData, hasBlindSpot: e.detail.value })}
                  color="#FF6B35"
                />
              </View>
              {formData.hasBlindSpot && (
                <Input
                  className={styles.formInput}
                  placeholder="请描述盲区位置（如：楼梯转角、电梯口）"
                  value={formData.blindSpotDescription}
                  onInput={e => setFormData({ ...formData, blindSpotDescription: e.detail.value })}
                />
              )}
            </View>

            <View className={styles.modalFooter}>
              <Button className={styles.cancelBtn} onClick={handleCloseModal}>
                取消
              </Button>
              <Button className={styles.confirmBtn} onClick={handleSubmit}>
                提交
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default RecordPage;
