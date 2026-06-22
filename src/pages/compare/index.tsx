import React, { useState, useMemo } from 'react';
import { View, Text, Button, ScrollView, Checkbox } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import { formatDate } from '../../utils/storage';

const CompareSelectPage: React.FC = () => {
  const { buildings, getBuildingStats } = useData();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [, forceUpdate] = useState(0);

  useDidShow(() => {
    console.log('[CompareSelectPage] did show');
    forceUpdate(prev => prev + 1);
  });

  const buildingsWithStats = useMemo(() => {
    return buildings.map(building => {
      const stats = getBuildingStats(building.id);
      return { building, stats };
    });
  }, [buildings, getBuildingStats]);

  const toggleSelect = (buildingId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(buildingId)) {
      newSelected.delete(buildingId);
    } else {
      newSelected.add(buildingId);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === buildings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(buildings.map(b => b.id)));
    }
  };

  const handleStartCompare = () => {
    if (selectedIds.size < 2) {
      Taro.showToast({ title: '请至少选择2个楼栋', icon: 'none' });
      return;
    }
    const idsStr = Array.from(selectedIds).join(',');
    Taro.navigateTo({
      url: `/pages/compareResult/index?ids=${idsStr}`
    });
  };

  return (
    <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <Text className={styles.title}>楼栋对比</Text>
        <Text className={styles.subtitle}>选择2个以上楼栋，横向对比各项指标</Text>
      </View>

      {buildings.length > 0 && (
        <View className={styles.selectionBar}>
          <View className={styles.selectionInfo}>
            <Text className={styles.selectedCount}>已选 {selectedIds.size} / {buildings.length}</Text>
          </View>
          <Button className={styles.selectAllBtn} onClick={selectAll}>
            {selectedIds.size === buildings.length ? '取消全选' : '全选'}
          </Button>
        </View>
      )}

      {buildings.length > 0 ? (
        <View className={styles.buildingList}>
          {buildingsWithStats.map(({ building, stats }) => (
            <View
              key={building.id}
              className={classNames(styles.buildingCard, {
                [styles.selected]: selectedIds.has(building.id)
              })}
              onClick={() => toggleSelect(building.id)}
            >
              <View className={styles.checkboxWrapper}>
                <Checkbox
                  value={building.id}
                  checked={selectedIds.has(building.id)}
                  color="#FF6B35"
                />
              </View>
              <View className={styles.buildingContent}>
                <View className={styles.buildingHeader}>
                  <Text className={styles.buildingName}>{building.name}</Text>
                  <Text className={styles.buildingAddress}>{building.address}</Text>
                </View>
                <View className={styles.buildingMeta}>
                  <Text className={styles.metaItem}>共 {building.totalFloors} 层</Text>
                  {stats && stats.totalTests > 0 && (
                    <>
                      <Text className={styles.metaDivider}>·</Text>
                      <Text className={styles.metaItem}>{stats.totalTests} 次测试</Text>
                      <Text className={styles.metaDivider}>·</Text>
                      <Text className={styles.metaItem}>覆盖 {stats.testedFloors} 层</Text>
                    </>
                  )}
                </View>
                {stats && stats.totalTests > 0 ? (
                  <View className={styles.statsPreview}>
                    <View className={styles.previewItem}>
                      <Text className={styles.previewValue} style={{ color: '#FF6B35' }}>
                        {stats.avgTotalScore}
                      </Text>
                      <Text className={styles.previewLabel}>平均分</Text>
                    </View>
                    <View className={styles.previewItem}>
                      <Text className={styles.previewValue} style={{ color: '#10B981' }}>
                        {stats.excellentRatio}%
                      </Text>
                      <Text className={styles.previewLabel}>优秀率</Text>
                    </View>
                    <View className={styles.previewItem}>
                      <Text className={styles.previewValue} style={{ color: '#EF4444' }}>
                        {stats.needReplaceRatio}%
                      </Text>
                      <Text className={styles.previewLabel}>待更换</Text>
                    </View>
                    <View className={styles.previewItem}>
                      <Text className={styles.previewValue} style={{ color: '#0EA5E9' }}>
                        {stats.testedFloorsRatio}%
                      </Text>
                      <Text className={styles.previewLabel}>覆盖率</Text>
                    </View>
                  </View>
                ) : (
                  <View className={styles.noDataHint}>
                    <Text className={styles.noDataText}>暂无测试数据</Text>
                  </View>
                )}
                {stats?.lastTestTime && (
                  <View className={styles.lastTest}>
                    <Text className={styles.lastTestText}>
                      最近测试：{formatDate(stats.lastTestTime)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>🏢</Text>
          <Text className={styles.emptyText}>暂无楼栋</Text>
          <Text className={styles.emptyHint}>请先在首页添加楼栋信息</Text>
          <Button
            className={styles.addBuildingBtn}
            onClick={() => Taro.switchTab({ url: '/pages/home/index' })}
          >
            去添加楼栋
          </Button>
        </View>
      )}

      {buildings.length > 0 && (
        <View className={styles.footerBar}>
          <Button
            className={classNames(styles.compareBtn, {
              [styles.disabled]: selectedIds.size < 2
            })}
            disabled={selectedIds.size < 2}
            onClick={handleStartCompare}
          >
            开始对比 ({selectedIds.size})
          </Button>
        </View>
      )}
    </ScrollView>
  );
};

export default CompareSelectPage;
