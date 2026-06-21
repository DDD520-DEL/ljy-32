import React from 'react';
import { View, Text } from '@tarojs/components';
import classNames from 'classnames';
import styles from './index.module.scss';
import ScoreBadge from '../ScoreBadge';
import type { RankItem } from '../../types';

interface RankCardProps {
  item: RankItem;
}

const RankCard: React.FC<RankCardProps> = ({ item }) => {
  const getRankStyle = () => {
    if (item.rank === 1) return 'gold';
    if (item.rank === 2) return 'silver';
    if (item.rank === 3) return 'bronze';
    return 'normal';
  };

  return (
    <View className={styles.card}>
      <View className={classNames(styles.rankBadge, styles[getRankStyle()])}>
        <Text className={styles.rankText}>{item.rank}</Text>
      </View>

      <View className={styles.floorInfo}>
        <View className={styles.floorRow}>
          <Text className={styles.floorNumber}>{item.floor}楼</Text>
          <Text className={styles.testCount}>{item.testCount}次测试</Text>
        </View>
        <Text className={styles.buildingName}>{item.buildingName}</Text>
      </View>

      <ScoreBadge score={item.averageScore} grade={item.grade} size="large" />
    </View>
  );
};

export default RankCard;
