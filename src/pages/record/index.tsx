import React, { useState, useCallback } from 'react';
import { View, Text, Button, ScrollView, Input, Switch, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import FloorCard from '../../components/FloorCard';
import type { SensitivityLevel } from '../../types';
import { SENSITIVITY_CONFIG, COMMON_LIGHT_BRANDS } from '../../types';
import { savePhotoPermanently, deletePhotoFile } from '../../utils/storage';
import { consumePendingRetest } from '../../utils/retestNavigate';

const RecordPage: React.FC = () => {
  const {
    currentBuildingId,
    getCurrentBuilding,
    getRecordsByCurrentBuilding,
    addRecord,
    deleteRecord,
    setCurrentBuildingId
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
    blindSpotDescription: '',
    photos: [] as string[],
    lightBrand: '',
    lightModel: ''
  });

  useDidShow(() => {
    console.log('[RecordPage] did show');
    forceUpdate(prev => prev + 1);

    const pending = consumePendingRetest();
    if (pending) {
      if (pending.buildingId !== currentBuildingId) {
        setCurrentBuildingId(pending.buildingId);
      }
      setFormData({
        floor: String(pending.floor),
        sensitivityLevel: 'normal',
        duration: '',
        hasBlindSpot: false,
        blindSpotDescription: '',
        photos: [],
        lightBrand: '',
        lightModel: ''
      });
      setTimeout(() => {
        setShowModal(true);
      }, 150);
    }
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
      blindSpotDescription: '',
      photos: [],
      lightBrand: '',
      lightModel: ''
    });
    setShowModal(true);
  };

  const handleChooseImage = useCallback(() => {
    Taro.chooseImage({
      count: 9 - formData.photos.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        Taro.showLoading({ title: '保存照片中...' });
        const savedPaths = await Promise.all(
          res.tempFilePaths.map(path => savePhotoPermanently(path))
        );
        Taro.hideLoading();
        const newPhotos = [...formData.photos, ...savedPaths];
        setFormData({ ...formData, photos: newPhotos.slice(0, 9) });
      },
      fail: (err) => {
        console.error('[RecordPage] chooseImage error:', err);
      }
    });
  }, [formData.photos]);

  const handlePreviewImage = useCallback((index: number) => {
    Taro.previewImage({
      current: formData.photos[index],
      urls: formData.photos
    });
  }, [formData.photos]);

  const handleDeleteImage = useCallback((index: number) => {
    const photoToDelete = formData.photos[index];
    deletePhotoFile(photoToDelete);
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    setFormData({ ...formData, photos: newPhotos });
  }, [formData.photos]);

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
      blindSpotDescription: formData.hasBlindSpot ? formData.blindSpotDescription.trim() : undefined,
      photos: formData.photos.length > 0 ? formData.photos : undefined,
      lightBrand: formData.lightBrand.trim() || undefined,
      lightModel: formData.lightModel.trim() || undefined
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

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>
                灯具品牌 <Text className={styles.photoHint}>（选填，为后续统计分析和更换选型提供依据）</Text>
              </Text>
              <View className={styles.brandPickerRow}>
                <Input
                  className={styles.formInput}
                  placeholder="请输入或点击右侧选择品牌"
                  value={formData.lightBrand}
                  onInput={e => setFormData({ ...formData, lightBrand: e.detail.value })}
                />
                <Button
                  className={styles.pickBrandBtn}
                  onClick={() => {
                    Taro.showActionSheet({
                      itemList: COMMON_LIGHT_BRANDS,
                      success: (res) => {
                        const selected = COMMON_LIGHT_BRANDS[res.tapIndex];
                        setFormData({ ...formData, lightBrand: selected === '其他品牌' ? '' : selected });
                      }
                    });
                  }}
                >
                  选择
                </Button>
              </View>
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>
                灯具型号 <Text className={styles.photoHint}>（选填，可查看灯体上的标签铭牌）</Text>
              </Text>
              <Input
                className={styles.formInput}
                placeholder="如：LED-SD-005W、声光控灯泡 E27"
                value={formData.lightModel}
                onInput={e => setFormData({ ...formData, lightModel: e.detail.value })}
              />
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>
                现场拍照 <Text className={styles.photoHint}>（可拍声控灯、楼道环境、损坏情况，最多9张）</Text>
              </Text>
              <View className={styles.photoGrid}>
                {formData.photos.map((photo, index) => (
                  <View key={index} className={styles.photoItem}>
                    <Image
                      className={styles.photoImg}
                      src={photo}
                      mode="aspectFill"
                      onClick={() => handlePreviewImage(index)}
                    />
                    <View
                      className={styles.photoDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImage(index);
                      }}
                    >
                      <Text className={styles.photoDeleteText}>×</Text>
                    </View>
                  </View>
                ))}
                {formData.photos.length < 9 && (
                  <View className={styles.photoAdd} onClick={handleChooseImage}>
                    <Text className={styles.photoAddIcon}>+</Text>
                    <Text className={styles.photoAddText}>拍照/相册</Text>
                  </View>
                )}
              </View>
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
