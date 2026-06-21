import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import ScoreBadge from '../ScoreBadge';
import type { TestRecord } from '../../types';
import { SENSITIVITY_CONFIG } from '../../types';
import { formatDate } from '../../utils/storage';

interface FloorCardProps {
  record: TestRecord;
  onDelete?: () => void;
  onClick?: () => void;
}

const FloorCard: React.FC<FloorCardProps> = ({ record, onDelete, onClick }) => {
  const sensitivityInfo = SENSITIVITY_CONFIG[record.sensitivityLevel];

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条测试记录吗？',
      success: (res) => {
        if (res.confirm) {
          onDelete?.();
        }
      }
    });
  };

  return (
    <View className={styles.card} onClick={onClick}>
      <View className={styles.header}>
        <View className={styles.floorInfo}>
          <Text className={styles.floorNumber}>{record.floor}楼</Text>
          <Text className={styles.buildingName}>{record.buildingName}</Text>
        </View>
        <ScoreBadge score={record.totalScore} grade={record.grade} size="medium" />
      </View>

      <View className={styles.details}>
        <View className={styles.detailItem}>
          <Text className={styles.detailLabel}>灵敏度</Text>
          <View className={styles.detailValue}>
            <Text className={styles.sensitivityLevel}>{sensitivityInfo.label}</Text>
            <Text className={styles.sensitivityDesc}>{sensitivityInfo.description}</Text>
          </View>
        </View>

        <View className={styles.detailRow}>
          <View className={styles.detailItem}>
            <Text className={styles.detailLabel}>亮灯时长</Text>
            <Text className={styles.detailValueText}>{record.duration} 秒</Text>
          </View>
          <View className={styles.detailItem}>
            <Text className={styles.detailLabel}>盲区</Text>
            <Text className={record.hasBlindSpot ? styles.hasBlind : styles.noBlind}>
              {record.hasBlindSpot ? '有' : '无'}
            </Text>
          </View>
        </View>

        {record.hasBlindSpot && record.blindSpotDescription && (
          <View className={styles.blindSpotDesc}>
            <Text className={styles.blindSpotText}>盲区位置：{record.blindSpotDescription}</Text>
          </View>
        )}
      </View>

      <View className={styles.footer}>
        <Text className={styles.testTime}>{formatDate(record.testTime)}</Text>
        <Text className={styles.deleteBtn} onClick={handleDelete}>删除</Text>
      </View>
    </View>
  );
};

export default FloorCard;
