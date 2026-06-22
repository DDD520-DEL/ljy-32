import React, { useState } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import RankCard from '../../components/RankCard';
import type { RankItem, BrandRankItem } from '../../types';
import { GRADE_CONFIG, UNKNOWN_BRAND } from '../../types';

const RankPage: React.FC = () => {
  const {
    currentBuildingId,
    getCurrentBuilding,
    getRankList,
    getBrandRankList,
    getRecordsByCurrentBuilding,
    getRepairRecordsByBuilding
  } = useData();

  const currentBuilding = getCurrentBuilding();
  const rankList = getRankList();
  const brandRankList = getBrandRankList();
  const allRecords = getRecordsByCurrentBuilding();
  const repairRecords = currentBuildingId ? getRepairRecordsByBuilding(currentBuildingId) : [];

  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [staleFilter, setStaleFilter] = useState<'all' | 'stale' | 'fresh'>('all');
  const [rankTab, setRankTab] = useState<'floor' | 'brand'>('floor');
  const [, forceUpdate] = useState(0);

  useDidShow(() => {
    console.log('[RankPage] did show');
    forceUpdate(prev => prev + 1);
  });

  const poorFloors = rankList.filter(r => r.grade === 'poor').length;
  const testedFloors = rankList.length;
  const staleFloors = rankList.filter(r => r.isStale).length;
  const avgScore = rankList.length > 0
    ? Math.round(rankList.reduce((sum, r) => sum + r.averageScore, 0) / rankList.length)
    : 0;

  const filteredRankList = rankList.filter(item => {
    if (staleFilter === 'stale') return item.isStale;
    if (staleFilter === 'fresh') return !item.isStale;
    return true;
  });

  const sortedRankList = [...filteredRankList].sort((a, b) => {
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

  const handleViewRepairBoard = () => {
    Taro.navigateTo({ url: '/pages/repair/index' });
  };

  const getPodiumStyle = (rank: number): 'gold' | 'silver' | 'bronze' => {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    return 'bronze';
  };

  return (
    <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <View className={styles.headerRow}>
          <View className={styles.headerText}>
            <Text className={styles.title}>楼层灵敏度排行榜</Text>
            <Text className={styles.subtitle}>
              {currentBuilding ? `${currentBuilding.name} · 共${allRecords.length}次测试` : '请先选择楼栋'}
            </Text>
          </View>
          <View className={styles.repairEntry} onClick={handleViewRepairBoard}>
            <Text className={styles.repairIcon}>🔧</Text>
            <Text className={styles.repairText}>维修看板</Text>
            {repairRecords.length > 0 && (
              <View className={styles.repairBadge}>
                <Text>{repairRecords.filter(r => r.status !== 'fixed').length}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View className={styles.tabBar}>
        <Button
          className={classNames(styles.tabBtn, { [styles.active]: rankTab === 'floor' })}
          onClick={() => setRankTab('floor')}
        >
          🏢 楼层排名
        </Button>
        <Button
          className={classNames(styles.tabBtn, { [styles.active]: rankTab === 'brand' })}
          onClick={() => setRankTab('brand')}
        >
          💡 品牌排名
        </Button>
      </View>

      {rankTab === 'floor' ? (
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
            <View className={classNames(styles.summaryItem, styles.staleItem)}>
              <Text className={styles.value}>{staleFloors}</Text>
              <Text className={styles.label}>数据过期</Text>
            </View>
          </View>
        </View>
      ) : (
        <View className={styles.summaryCard}>
          <View className={styles.summaryRow}>
            <View className={styles.summaryItem}>
              <Text className={styles.value}>{brandRankList.length}</Text>
              <Text className={styles.label}>品牌数量</Text>
            </View>
            <View className={styles.summaryItem}>
              <Text className={styles.value}>
                {brandRankList.length > 0 ? brandRankList[0].brand.slice(0, 6) : '-'}
              </Text>
              <Text className={styles.label}>最佳品牌</Text>
            </View>
            <View className={styles.summaryItem}>
              <Text className={styles.value}>
                {brandRankList.length > 1 ? brandRankList[brandRankList.length - 1].brand.slice(0, 6) : '-'}
              </Text>
              <Text className={styles.label}>待优化品牌</Text>
            </View>
            <View className={styles.summaryItem}>
              <Text className={styles.value}>
                {brandRankList.filter(b => b.grade === 'excellent').length}
              </Text>
              <Text className={styles.label}>优秀品牌</Text>
            </View>
          </View>
        </View>
      )}

      {rankTab === 'floor' ? (
        <>
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

          <View className={styles.filterBar}>
            <Button
              className={classNames(styles.filterBtn, styles.small, { [styles.active]: staleFilter === 'all' })}
              onClick={() => setStaleFilter('all')}
            >
              全部
            </Button>
            <Button
              className={classNames(styles.filterBtn, styles.small, styles.staleFilter, { [styles.active]: staleFilter === 'stale' })}
              onClick={() => setStaleFilter('stale')}
            >
              仅看过期 ({staleFloors})
            </Button>
            <Button
              className={classNames(styles.filterBtn, styles.small, styles.freshFilter, { [styles.active]: staleFilter === 'fresh' })}
              onClick={() => setStaleFilter('fresh')}
            >
              仅看最新
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
        </>
      ) : (
        <>
          {brandRankList.length > 0 ? (
            <>
              <View className={styles.brandTop3Section}>
                <Text className={styles.sectionTitle}>🏆 品牌表现排名</Text>
                <View className={styles.brandTop3Container}>
                  {brandRankList.slice(0, 3).map((item, index) => {
                    const rank = index + 1;
                    const podiumStyle = getPodiumStyle(rank);
                    const orderClass = rank === 1 ? 'first' : rank === 2 ? 'second' : 'third';

                    return (
                      <View
                        key={item.brand}
                        className={classNames(styles.podiumItem, styles[orderClass], styles.brandPodiumItem)}
                      >
                        <View className={classNames(styles.podiumBadge, styles[podiumStyle])}>
                          <Text className={styles.podiumRank}>{rank}</Text>
                        </View>
                        <Text className={styles.brandPodiumName}>
                          {item.brand === UNKNOWN_BRAND ? '未登记' : item.brand.length > 8 ? item.brand.slice(0, 8) + '…' : item.brand}
                        </Text>
                        <Text className={styles.podiumScore}>{item.avgScore}分</Text>
                        <View className={classNames(styles.podiumBase, styles[podiumStyle])}>
                          <Text>{item.avgScore}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View className={styles.brandRankList}>
                <Text className={styles.sectionTitle}>📊 品牌完整排名</Text>
                {brandRankList.map((item: BrandRankItem) => {
                  const gradeConfig = GRADE_CONFIG[item.grade];
                  return (
                    <View key={item.brand} className={styles.brandRankCard}>
                      <View className={styles.brandCardHeader}>
                        <View className={styles.brandRankBadge}>
                          <Text className={styles.brandRankText}>#{item.rank}</Text>
                        </View>
                        <View className={styles.brandInfo}>
                          <Text className={styles.brandName}>
                            {item.brand === UNKNOWN_BRAND ? '未登记品牌' : item.brand}
                          </Text>
                          <Text className={styles.brandMeta}>
                            覆盖{item.floorCount}层 · {item.testCount}次测试
                          </Text>
                        </View>
                        <View className={styles.brandScoreArea}>
                          <Text className={classNames(styles.brandScore, styles[item.grade])}>
                            {item.avgScore}
                          </Text>
                          <View
                            className={styles.gradeTag}
                            style={{ background: `${gradeConfig.color}20`, color: gradeConfig.color }}
                          >
                            <Text>{gradeConfig.label}</Text>
                          </View>
                        </View>
                      </View>
                      <View className={styles.brandStats}>
                        <View className={styles.brandStatItem}>
                          <Text className={styles.brandStatValue} style={{ color: GRADE_CONFIG.excellent.color }}>
                            {item.excellentRatio}%
                          </Text>
                          <Text className={styles.brandStatLabel}>优秀率</Text>
                        </View>
                        <View className={styles.brandStatItem}>
                          <Text className={styles.brandStatValue} style={{ color: GRADE_CONFIG.poor.color }}>
                            {item.poorRatio}%
                          </Text>
                          <Text className={styles.brandStatLabel}>较差率</Text>
                        </View>
                        <View className={styles.brandStatItem}>
                          <Text className={styles.brandStatValue}>{item.avgSensitivityScore}</Text>
                          <Text className={styles.brandStatLabel}>平均灵敏度</Text>
                        </View>
                        <View className={styles.brandStatItem}>
                          <Text className={styles.brandStatValue}>{item.models.length || '-'}</Text>
                          <Text className={styles.brandStatLabel}>型号数</Text>
                        </View>
                      </View>
                      {item.models.length > 0 && (
                        <View className={styles.brandModels}>
                          <Text className={styles.brandModelsLabel}>登记型号：</Text>
                          <Text className={styles.brandModelsText}>
                            {item.models.join('、')}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              <View className={styles.brandRecommendation}>
                <Text className={styles.sectionTitle}>💡 更换选型建议</Text>
                <View className={styles.recommendCard}>
                  {brandRankList[0] && (
                    <View className={styles.recommendRow}>
                      <Text className={styles.recommendLabel}>👍 推荐品牌：</Text>
                      <Text className={styles.recommendValue}>
                        {brandRankList[0].brand === UNKNOWN_BRAND ? '（暂无足够数据）' : brandRankList[0].brand}
                      </Text>
                    </View>
                  )}
                  {brandRankList[brandRankList.length - 1] && brandRankList.length > 1 && (
                    <View className={styles.recommendRow}>
                      <Text className={styles.recommendLabel}>⚠️ 谨慎选择：</Text>
                      <Text className={classNames(styles.recommendValue, styles.warn)}>
                        {brandRankList[brandRankList.length - 1].brand === UNKNOWN_BRAND ? '（暂无足够数据）' : brandRankList[brandRankList.length - 1].brand}
                      </Text>
                    </View>
                  )}
                  <Text className={styles.recommendHint}>
                    * 以上建议基于本楼栋历史测试数据的综合评分得出，仅供参考。实际更换时请结合价格、保修、节能等因素综合考虑。
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View className={styles.emptyState}>
              <Text className={styles.emptyIcon}>💡</Text>
              <Text className={styles.emptyText}>暂无品牌数据</Text>
              <Text className={styles.emptyHint}>
                测试时填写灯具品牌和型号，即可生成品牌排名，为后续更换选型提供数据支持。
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

export default RankPage;
