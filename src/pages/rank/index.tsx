import React, { useState } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import RankCard from '../../components/RankCard';
import type { RankItem } from '../../types';

const RankPage: React.FC = () => {
  const {
    currentBuildingId,
    getCurrentBuilding,
    getRankList,
    getRecordsByCurrentBuilding
  } = useData();

  const currentBuilding = getCurrentBuilding();
  const rankList = getRankList();
  const allRecords = getRecordsByCurrentBuilding();

  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [, forceUpdate] = useState(0);

  useDidShow(() => {
    console.log('[RankPage] did show');
    forceUpdate(prev => prev + 1);
  });

  const poorFloors = rankList.filter(r => r.grade === 'poor').length;
  const testedFloors = rankList.length;
  const avgScore = rankList.length > 0
    ? Math.round(rankList.reduce((sum, r) => sum + r.averageScore, 0) / rankList.length)
    : 0;

  const sortedRankList = [...rankList].sort((a, b) => {
    return sortOrder === 'desc'
      ? b.averageScore - a.averageScore
      : a.averageScore - b.averageScore;
  });

  const top3 = sortedRankList.slice(0, 3);
  const restList = sortedRankList.slice(3);

  const handleViewDetail = (floor: number) => {
    Taro.navigateTo({
      url: `/pages/detail/index?floor=${floor}&buildingId=${currentBuildingId}`
    });
  };

  const getPodiumStyle = (rank: number): 'gold' | 'silver' | 'bronze' => {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    return 'bronze';
  };

  return (
    <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <Text className={styles.title}>楼层灵敏度排行榜</Text>
        <Text className={styles.subtitle}>
          {currentBuilding ? `${currentBuilding.name} · 共${allRecords.length}次测试` : '请先选择楼栋'}
        </Text>
      </View>

      <View className={styles.summaryCard}>
        <View className={styles.summaryRow}>
          <View className={styles.summaryItem}>
            <Text className={styles.value}>{testedFloors}</Text>
            <Text className={styles.label}>已测楼层</Text>
          </View>
          <View className={styles.summaryItem}>
            <Text className={styles.value}>{avgScore}</Text>
            <Text className={styles.label}>平均分</Text>
          </View>
          <View className={styles.summaryItem}>
            <Text className={styles.value}>{poorFloors}</Text>
            <Text className={styles.label}>待更换</Text>
          </View>
        </View>
      </View>

      <View className={styles.filterBar}>
        <Button
          className={classNames(styles.filterBtn, { [styles.active]: sortOrder === 'desc' })}
          onClick={() => setSortOrder('desc')}
        >
          分数从高到低
        </Button>
        <Button
          className={classNames(styles.filterBtn, { [styles.active]: sortOrder === 'asc' })}
          onClick={() => setSortOrder('asc')}
        >
          分数从低到高
        </Button>
      </View>

      {rankList.length > 0 ? (
        <>
          <View className={styles.top3Section}>
            <Text className={styles.sectionTitle}>🏆 TOP 3 优秀楼层</Text>
            <View className={styles.top3Container}>
              {[1, 2, 3].map(rank => {
                const item = top3.find(r => r.rank === rank) as RankItem | undefined;
                if (!item) return null;
                const podiumStyle = getPodiumStyle(rank);
                const orderClass = rank === 1 ? 'first' : rank === 2 ? 'second' : 'third';

                return (
                  <View
                    key={rank}
                    className={classNames(styles.podiumItem, styles[orderClass])}
                    onClick={() => handleViewDetail(item.floor)}
                  >
                    <View className={classNames(styles.podiumBadge, styles[podiumStyle])}>
                      <Text className={styles.podiumRank}>{rank}</Text>
                    </View>
                    <Text className={styles.podiumFloor}>{item.floor}楼</Text>
                    <Text className={styles.podiumScore}>{item.averageScore}分</Text>
                    <View className={classNames(styles.podiumBase, styles[podiumStyle])}>
                      <Text>{item.averageScore}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View className={styles.rankList}>
            <Text className={styles.sectionTitle}>📊 完整排行榜</Text>
            {restList.map(item => (
              <View key={`${item.buildingName}-${item.floor}`} onClick={() => handleViewDetail(item.floor)}>
                <RankCard item={item} />
              </View>
            ))}
          </View>
        </>
      ) : (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>📊</Text>
          <Text className={styles.emptyText}>暂无排行数据</Text>
          <Text className={styles.emptyHint}>快去测试各楼层的声控灯吧！</Text>
        </View>
      )}
    </ScrollView>
  );
};

export default RankPage;
