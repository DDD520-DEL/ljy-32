import React from 'react';
import { View, Text } from '@tarojs/components';
import classNames from 'classnames';
import styles from './index.module.scss';
import ScoreBadge from '../ScoreBadge';
import type { RankItem } from '../../types';
import { formatDate } from '../../utils/storage';

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
    <View className={classNames(styles.card, { [styles.stale]: item.isStale })}>
      <View className={classNames(styles.rankBadge, styles[getRankStyle()])}>
        <Text className={styles.rankText}>{item.rank}</Text>
      </View>

      <View className={styles.floorInfo}>
        <View className={styles.floorRow}>
          <Text className={styles.floorNumber}>{item.floor}楼</Text>
          <Text className={styles.testCount}>
            {item.testCount}次测试
            {item.contributors.length > 1 && ` · ${item.contributors.length}人协作`}
          </Text>
        </View>
        <Text className={styles.buildingName}>{item.buildingName}</Text>
        <View className={styles.metaRow}>
          <Text className={styles.lastTestTime}>
            上次测试：{formatDate(item.lastTestTime)}
          </Text>
          {item.isStale && (
            <View className={styles.staleBadge}>
              <Text className={styles.staleText}>⚠️ 数据过期（{item.daysSinceLastTest}天）</Text>
            </View>
          )}
        </View>
        {item.contributors.length > 1 && (
          <View className={styles.contributors}>
            {item.contributors.map(c => (
              <View key={c.testerId || c.testTime} className={styles.contributorTag}>
                <Text className={styles.contributorName}>{c.testerName}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScoreBadge score={item.averageScore} grade={item.grade} size="large" />
    </View>
  );
};

export default RankCard;
