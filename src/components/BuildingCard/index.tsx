import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import type { Building } from '../../types';

interface BuildingCardProps {
  building: Building;
  isActive: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const BuildingCard: React.FC<BuildingCardProps> = ({
  building,
  isActive,
  onClick,
  onEdit,
  onDelete
}) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    Taro.showModal({
      title: '确认删除',
      content: `确定要删除${building.name}吗？相关测试记录也会被删除。`,
      success: (res) => {
        if (res.confirm) {
          onDelete?.();
        }
      }
    });
  };

  return (
    <View
      className={classNames(styles.card, {
        [styles.active]: isActive
      })}
      onClick={onClick}
    >
      <View className={styles.header}>
        <View className={styles.titleRow}>
          <Text className={styles.name}>{building.name}</Text>
          {isActive && <View className={styles.activeTag}>当前</View>}
        </View>
        <View className={styles.actions}>
          <Text className={styles.actionBtn} onClick={handleEdit}>编辑</Text>
          <Text className={styles.actionBtn} onClick={handleDelete}>删除</Text>
        </View>
      </View>
      <View className={styles.info}>
        <Text className={styles.infoText}>地址：{building.address}</Text>
        <Text className={styles.infoText}>共 {building.totalFloors} 层</Text>
      </View>
    </View>
  );
};

export default BuildingCard;
